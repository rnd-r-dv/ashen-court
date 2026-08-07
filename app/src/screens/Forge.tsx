import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type {
  ArtRecipe,
  CardType,
  EffectKind,
  EffectSpec,
  EffectTarget,
  Keyword,
  Rarity,
  Trigger,
} from '@ashen/core';
import type { ForgeDraft } from '../forge/formState.js';
import { createDraft, draftIssues, draftToCard, EFFECT_PRESETS } from '../forge/formState.js';
import { saveCustomCard } from '../storage.js';
import Card from '../components/Card.js';
import ImportExport from '../components/ImportExport.js';
import './forge.css';

/**
 * Forge screen (Task 25). Left: card form. Right: live Card preview + issue
 * list. Draft state is recomputed on every keystroke; draftIssues drives
 * inline field errors and the Save gate. Saving persists via storage.ts and
 * resets the form to a fresh draft.
 */

const TYPES: CardType[] = ['creature', 'spell', 'artifact'];
const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const KEYWORDS: Keyword[] = ['taunt', 'rush', 'charge', 'windfury', 'lifesteal', 'ward', 'shield'];
const TRIGGERS: Trigger[] = ['battlecry', 'deathrattle', 'startOfTurn', 'endOfTurn', 'onDamage'];
const TARGETS: EffectTarget[] = [
  'any', 'hero', 'anyCreature', 'enemyCreature', 'friendlyCreature', 'friendlyDragon',
  'allEnemies', 'allEnemyCreatures', 'allFriendlyCreatures', 'randomEnemy', 'randomEnemyCreature', 'self',
];

/** Canonical art presets (Task 26 owns the real definitions; any value is legal today). */
const ART_PRESETS = ['ember', 'frost', 'nature', 'dragon', 'shadow', 'bone', 'void', 'curse', 'star', 'vigil', 'storm', 'arcane'];
const PALETTES: [string, string][] = [
  ['#2a1a3e', '#ff6b35'],
  ['#0e2a47', '#6fd3ff'],
  ['#123524', '#7ce07c'],
  ['#3d0f1f', '#ff5a5a'],
  ['#1b1035', '#b18cff'],
  ['#2b2118', '#e8d5b0'],
  ['#120f1e', '#8a7bff'],
  ['#2c1430', '#ff8ae2'],
  ['#1a1a3a', '#ffe97d'],
  ['#1c2b3a', '#ffd166'],
  ['#12202e', '#7fd8ff'],
  ['#241b4f', '#7b5cff'],
];

/** Kinds whose spec carries a numeric value the slider can edit. */
const VALUE_KINDS: ReadonlySet<EffectKind> = new Set([
  'dealDamage', 'draw', 'heal', 'buff', 'summon', 'gainMana', 'refillMana', 'discountMostExpensive', 'discountNextSpell',
]);
/** Kinds whose spec carries a target select. */
const TARGET_KINDS: ReadonlySet<EffectKind> = new Set([
  'dealDamage', 'heal', 'buff', 'freeze', 'destroy', 'giveKeyword',
]);

interface EffectRow {
  presetIndex: number;
  target?: EffectTarget;   // undefined = keep the preset's default target
  value?: number;          // undefined = keep the preset's default value
}

interface FormState {
  name: string;
  type: CardType;
  cost: number;
  attack: string;
  health: string;
  keywords: Keyword[];
  trigger: Trigger | '';
  rarity: Rarity;
  art: ArtRecipe;
  flavor: string;
  uploadImage?: string;
  rows: EffectRow[];
}

function initialForm(): FormState {
  const draft = createDraft();
  return { ...draft, rows: [] };
}

function rowsToSpecs(rows: EffectRow[]): EffectSpec[] {
  return rows.map((row) => {
    const preset = EFFECT_PRESETS[row.presetIndex];
    if (!preset) return { kind: 'draw', value: 1 };   // defensive; index always in range via UI
    const spec: EffectSpec = { ...preset.spec };
    if (row.target !== undefined) spec.target = row.target;
    if (row.value !== undefined && VALUE_KINDS.has(spec.kind)) spec.value = row.value;
    return spec;
  });
}

export default function Forge() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const draft: ForgeDraft = useMemo(
    () => ({ id: '', ...form, effects: rowsToSpecs(form.rows) }),
    [form],
  );
  const issues = useMemo(() => draftIssues(draft), [draft]);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }

  function onTypeChange(type: CardType) {
    setForm((f) => ({
      ...f,
      type,
      keywords: type === 'spell' ? [] : f.keywords,
      trigger: type === 'spell' ? '' : f.trigger,
    }));
  }

  function onSave(e: FormEvent) {
    e.preventDefault();
    if (errors.length > 0) return;
    const card = draftToCard(draft);
    let saved: boolean;
    try {
      saved = saveCustomCard(card);
    } catch (err) {
      // I2: slug collision with a curated id or a different-name custom card —
      // keep the draft so the user can rename; surface the reason in the toast.
      showToast(err instanceof Error ? err.message : 'Save failed.');
      return;
    }
    if (!saved) {
      // I1: localStorage rejected the write (quota — usually an oversized image).
      showToast('Storage full — the card could not be saved. Try a smaller image or fewer custom cards.');
      return;
    }
    showToast(`Saved "${card.name}" as ${card.id}`);
    setForm(initialForm());
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';   // allow re-selecting the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set('uploadImage', String(reader.result));
    reader.readAsDataURL(file);
  }

  function setPreset(i: number, presetIndex: number) {
    setForm((f) => ({
      ...f,
      rows: f.rows.map((r, idx) => (idx === i ? { presetIndex } : r)),
    }));
  }

  function setRow<K extends keyof EffectRow>(i: number, key: K, value: EffectRow[K]) {
    setForm((f) => ({
      ...f,
      rows: f.rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)),
    }));
  }

  const spell = form.type === 'spell';
  const creature = form.type === 'creature';
  const effectsNeedTrigger = !spell && form.rows.length > 0 && !form.trigger;

  function issuesFor(field: string) {
    return issues.filter((i) => i.field === field);
  }

  return (
    <div className="forge">
      <header className="forge-header">
        <h1>The Forge</h1>
        <p className="forge-subtitle">Forge a custom card — it is saved locally and joins the card pool.</p>
        <ImportExport mode="cards" />
      </header>

      <div className="forge-layout">
        <form className="forge-form" onSubmit={onSave} noValidate>
          {/* name */}
          <section className="forge-section">
            <label className="forge-label" htmlFor="forge-name">Name</label>
            <input
              id="forge-name"
              className="forge-input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Cinder Warden"
              autoFocus
            />
            {issuesFor('name').map((i, n) => <p className="forge-error" key={n}>{i.message}</p>)}
          </section>

          {/* type */}
          <section className="forge-section">
            <span className="forge-label">Type</span>
            <div className="forge-segmented">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`forge-seg-btn${form.type === t ? ' active' : ''}`}
                  onClick={() => onTypeChange(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            {issuesFor('type').map((i, n) => <p className="forge-error" key={n}>{i.message}</p>)}
          </section>

          {/* cost */}
          <section className="forge-section">
            <label className="forge-label" htmlFor="forge-cost">
              Cost: <strong>{form.cost}</strong>
            </label>
            <input
              id="forge-cost"
              className="forge-slider"
              type="range"
              min={0}
              max={15}
              step={1}
              value={form.cost}
              onChange={(e) => set('cost', Number(e.target.value))}
            />
            {issuesFor('cost').map((i, n) => <p className="forge-error" key={n}>{i.message}</p>)}
          </section>

          {/* creature stats */}
          {creature && (
            <section className="forge-section forge-stats">
              <div className="forge-field">
                <label className="forge-label" htmlFor="forge-attack">Attack</label>
                <input
                  id="forge-attack"
                  className="forge-input"
                  type="number"
                  min={0}
                  value={form.attack}
                  onChange={(e) => set('attack', e.target.value)}
                  placeholder="0"
                />
                {issuesFor('attack').map((i, n) => <p className="forge-error" key={n}>{i.message}</p>)}
              </div>
              <div className="forge-field">
                <label className="forge-label" htmlFor="forge-health">Health</label>
                <input
                  id="forge-health"
                  className="forge-input"
                  type="number"
                  min={1}
                  value={form.health}
                  onChange={(e) => set('health', e.target.value)}
                  placeholder="1"
                />
                {issuesFor('health').map((i, n) => <p className="forge-error" key={n}>{i.message}</p>)}
              </div>
            </section>
          )}
          {issuesFor('stats').map((i, n) => <p className="forge-error" key={n}>{i.message}</p>)}

          {/* rarity */}
          <section className="forge-section">
            <label className="forge-label" htmlFor="forge-rarity">Rarity</label>
            <select
              id="forge-rarity"
              className="forge-input"
              value={form.rarity}
              onChange={(e) => set('rarity', e.target.value as Rarity)}
            >
              {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </section>

          {/* keywords */}
          {!spell && (
            <section className="forge-section">
              <span className="forge-label">Keywords</span>
              <div className="forge-chips">
                {KEYWORDS.map((k) => {
                  const active = form.keywords.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      className={`forge-chip${active ? ' active' : ''}`}
                      onClick={() =>
                        set('keywords', active ? form.keywords.filter((x) => x !== k) : [...form.keywords, k])
                      }
                    >
                      {k}
                    </button>
                  );
                })}
              </div>
              {issuesFor('keywords').map((i, n) => <p className="forge-error" key={n}>{i.message}</p>)}
            </section>
          )}

          {/* trigger */}
          {!spell && (
            <section className="forge-section">
              <label className="forge-label" htmlFor="forge-trigger">Trigger</label>
              <select
                id="forge-trigger"
                className="forge-input"
                value={form.trigger}
                onChange={(e) => set('trigger', e.target.value as Trigger | '')}
              >
                <option value="">None</option>
                {TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {issuesFor('trigger').map((i, n) => <p className="forge-error" key={n}>{i.message}</p>)}
            </section>
          )}

          {/* effects */}
          <section className="forge-section">
            <div className="forge-label-row">
              <span className="forge-label">{spell ? 'Cast effects' : 'Trigger effects'}</span>
              <button
                type="button"
                className="forge-add-btn"
                onClick={() => setForm((f) => ({ ...f, rows: [...f.rows, { presetIndex: 0 }] }))}
              >
                + Add effect
              </button>
            </div>
            {effectsNeedTrigger && (
              <p className="forge-hint">Effects apply only when a trigger is selected — add one above, or they will be dropped on save.</p>
            )}
            {form.rows.length === 0 && <p className="forge-hint">{spell ? 'Spells need at least one effect.' : 'No effects yet.'}</p>}
            {form.rows.map((row, i) => {
              const preset = EFFECT_PRESETS[row.presetIndex];
              const kind = preset?.spec.kind ?? 'draw';
              const showTarget = TARGET_KINDS.has(kind);
              const showValue = VALUE_KINDS.has(kind);
              const value = row.value ?? preset?.spec.value ?? 0;
              return (
                <div className="forge-effect-row" key={i}>
                  <select
                    className="forge-input"
                    value={row.presetIndex}
                    onChange={(e) => setPreset(i, Number(e.target.value))}
                  >
                    {EFFECT_PRESETS.map((p, idx) => (
                      <option key={idx} value={idx}>{p.label}</option>
                    ))}
                  </select>
                  {showTarget && (
                    <select
                      className="forge-input"
                      value={row.target ?? preset?.spec.target ?? 'any'}
                      onChange={(e) => setRow(i, 'target', e.target.value as EffectTarget)}
                    >
                      {TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  )}
                  {showValue && (
                    <label className="forge-slider-label">
                      {value}
                      <input
                        className="forge-slider"
                        type="range"
                        min={0}
                        max={10}
                        step={1}
                        value={value}
                        onChange={(e) => setRow(i, 'value', Number(e.target.value))}
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    className="forge-remove-btn"
                    onClick={() => setForm((f) => ({ ...f, rows: f.rows.filter((_, idx) => idx !== i) }))}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            {issuesFor('effect').map((i, n) => <p className="forge-error" key={n}>{i.message}</p>)}
          </section>

          {/* art */}
          <section className="forge-section">
            <span className="forge-label">Art</span>
            <label className="forge-label" htmlFor="forge-preset">Preset</label>
            <select
              id="forge-preset"
              className="forge-input"
              value={form.art.preset}
              onChange={(e) => set('art', { ...form.art, preset: e.target.value })}
            >
              {ART_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>

            <span className="forge-label">Palette</span>
            <div className="forge-swatches">
              {PALETTES.map(([a, b], i) => (
                <button
                  key={i}
                  type="button"
                  className={`forge-swatch${form.art.palette[0] === a && form.art.palette[1] === b ? ' active' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                  title={`${a} → ${b}`}
                  onClick={() => set('art', { ...form.art, palette: [a, b] })}
                />
              ))}
            </div>

            <label className="forge-label" htmlFor="forge-glyph">Glyph (rune char)</label>
            <input
              id="forge-glyph"
              className="forge-input forge-glyph"
              value={form.art.glyph ?? ''}
              maxLength={4}
              onChange={(e) => set('art', { ...form.art, glyph: e.target.value })}
              placeholder="✦"
            />

            <span className="forge-label">Image upload (overrides preset art)</span>
            <div className="forge-upload-row">
              <label className="forge-file-btn">
                {form.uploadImage ? 'Replace image' : 'Choose image…'}
                <input type="file" accept="image/*" onChange={onFile} hidden />
              </label>
              {form.uploadImage && (
                <>
                  <img className="forge-upload-thumb" src={form.uploadImage} alt="upload preview" />
                  <button
                    type="button"
                    className="forge-remove-btn"
                    onClick={() => set('uploadImage', undefined)}
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </section>

          {/* flavor */}
          <section className="forge-section">
            <label className="forge-label" htmlFor="forge-flavor">Flavor text</label>
            <textarea
              id="forge-flavor"
              className="forge-input forge-textarea"
              value={form.flavor}
              onChange={(e) => set('flavor', e.target.value)}
              placeholder="A line of lore…"
              rows={3}
            />
          </section>

          <div className="forge-actions">
            <button type="submit" className="forge-save-btn" disabled={errors.length > 0}>
              {errors.length > 0 ? `Save blocked (${errors.length} issue${errors.length === 1 ? '' : 's'})` : 'Save card'}
            </button>
            <button
              type="button"
              className="forge-reset-btn"
              onClick={() => { setForm(initialForm()); }}
            >
              Reset
            </button>
          </div>
        </form>

        <aside className="forge-side">
          <section className="forge-section forge-preview-section">
            <h2 className="forge-side-title">Preview</h2>
            <Card card={draftToCard(draft)} size="preview" />
          </section>

          <section className="forge-section forge-issues-section">
            <h2 className="forge-side-title">Issues ({issues.length})</h2>
            {issues.length === 0 && <p className="forge-ok">No issues — this card is ready to save.</p>}
            {errors.map((i, n) => (
              <p className="forge-issue forge-issue-error" key={`e${n}`}>
                <strong>{i.field}:</strong> {i.message}
              </p>
            ))}
            {warnings.map((i, n) => (
              <p className="forge-issue forge-issue-warning" key={`w${n}`}>
                <strong>{i.field}:</strong> {i.message}
              </p>
            ))}
          </section>
        </aside>
      </div>

      {toast && <div className="forge-toast">{toast}</div>}
    </div>
  );
}

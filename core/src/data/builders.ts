import type { ArtRecipe, Card, EffectSpec, EffectTarget, Keyword, Rarity, TriggerSpec } from '../types.js';

/**
 * Shared private builders for the 12 curated archetype files (Tasks 14-17).
 *
 * Every archetype file used to redeclare its own byte-identical copy of hashId
 * plus creature/spell/artifact factories that differed ONLY in three baked-in
 * constants: the art preset, the palette, and the archetype tag. archetypeCards()
 * takes those three and hands back the same four helpers, so a new archetype
 * declares its identity once instead of reimplementing the builders.
 *
 * This module is deliberately NOT re-exported through data/index.ts — it is an
 * authoring convenience for the curated data files, not part of the @ashen/core
 * public surface.
 *
 * tokens.ts keeps its own copy of this hash behind arcaneArt() (the 'arcane'
 * preset used by tokens and neutrals). The two implementations must stay
 * identical: both feed the same deterministic art seed, so any drift silently
 * repaints every card that crosses between them.
 */

/** FNV-1a (32-bit) over the card id: deterministic, stable, distinct per id. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The four card-authoring helpers one archetype file needs. */
export interface ArchetypeCardBuilders {
  art: (id: string) => ArtRecipe;
  creature: (
    id: string, name: string, cost: number, attack: number, health: number,
    rarity: Rarity, keywords?: Keyword[], triggers?: TriggerSpec[], flavor?: string,
  ) => Card;
  spell: (id: string, name: string, cost: number, rarity: Rarity, effects: EffectSpec[], flavor?: string) => Card;
  artifact: (id: string, name: string, cost: number, rarity: Rarity, triggers: TriggerSpec[], flavor?: string) => Card;
}

/**
 * Build the card factories for one archetype. `preset` selects the Forge art
 * preset, `palette` its placeholder dark-fantasy 2-color palette (Task 26 owns
 * the canonical palettes), and `archetype` is the tag stamped on every card the
 * returned builders produce — it must match this archetype's ArchetypeId key in
 * DECK_DEFS.
 */
export function archetypeCards(preset: string, palette: string[], archetype: string): ArchetypeCardBuilders {
  const art = (id: string): ArtRecipe => ({ preset, palette, seed: hashId(id) });
  return {
    art,
    creature: (id, name, cost, attack, health, rarity, keywords = [], triggers = [], flavor) => ({
      id, name, type: 'creature', cost, attack, health,
      // Task 1 transitional: Reflect mirrors Attack until the Identity Gate
      // stabilizes card roles and Task 2 hand-authors explicit values.
      reflect: attack,
      keywords, triggers, effects: [], rarity, archetype,
      art: art(id), author: 'curated', version: 1, schemaVersion: 2, flavor,
    }),
    spell: (id, name, cost, rarity, effects, flavor) => ({
      id, name, type: 'spell', cost,
      keywords: [], effects, rarity, archetype,
      art: art(id), author: 'curated', version: 1, schemaVersion: 2, flavor,
    }),
    artifact: (id, name, cost, rarity, triggers, flavor) => ({
      id, name, type: 'artifact', cost,
      keywords: [], effects: [], triggers, rarity, archetype,
      art: art(id), author: 'curated', version: 1, schemaVersion: 2, flavor,
    }),
  };
}

/*
 * EffectSpec shorthands shared by two or more archetype files. Effects that
 * only one archetype uses (Starforged's discountMostExpensive, Stormwrought's
 * discountNextSpell, Eternal Vigil's giveKeyword, Night Coven's freeze) stay
 * declared in that file — they read as part of its identity, not as boilerplate.
 */

export const dmg = (value: number, target: EffectTarget): EffectSpec => ({ kind: 'dealDamage', value, target });
/** Defaults to the caster's hero, which is what most heal cards want; Hollow
 *  Choir and Eternal Vigil pass an explicit target for their targeted heals. */
export const heal = (value: number, target: EffectTarget = 'hero'): EffectSpec => ({ kind: 'heal', value, target });
export const draw = (value: number): EffectSpec => ({ kind: 'draw', value });
export const buff = (value: number, value2: number, target: EffectTarget): EffectSpec => ({ kind: 'buff', value, value2, target });
export const destroy = (target: EffectTarget): EffectSpec => ({ kind: 'destroy', target });
export const gainMana = (value: number): EffectSpec => ({ kind: 'gainMana', value });
/** `value` is the copy count; omitted entirely when undefined so a 1-summon
 *  spec stays `{kind, cardId}` (cardtext defaults it to 1). */
export const summon = (cardId: string, value?: number): EffectSpec =>
  ({ kind: 'summon', cardId, ...(value !== undefined ? { value } : {}) });

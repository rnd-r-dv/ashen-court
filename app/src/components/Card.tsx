import type { Card as CardSpec } from '@ashen/core';

/**
 * Render-only card stub (Task 25). Shows identity, stats, rarity border and a
 * placeholder art area — full visual styling is Task 37. Used by the Forge
 * live preview today; the deck builder (Task 27) will reuse it later.
 */

const RARITY_COLOR: Record<CardSpec['rarity'], string> = {
  common: '#8f93a5',
  rare: '#3f8ef7',
  epic: '#a96ef7',
  legendary: '#f7b23f',
};

const TYPE_LABEL: Record<CardSpec['type'], string> = {
  creature: 'Creature',
  spell: 'Spell',
  artifact: 'Artifact',
};

export default function Card({ card }: { card: CardSpec }) {
  const isCreature = card.type === 'creature';
  const art = card.art;

  return (
    <div
      className="card-preview"
      style={{ borderColor: RARITY_COLOR[card.rarity] }}
      data-rarity={card.rarity}
    >
      <div className="card-preview-head">
        <span className="card-preview-name">{card.name || 'Unnamed card'}</span>
        <span className="card-preview-cost">{card.cost}</span>
      </div>
      <div className="card-preview-type">
        {TYPE_LABEL[card.type]} · {card.rarity}
      </div>

      {card.keywords.length > 0 && (
        <div className="card-preview-keywords">
          {card.keywords.map((k) => (
            <span className="card-preview-keyword" key={k}>
              {k}
            </span>
          ))}
        </div>
      )}

      <div className="card-preview-art">
        {art.imageUrl ? (
          <img className="card-preview-img" src={art.imageUrl} alt={`${card.name} art`} />
        ) : (
          <div
            className="card-preview-artfallback"
            style={{
              background: `linear-gradient(135deg, ${art.palette[0] ?? '#333345'}, ${art.palette[1] ?? '#15151f'})`,
            }}
          >
            <span className="card-preview-glyph">{art.glyph || '✦'}</span>
          </div>
        )}
      </div>

      {isCreature && (
        <div className="card-preview-stats">
          <span className="card-preview-stat">{card.attack}</span>
          <span className="card-preview-stat">{card.health}</span>
        </div>
      )}

      {card.flavor && <p className="card-preview-flavor">“{card.flavor}”</p>}
    </div>
  );
}

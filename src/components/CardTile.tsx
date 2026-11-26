import { memo } from 'react';
import type { Card } from '../data/types';
import { store } from '../state/store';
import { CardImage } from './CardImage';
import { Icon } from './Icon';

/** What a tap on a card does. */
export type TapMode = 'view' | 'need' | 'trade' | 'add' | 'remove';

interface Props {
  card: Card;
  count: number;
  wanted: boolean;
  locked: boolean;
  /** Copies on the For Trade list (0 = not offered). */
  offered: number;
  mode: TapMode;
  onOpen: (card: Card) => void;
}

export function tapCard(card: Card, mode: TapMode, onOpen: (card: Card) => void) {
  switch (mode) {
    case 'view':
      onOpen(card);
      break;
    case 'need':
      store.toggleWanted(card.key, (on) => `${card.name} ${on ? 'added to' : 'removed from'} your needs`);
      break;
    case 'trade':
      store.toggleForTrade(card);
      break;
    case 'add':
      store.adjust(card.key, 1, (f, t) => `${card.name}: ${f} → ${t}`);
      break;
    case 'remove':
      store.adjust(card.key, -1, (f, t) => `${card.name}: ${f} → ${t}`);
      break;
  }
}

export const CardTile = memo(function CardTile({ card, count, wanted, locked, offered, mode, onOpen }: Props) {
  const classes = ['tile', count === 0 && 'is-missing', wanted && 'is-wanted', offered > 0 && 'has-spares']
    .filter(Boolean)
    .join(' ');
  const action =
    mode === 'view'
      ? 'Open'
      : mode === 'need'
        ? wanted
          ? 'Unmark'
          : 'Mark as needed'
        : mode === 'trade'
          ? offered > 0
            ? 'Take off the For Trade list'
            : 'Put on the For Trade list'
          : mode === 'add'
            ? 'Add one'
            : 'Remove one';

  return (
    <div className={classes}>
      <button
        className="tile-hit"
        onClick={() => tapCard(card, mode, onOpen)}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpen(card);
        }}
        title={`${card.name} · ${card.set} #${card.number} · you have ${count}`}
        aria-label={`${action}: ${card.name}, ${card.set} number ${card.number}, you have ${count}`}
      >
        <CardImage key={card.id} card={card} size="thumb" />
      </button>
      {count > 0 && <span className="badge badge-count">×{count}</span>}
      {offered > 0 && (
        <span className="badge badge-spare" title={`${offered} on your For Trade list`}>
          <Icon name="swap" size={12} />
          {offered}
        </span>
      )}
      {wanted && (
        <span className="badge badge-need" aria-label="Needed">
          <Icon name="heart" size={14} fill />
        </span>
      )}
      {locked && (
        <span className="badge badge-lock" aria-label="Never trade">
          <Icon name="lock" size={13} />
        </span>
      )}
      {mode !== 'view' && (
        <button className="tile-info" onClick={() => onOpen(card)} aria-label={`Details for ${card.name}`}>
          <Icon name="info" size={16} />
        </button>
      )}
    </div>
  );
});

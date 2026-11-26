import { useMemo } from 'react';
import type { Card, Catalog } from '../data/types';
import { store } from '../state/store';
import type { Filters } from '../state/filters';
import { tradeCopies, type TradeCtx } from '../state/trade';
import { CardTile, type TapMode } from './CardTile';
import { Icon } from './Icon';

interface Props {
  catalog: Catalog;
  cards: Card[];
  filters: Filters;
  counts: Record<string, number>;
  wanted: Record<string, true>;
  trade: TradeCtx;
  mode: TapMode;
  tagOf: (code: string) => string;
  onOpen: (card: Card) => void;
  onReset: () => void;
}

export function CardGrid({ catalog, cards, filters, counts, wanted, trade, mode, tagOf, onOpen, onReset }: Props) {
  const { keep, locked } = trade;
  const groups = useMemo(() => {
    if (filters.sort !== 'set' || !filters.group) return [{ code: '', cards }];
    const out: { code: string; cards: Card[] }[] = [];
    for (const c of cards) {
      const last = out[out.length - 1];
      if (last && last.code === c.set) last.cards.push(c);
      else out.push({ code: c.set, cards: [c] });
    }
    return out;
  }, [cards, filters.sort, filters.group]);

  if (!cards.length) {
    return (
      <div className="empty">
        <p>No cards match these filters.</p>
        <button className="btn" onClick={onReset}>
          Clear filters
        </button>
      </div>
    );
  }

  const tile = (c: Card) => (
    <CardTile
      key={c.id}
      card={c}
      count={counts[c.key] ?? 0}
      wanted={Boolean(wanted[c.key])}
      locked={Boolean(locked[c.key])}
      offered={tradeCopies(c, trade)}
      mode={mode}
      onOpen={onOpen}
    />
  );

  return (
    <div className="groups">
      {groups.map((g) => {
        const set = catalog.setByCode.get(g.code);
        const owned = g.cards.filter((c) => (counts[c.key] ?? 0) > 0).length;
        const below = g.cards.filter((c) => (counts[c.key] ?? 0) < keep && !wanted[c.key]);
        const marked = g.cards.filter((c) => wanted[c.key]);
        // Trade mode: cards here you have but aren't offering yet, and the hand-picked ones.
        const pickable = g.cards.filter((c) => c.tradeable && (counts[c.key] ?? 0) > 0 && tradeCopies(c, trade) === 0);
        const picked = g.cards.filter((c) => trade.forTrade[c.key]);
        const rows = Math.ceil(g.cards.length / 6);
        return (
          <section
            key={g.code || 'all'}
            className="set-section"
            style={{ containIntrinsicSize: `auto ${rows * 240 + 60}px` }}
          >
            {set && (
              <header className="set-head">
                <span className="set-tag">{tagOf(set.code)}</span>
                <h3>{set.name}</h3>
                <span className="set-progress" title={`You have ${owned} of the ${g.cards.length} cards shown`}>
                  <span className="bar">
                    <span style={{ width: `${(owned / g.cards.length) * 100}%` }} />
                  </span>
                  {owned}/{g.cards.length}
                </span>
                {mode === 'need' && (
                  <span className="set-actions">
                    {below.length > 0 && (
                      <button
                        className="chip small"
                        onClick={() =>
                          store.setWanted(
                            below.map((c) => c.key),
                            true,
                            `Marked ${below.length} ${set.name} card${below.length === 1 ? '' : 's'} as needed`,
                            below.map((c) => c.tier),
                          )
                        }
                      >
                        <Icon name="heart" size={13} /> Need all under {keep} ({below.length})
                      </button>
                    )}
                    {marked.length > 0 && (
                      <button
                        className="chip small"
                        onClick={() =>
                          store.setWanted(
                            marked.map((c) => c.key),
                            false,
                            `Cleared ${marked.length} need mark${marked.length === 1 ? '' : 's'} in ${set.name}`,
                          )
                        }
                      >
                        Clear needs ({marked.length})
                      </button>
                    )}
                  </span>
                )}
                {mode === 'trade' && (
                  <span className="set-actions">
                    {pickable.length > 0 && (
                      <button
                        className="chip small"
                        onClick={() =>
                          store.setForTrade(
                            pickable.map((c) => c.key),
                            true,
                            `Put ${pickable.length} ${set.name} card${pickable.length === 1 ? '' : 's'} on your For Trade list`,
                            pickable.map((c) => c.tier),
                          )
                        }
                      >
                        <Icon name="swap" size={13} /> Trade all shown ({pickable.length})
                      </button>
                    )}
                    {picked.length > 0 && (
                      <button
                        className="chip small"
                        onClick={() =>
                          store.setForTrade(
                            picked.map((c) => c.key),
                            false,
                            `Took ${picked.length} ${set.name} card${picked.length === 1 ? '' : 's'} off your For Trade list`,
                          )
                        }
                      >
                        Clear picks ({picked.length})
                      </button>
                    )}
                  </span>
                )}
              </header>
            )}
            <div className="grid">{g.cards.map(tile)}</div>
          </section>
        );
      })}
    </div>
  );
}

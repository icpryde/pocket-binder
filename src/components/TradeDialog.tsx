import { useMemo, useState } from 'react';
import type { Card, Catalog, RarityTier } from '../data/types';
import { TIERS } from '../data/rarity';
import { store, tradeCtx, useCollection } from '../state/store';
import { tradeCopies } from '../state/trade';
import { CardImage } from './CardImage';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { TierIcon } from './TierIcon';

interface Props {
  catalog: Catalog;
  onClose: () => void;
  tagOf: (code: string) => string;
}

function matches(card: Card, q: string, tag: string) {
  const t = q.trim().toLowerCase();
  return !t || card.search.includes(t) || tag.toLowerCase().includes(t);
}

function Picker({
  title,
  hint,
  cards,
  selected,
  onSelect,
  counts,
  wanted,
  keep,
  tagOf,
}: {
  title: string;
  hint: string;
  cards: Card[];
  selected?: string;
  onSelect: (id: string | undefined) => void;
  counts: Record<string, number>;
  wanted: Record<string, true>;
  keep: number;
  tagOf: (code: string) => string;
}) {
  const [q, setQ] = useState('');
  const shown = cards.filter((c) => matches(c, q, tagOf(c.set))).slice(0, 120);
  return (
    <div className="picker">
      <h3>{title}</h3>
      <p className="muted small">{hint}</p>
      <input className="search-input" placeholder="Search name or set tag" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="pick-list">
        {shown.map((c) => {
          const n = counts[c.key] ?? 0;
          return (
            <li key={c.id}>
              <button className={`pick-row ${selected === c.id ? 'on' : ''}`} onClick={() => onSelect(selected === c.id ? undefined : c.id)}>
                <span className="pick-thumb">
                  <CardImage key={c.id} card={c} size="thumb" />
                </span>
                <span className="pick-name">
                  {c.name}
                  <small>
                    {tagOf(c.set)} #{c.number}
                  </small>
                </span>
                <span className="pick-count">
                  {wanted[c.key] && <Icon name="heart" size={14} fill />}×{n}
                  {n > keep && <em>+{n - keep}</em>}
                </span>
              </button>
            </li>
          );
        })}
        {!shown.length && <li className="muted small pad">Nothing here for this rarity.</li>}
      </ul>
    </div>
  );
}

export function TradeDialog({ catalog, onClose, tagOf }: Props) {
  const counts = useCollection((s) => s.counts);
  const wanted = useCollection((s) => s.wanted);
  const locked = useCollection((s) => s.locked);
  const forTrade = useCollection((s) => s.forTrade);
  const settings = useCollection((s) => s.settings);
  const keep = settings.keep;
  const trades = useCollection((s) => s.trades);
  const [tier, setTier] = useState<RarityTier>('d4');
  const [give, setGive] = useState<string>();
  const [get, setGet] = useState<string>();

  const pool = useMemo(
    () => catalog.cards.filter((c) => !c.reprint && c.tier === tier && c.tradeable),
    [catalog, tier],
  );
  const giveList = useMemo(
    () =>
      pool
        .filter((c) => (counts[c.key] ?? 0) > 0)
        .sort((a, b) => {
          // Cards on the For Trade list first, then the most copies.
          const ctx = tradeCtx({ counts, locked, forTrade, settings });
          const score = (c: Card) => (locked[c.key] ? -99 : tradeCopies(c, ctx) * 100 + (counts[c.key] ?? 0));
          return score(b) - score(a);
        }),
    [pool, counts, locked, forTrade, settings],
  );
  const getList = useMemo(
    () =>
      [...pool].sort((a, b) => {
        const score = (c: Card) => (wanted[c.key] ? -1000 : 0) + (counts[c.key] ?? 0);
        return score(a) - score(b);
      }),
    [pool, counts, wanted],
  );

  const giveCard = give ? catalog.byId.get(give) : undefined;
  const getCard = get ? catalog.byId.get(get) : undefined;
  const tradeTiers = TIERS.filter((t) => catalog.cards.some((c) => c.tier === t.tier && c.tradeable));

  const confirm = () => {
    if (!giveCard && !getCard) return;
    const parts = [
      giveCard && `gave ${giveCard.name} (${counts[giveCard.key] ?? 0} → ${(counts[giveCard.key] ?? 0) - 1})`,
      getCard && `got ${getCard.name} (${counts[getCard.key] ?? 0} → ${(counts[getCard.key] ?? 0) + 1})`,
    ].filter(Boolean);
    store.trade(giveCard?.key, getCard?.key, `Trade: ${parts.join(', ')}`);
    setGive(undefined);
    setGet(undefined);
  };

  const recent = trades.slice(-8).reverse();
  const nameOf = (key?: string) => (key ? catalog.byKey.get(key)?.name ?? key : '');

  return (
    <Modal
      title="Log a trade"
      onClose={onClose}
      wide
      footer={
        <>
          <div className="trade-summary">
            {giveCard || getCard ? (
              <>
                {giveCard && (
                  <span>
                    Give <b>{giveCard.name}</b> ({counts[giveCard.key] ?? 0} → {(counts[giveCard.key] ?? 0) - 1})
                  </span>
                )}
                {getCard && (
                  <span>
                    Get <b>{getCard.name}</b> ({counts[getCard.key] ?? 0} → {(counts[getCard.key] ?? 0) + 1})
                    {wanted[getCard.key] && (counts[getCard.key] ?? 0) + 1 >= keep ? ' · leaves your need list' : ''}
                  </span>
                )}
              </>
            ) : (
              <span className="muted">Pick the card you gave, the card you got, or both.</span>
            )}
          </div>
          <button className="btn btn-primary" disabled={!giveCard && !getCard} onClick={confirm}>
            <Icon name="check" /> Save trade
          </button>
        </>
      }
    >
      <div className="chips trade-tiers">
        {tradeTiers.map((t) => (
          <button
            key={t.tier}
            className={`chip chip-tier ${tier === t.tier ? 'on' : ''}`}
            onClick={() => {
              setTier(t.tier);
              setGive(undefined);
              setGet(undefined);
            }}
          >
            <TierIcon tier={t.tier} />
          </button>
        ))}
        <span className="muted small">Trades in the game swap two cards of the same rarity.</span>
      </div>
      <div className="trade-cols">
        <Picker
          title="You gave"
          hint="Cards on your For Trade list are at the top."
          cards={giveList}
          selected={give}
          onSelect={setGive}
          counts={counts}
          wanted={wanted}
          keep={keep}
          tagOf={tagOf}
        />
        <Picker
          title="You got"
          hint="Cards on your need list are at the top."
          cards={getList}
          selected={get}
          onSelect={setGet}
          counts={counts}
          wanted={wanted}
          keep={keep}
          tagOf={tagOf}
        />
      </div>
      {recent.length > 0 && (
        <div className="history">
          <h4>Recent trades</h4>
          <ul>
            {recent.map((t, i) => (
              <li key={i}>
                <span>
                  {t.give && `Gave ${nameOf(t.give)}`}
                  {t.give && t.get && ' · '}
                  {t.get && `Got ${nameOf(t.get)}`}
                </span>
                <time>{new Date(t.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

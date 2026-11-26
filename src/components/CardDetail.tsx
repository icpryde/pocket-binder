import { useEffect } from 'react';
import type { Card, Catalog } from '../data/types';
import { STAR_STYLE_BY_ID, TIER_BY_ID } from '../data/rarity';
import { store, tradeCtx, useCollection } from '../state/store';
import { autoQualifies, tradeCopies } from '../state/trade';
import { CardImage } from './CardImage';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { TierIcon } from './TierIcon';

interface Props {
  card: Card;
  catalog: Catalog;
  list: Card[];
  onNavigate: (card: Card) => void;
  onClose: () => void;
  tagOf: (code: string) => string;
}

const STAGE_LABELS = { basic: 'Basic', stage1: 'Stage 1', stage2: 'Stage 2' } as const;

export function CardDetail({ card, catalog, list, onNavigate, onClose, tagOf }: Props) {
  const count = useCollection((s) => s.counts[card.key] ?? 0);
  const wanted = useCollection((s) => Boolean(s.wanted[card.key]));
  const locked = useCollection((s) => Boolean(s.locked[card.key]));
  const picked = useCollection((s) => Boolean(s.forTrade[card.key]));
  const keep = useCollection((s) => s.settings.keep);
  const ctx = useCollection((s) => s);
  const trade = tradeCtx(ctx);
  const offered = tradeCopies(card, trade);
  const auto = trade.autoTradeTiers.includes(card.tier);
  const log = useCollection((s) => s.log);
  const history = log.filter((e) => e.key === card.key).slice(-8).reverse();

  const index = list.findIndex((c) => c.id === card.id);
  const prev = index > 0 ? list[index - 1] : undefined;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft' && prev) onNavigate(prev);
      if (e.key === 'ArrowRight' && next) onNavigate(next);
      if (e.key === '+' || e.key === '=') change(1);
      if (e.key === '-') change(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const set = catalog.setByCode.get(card.set);
  const change = (d: number) => store.adjust(card.key, d, (f, t) => `${card.name}: ${f} → ${t}`);
  const rarity = catalog.rarities[card.rarity];
  const others = card.printings.filter((id) => id !== card.id).map((id) => catalog.byId.get(id)!).filter(Boolean);
  const holding =
    count === 0 ? 'You have none' : count < keep ? `Below your keep number (${keep})` : count === keep ? 'Exactly your keep number' : `${count - keep} more than your keep number`;
  const tradeLine = !card.tradeable
    ? ''
    : locked
      ? 'Never trade'
      : offered > 0
        ? `${offered} on your For Trade list${picked ? ' (picked)' : ''}`
        : count > 0 && !auto
          ? 'Not on your For Trade list. This rarity only lists cards you pick.'
          : '';
  const status = [holding, tradeLine].filter(Boolean).join(' · ');
  const style = card.style && STAR_STYLE_BY_ID.get(card.style);

  return (
    <Modal title={card.name} onClose={onClose} wide>
      <div className="detail">
        <div className="detail-art">
          <button className="nav-btn" disabled={!prev} onClick={() => prev && onNavigate(prev)} aria-label="Previous card">
            <Icon name="chevronLeft" />
          </button>
          <div className={`detail-img ${count === 0 ? 'is-missing' : ''}`}>
            <CardImage key={card.id} card={card} size="large" eager />
          </div>
          <button className="nav-btn" disabled={!next} onClick={() => next && onNavigate(next)} aria-label="Next card">
            <Icon name="chevronRight" />
          </button>
        </div>

        <div className="detail-info">
          <div className="detail-meta">
            <span className="set-tag">{tagOf(card.set)}</span>
            <span>
              {set?.name ?? card.set} · #{String(card.number).padStart(3, '0')}
            </span>
          </div>
          <div className="detail-meta">
            <TierIcon tier={card.tier} size={13} />
            <span>{rarity?.label ?? TIER_BY_ID.get(card.tier)?.label}</span>
            {style && <span className="pill">★★ {style.short}</span>}
            {!card.tradeable && <span className="pill">Can't be traded</span>}
            {card.tradeable && rarity?.tradePrice ? <span className="pill">Trade cost {rarity.tradePrice.toLocaleString()} shinedust</span> : null}
          </div>
          <div className="detail-meta muted">
            {[
              card.element && card.element[0].toUpperCase() + card.element.slice(1),
              card.kind === 'pokemon' ? (card.stage ? STAGE_LABELS[card.stage] : 'Pokémon') : card.kind[0].toUpperCase() + card.kind.slice(1),
              card.health && `${card.health} HP`,
              card.packs.length ? `Pack: ${card.packs.join(', ')}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>

          <div className="stepper">
            <button className="step-btn" onClick={() => change(-1)} disabled={count === 0} aria-label="Remove one">
              <Icon name="minus" size={26} />
            </button>
            <label className="step-value">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={count}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) store.setCount(card.key, v, `${card.name}: ${count} → ${Math.max(0, v)}`);
                }}
                aria-label="How many you have"
              />
              <small>you have</small>
            </label>
            <button className="step-btn" onClick={() => change(1)} aria-label="Add one">
              <Icon name="plus" size={26} />
            </button>
          </div>
          <p className="status">{status}</p>

          <div className="toggles">
            <button
              className={`toggle-btn need ${wanted ? 'on' : ''}`}
              onClick={() => store.toggleWanted(card.key, (on) => `${card.name} ${on ? 'added to' : 'removed from'} your needs`, card.tier)}
            >
              <Icon name="heart" size={18} fill={wanted} /> {wanted ? 'On my need list' : 'I need this'}
            </button>
            {card.tradeable && (
              <button
                className={`toggle-btn trade ${offered > 0 ? 'on' : ''}`}
                onClick={() => store.toggleForTrade(card)}
                disabled={count === 0}
                title={count === 0 ? "You don't have this card yet" : undefined}
              >
                <Icon name="swap" size={18} /> {offered > 0 ? 'On my For Trade list' : 'Willing to trade'}
              </button>
            )}
            {card.tradeable && (locked || autoQualifies(card, trade)) && (
              <button
                className={`toggle-btn lock ${locked ? 'on' : ''}`}
                onClick={() => store.toggleLocked(card.key, (on) => `${card.name}: ${on ? 'never trade' : 'tradeable again'}`)}
              >
                <Icon name="lock" size={18} /> {locked ? 'Never trade' : 'Keep all copies'}
              </button>
            )}
          </div>

          {others.length > 0 && (
            <p className="muted small">
              Same card also in: {others.map((o) => `${catalog.setByCode.get(o.set)?.name ?? o.set} #${o.number}`).join(', ')}. They share one count.
            </p>
          )}

          {history.length > 0 && (
            <div className="history">
              <h4>Recent changes</h4>
              <ul>
                {history.map((h, i) => (
                  <li key={i}>
                    <span>
                      {h.from} → {h.to}
                    </span>
                    <span className="muted">{h.reason === 'trade' ? 'trade' : h.reason === 'bulk' ? 'bulk edit' : ''}</span>
                    <time>{new Date(h.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

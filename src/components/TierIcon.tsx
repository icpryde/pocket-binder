import { TIER_BY_ID, type SymbolKind } from '../data/rarity';
import type { RarityTier } from '../data/types';

function Shape({ kind, size }: { kind: SymbolKind; size: number }) {
  switch (kind) {
    case 'diamond':
      return (
        <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true">
          <path d="M5 0.6 9.4 5 5 9.4 0.6 5z" fill="currentColor" />
        </svg>
      );
    case 'star':
      return (
        <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true">
          <path d="M5 0.5 6.3 3.6 9.6 3.8 7.1 6 7.9 9.4 5 7.6 2.1 9.4 2.9 6 0.4 3.8 3.7 3.6z" fill="currentColor" />
        </svg>
      );
    case 'shiny':
      return (
        <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden="true">
          <path d="M5 0 6.1 3.9 10 5 6.1 6.1 5 10 3.9 6.1 0 5 3.9 3.9z" fill="currentColor" />
        </svg>
      );
    case 'crown':
      return (
        <svg width={size + 2} height={size} viewBox="0 0 12 10" aria-hidden="true">
          <path d="M1 8.5h10L11.5 2.5 8.4 5 6 1 3.6 5 0.5 2.5z" fill="currentColor" />
        </svg>
      );
    default:
      return <span style={{ fontSize: size + 1, fontWeight: 700 }}>Other</span>;
  }
}

export function TierIcon({ tier, size = 11 }: { tier: RarityTier; size?: number }) {
  const info = TIER_BY_ID.get(tier);
  if (!info) return null;
  return (
    <span className={`tier-icon tier-${info.symbol}`} title={info.label} aria-label={info.label} role="img">
      {Array.from({ length: info.count }, (_, i) => (
        <Shape key={i} kind={info.symbol} size={size} />
      ))}
    </span>
  );
}

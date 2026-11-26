import type { RarityTier, StarStyle } from './types';

export type SymbolKind = 'diamond' | 'star' | 'shiny' | 'crown' | 'other';

export interface TierInfo {
  tier: RarityTier;
  label: string;
  symbol: SymbolKind;
  count: number;
  codes: string[];
  /** Plain-text symbol used in Discord posts. */
  text: string;
}

// Order here is the order filters and exports use.
export const TIERS: TierInfo[] = [
  { tier: 'd1', label: '1 Diamond', symbol: 'diamond', count: 1, codes: ['C'], text: '◆' },
  { tier: 'd2', label: '2 Diamond', symbol: 'diamond', count: 2, codes: ['U'], text: '◆◆' },
  { tier: 'd3', label: '3 Diamond', symbol: 'diamond', count: 3, codes: ['R'], text: '◆◆◆' },
  { tier: 'd4', label: '4 Diamond (ex)', symbol: 'diamond', count: 4, codes: ['RR'], text: '◆◆◆◆' },
  { tier: 's1', label: '1 Star', symbol: 'star', count: 1, codes: ['AR'], text: '★' },
  { tier: 's2', label: '2 Star', symbol: 'star', count: 2, codes: ['SR', 'SAR'], text: '★★' },
  { tier: 's3', label: '3 Star', symbol: 'star', count: 3, codes: ['IM'], text: '★★★' },
  { tier: 'sh1', label: '1 Shiny', symbol: 'shiny', count: 1, codes: ['S'], text: '✦' },
  { tier: 'sh2', label: '2 Shiny', symbol: 'shiny', count: 2, codes: ['SSR'], text: '✦✦' },
  { tier: 'crown', label: 'Crown', symbol: 'crown', count: 1, codes: ['UR'], text: '♛' },
  { tier: 'other', label: 'Other', symbol: 'other', count: 1, codes: [], text: '?' },
];

export const TIER_BY_ID = new Map(TIERS.map((t) => [t.tier, t]));
const TIER_BY_CODE = new Map<string, RarityTier>();
for (const t of TIERS) for (const c of t.codes) TIER_BY_CODE.set(c, t.tier);

export function tierOf(code: string): RarityTier {
  return TIER_BY_CODE.get(code) ?? 'other';
}

export const TIER_RANK = new Map(TIERS.map((t, i) => [t.tier, i]));

/** Section order in trade posts: highest diamonds first, then stars, then shiny. */
export const POST_TIER_ORDER: RarityTier[] = ['d4', 'd3', 'd2', 'd1', 's1', 's2', 'sh1', 'sh2', 's3', 'crown'];

/** The three ★★ styles, in the order the filter shows them. */
export const STAR_STYLES: { style: StarStyle; label: string; short: string; hint: string }[] = [
  { style: 'trainer', label: 'Trainers', short: 'Trainer', hint: 'Full-art Supporter and Item cards' },
  { style: 'fullart', label: 'Full art', short: 'Full art', hint: 'Full-art Pokémon (Super Rare)' },
  { style: 'rainbow', label: 'Rainbow', short: 'Rainbow', hint: 'Rainbow-border special art (Special Art Rare)' },
];
export const STAR_STYLE_BY_ID = new Map(STAR_STYLES.map((s) => [s.style, s]));

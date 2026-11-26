// Which cards go on the "For trade" list, and how many copies of each.
//
// Each rarity is either automatic (every copy above the keep number is offered) or
// "pick" (only cards the user has marked as willing to trade are offered). On top of
// that, any card can be marked "willing to trade" (forTrade) or "never trade" (locked).
import type { Card, RarityTier } from '../data/types';

export interface TradeCtx {
  counts: Record<string, number>;
  locked: Record<string, true>;
  forTrade: Record<string, true>;
  keep: number;
  autoTradeTiers: RarityTier[];
}

/**
 * Rarities where spares go on the For Trade list without being picked. The user keeps
 * 2 of every ◆, ★, ★★ and shiny ✦/✦✦ card and trades the rest; on top of that, any
 * tradeable card can be picked by hand, even with only 1 or 2 copies.
 */
export const DEFAULT_AUTO_TRADE_TIERS: RarityTier[] = ['d1', 'd2', 'd3', 'd4', 's1', 's2', 'sh1', 'sh2'];

/** Spares above the keep number would be offered automatically for this card. */
export function autoQualifies(card: Card, ctx: TradeCtx): boolean {
  return card.tradeable && ctx.autoTradeTiers.includes(card.tier) && (ctx.counts[card.key] ?? 0) > ctx.keep;
}

/** Copies of this card on offer (0 = not on the For Trade list). */
export function tradeCopies(card: Card, ctx: TradeCtx): number {
  if (!card.tradeable || ctx.locked[card.key]) return 0;
  const n = ctx.counts[card.key] ?? 0;
  if (n === 0) return 0;
  // Picked by hand: offer the extras, or one copy if there are no extras.
  if (ctx.forTrade[card.key]) return Math.max(n - ctx.keep, 1);
  return autoQualifies(card, ctx) ? n - ctx.keep : 0;
}

export function isForTrade(card: Card, ctx: TradeCtx): boolean {
  return tradeCopies(card, ctx) > 0;
}

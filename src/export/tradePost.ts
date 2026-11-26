// Builds the Discord trade post in the user's format:
//
//   [Code] 0544647036609326
//
//   ◆◆◆◆
//   [[LF]]
//   [DF] Mega Greninja, Lycanroc,
//
//
//   [[FT]]
//   [RotS] Vespiquen, Typhlosion, ...,
import type { Card, Catalog, RarityTier } from '../data/types';
import { POST_TIER_ORDER, STAR_STYLE_BY_ID, TIER_BY_ID } from '../data/rarity';
import { defaultTag } from '../data/setTags';
import { tradeCtx, type CollectionState, type LfRule, type Settings } from '../state/store';
import { tradeCopies } from '../state/trade';

type PostState = Pick<CollectionState, 'counts' | 'wanted' | 'locked' | 'forTrade' | 'settings'>;

export const DISCORD_LIMIT = 2000;

export function tagFor(catalog: Catalog, settings: Settings, code: string): string {
  const custom = settings.setTags[code]?.trim();
  if (custom) return custom;
  return defaultTag(code, catalog.setByCode.get(code)?.name ?? code);
}

export interface TierLists {
  tier: RarityTier;
  lf: Card[];
  ft: Card[];
}

/** Cards to ask for (LF) and offer (FT) in each rarity, newest set first. */
export function collectLists(
  catalog: Catalog,
  state: PostState,
  tiers: RarityTier[],
  lfRule: LfRule,
): TierLists[] {
  const keep = state.settings.keep;
  const ctx = tradeCtx(state);
  const wanted = new Set(tiers);
  const byTier = new Map<RarityTier, TierLists>();
  for (const t of POST_TIER_ORDER) if (wanted.has(t)) byTier.set(t, { tier: t, lf: [], ft: [] });
  for (const card of catalog.cards) {
    if (card.reprint) continue;
    const lists = byTier.get(card.tier);
    if (!lists) continue;
    const n = state.counts[card.key] ?? 0;
    const isLf = lfRule === 'wanted' ? Boolean(state.wanted[card.key]) : card.tradeable && n < keep;
    if (isLf) lists.lf.push(card);
    if (tradeCopies(card, ctx) > 0) lists.ft.push(card);
  }
  return [...byTier.values()];
}

export function displayName(card: Card, shorten: boolean): string {
  let name = card.name;
  if (shorten) {
    name = name.replace(/^Team Rocket[’']s /, 'TR ');
    // Every ◆◆◆◆ card is an ex, so the suffix is noise there.
    if (card.tier === 'd4') name = name.replace(/ ex$/, '');
  }
  return name;
}

function groupLines(
  catalog: Catalog,
  settings: Settings,
  cards: Card[],
  extra?: (c: Card) => string,
): string[] {
  const groups = new Map<string, Card[]>();
  for (const c of cards) {
    const list = groups.get(c.set) ?? [];
    list.push(c);
    groups.set(c.set, list);
  }
  const lines: string[] = [];
  for (const [set, list] of groups) {
    const names = list.map((c) => displayName(c, settings.post.shortenNames));
    const seen = new Map<string, number>();
    for (const n of names) seen.set(n, (seen.get(n) ?? 0) + 1);
    const parts = list.map((c, i) => {
      const n = names[i];
      // Same name twice in one set (a ★★ full art and its rainbow version): say which.
      const twin = (seen.get(n) ?? 0) > 1;
      const sameStyle = twin && list.filter((o, j) => names[j] === n && o.style === c.style).length > 1;
      const dedupe = !twin ? '' : c.style && !sameStyle ? ` (${STAR_STYLE_BY_ID.get(c.style)!.short})` : ` #${String(c.number).padStart(3, '0')}`;
      return `${n}${dedupe}${extra ? extra(c) : ''}`;
    });
    lines.push(`[${tagFor(catalog, settings, set)}] ${parts.join(', ')},`);
  }
  return lines;
}

export interface TradePost {
  text: string;
  parts: string[];
  lfTotal: number;
  ftTotal: number;
}

export function buildTradePost(
  catalog: Catalog,
  state: PostState,
): TradePost {
  const { settings } = state;
  const opts = settings.post;
  const lists = collectLists(catalog, state, opts.tiers, opts.lfRule);
  const lines: string[] = [];
  if (opts.includeCode && settings.friendCode.trim()) lines.push(`[Code] ${settings.friendCode.trim()}`, '');

  let lfTotal = 0;
  let ftTotal = 0;
  let firstSection = true;
  for (const { tier, lf, ft } of lists) {
    const showLf = opts.includeLf && lf.length > 0;
    const showFt = opts.includeFt && ft.length > 0;
    if (!showLf && !showFt) continue;
    if (!firstSection) lines.push('', '');
    firstSection = false;
    lines.push(TIER_BY_ID.get(tier)?.text ?? tier);
    if (showLf) {
      lfTotal += lf.length;
      lines.push('[[LF]]', ...groupLines(catalog, settings, lf));
    }
    if (showLf && showFt) lines.push('', '');
    if (showFt) {
      ftTotal += ft.length;
      const ctx = tradeCtx(state);
      const spare = opts.showSpareCounts ? (c: Card) => ` x${tradeCopies(c, ctx)}` : undefined;
      lines.push('[[FT]]', ...groupLines(catalog, settings, ft, spare));
    }
  }
  const text = lines.join('\n').trimEnd();
  return { text, parts: splitForDiscord(text, DISCORD_LIMIT), lfTotal, ftTotal };
}

/** Splits at line breaks (then at commas) so each piece fits in one Discord message. */
export function splitForDiscord(text: string, limit: number): string[] {
  if (text.length <= limit) return text ? [text] : [];
  const pieces: string[] = [];
  let current = '';
  const pushLine = (line: string) => {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= limit) {
      current = candidate;
      return;
    }
    if (current) pieces.push(current.trimEnd());
    current = line;
  };
  for (const line of text.split('\n')) {
    if (line.length <= limit) {
      pushLine(line);
      continue;
    }
    // A single very long line: break it after commas.
    let chunk = '';
    for (const bit of line.split(/(?<=,) /)) {
      if ((chunk ? chunk.length + 1 : 0) + bit.length > limit) {
        pushLine(chunk);
        chunk = bit;
      } else chunk = chunk ? `${chunk} ${bit}` : bit;
    }
    if (chunk) pushLine(chunk);
  }
  if (current.trim()) pieces.push(current.trimEnd());
  return pieces;
}

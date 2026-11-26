import type { Card, CardKind, RarityTier, StarStyle } from '../data/types';
import { TIER_RANK } from '../data/rarity';
import { tradeCopies, type TradeCtx } from './trade';

/** "spare" means "on my For Trade list" (the key is kept so saved filters still work). */
export type OwnFilter = 'all' | 'owned' | 'missing' | 'need' | 'extra' | 'spare' | 'wanted' | 'locked';
export type PokeFilter = 'ex' | 'mega' | 'non-ex' | 'basic' | 'stage1' | 'stage2';
export type SortKey = 'set' | 'name' | 'count' | 'rarity' | 'spares';

export interface Filters {
  q: string;
  sets: string[];
  tiers: RarityTier[];
  /** ★★ split: trainers, full-art Pokémon, rainbow special art. */
  styles: StarStyle[];
  own: OwnFilter;
  elements: string[];
  types: CardKind[];
  poke: PokeFilter[];
  packs: string[];
  tradeableOnly: boolean;
  sort: SortKey;
  /** Show set headers. Only applies when sorting by set. */
  group: boolean;
}

export const EMPTY_FILTERS: Filters = {
  q: '',
  sets: [],
  tiers: [],
  styles: [],
  own: 'all',
  elements: [],
  types: [],
  poke: [],
  packs: [],
  tradeableOnly: false,
  sort: 'set',
  group: true,
};

export interface FilterCtx extends TradeCtx {
  wanted: Record<string, true>;
  showReprints: boolean;
  tags: Map<string, string>;
}

type Dim = 'q' | 'sets' | 'tiers' | 'styles' | 'own' | 'elements' | 'types' | 'poke' | 'packs' | 'tradeableOnly';

export const OWN_LABELS: Record<OwnFilter, string> = {
  all: 'All cards',
  owned: 'I have it',
  missing: 'I have none',
  need: 'Below my keep number',
  extra: 'More than my keep number',
  spare: 'On my For Trade list',
  wanted: 'Marked as needed',
  locked: 'Never trade',
};

function matchOwn(card: Card, own: OwnFilter, ctx: FilterCtx): boolean {
  const n = ctx.counts[card.key] ?? 0;
  switch (own) {
    case 'all':
      return true;
    case 'owned':
      return n > 0;
    case 'missing':
      return n === 0;
    case 'need':
      return n < ctx.keep;
    case 'extra':
      return n > ctx.keep;
    case 'spare':
      return tradeCopies(card, ctx) > 0;
    case 'wanted':
      return Boolean(ctx.wanted[card.key]);
    case 'locked':
      return Boolean(ctx.locked[card.key]);
  }
}

function matchPoke(card: Card, p: PokeFilter): boolean {
  switch (p) {
    case 'ex':
      return card.isEx;
    case 'mega':
      return card.isMega;
    case 'non-ex':
      return card.kind === 'pokemon' && !card.isEx;
    case 'basic':
      return card.kind === 'pokemon' && card.stage === 'basic';
    case 'stage1':
      return card.stage === 'stage1';
    case 'stage2':
      return card.stage === 'stage2';
  }
}

function matchQuery(card: Card, q: string, ctx: FilterCtx): boolean {
  const terms = q.toLowerCase().replace(/[’']/g, "'").split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = `${card.search} ${card.set.toLowerCase()} ${(ctx.tags.get(card.set) ?? '').toLowerCase()} #${card.number}`;
  return terms.every((t) => hay.includes(t.replace(/^#0+/, '#')));
}

export function matchCard(card: Card, f: Filters, ctx: FilterCtx, skip?: Dim): boolean {
  // Deluxe Pack reprints share a count with the original, so they are hidden unless
  // asked for (or unless that Deluxe set is picked on its own).
  if (card.reprint && !ctx.showReprints && !f.sets.includes(card.set)) return false;
  if (skip !== 'sets' && f.sets.length && !f.sets.includes(card.set)) return false;
  if (skip !== 'tiers' && f.tiers.length && !f.tiers.includes(card.tier)) return false;
  if (skip !== 'styles' && f.styles?.length && !(card.style && f.styles.includes(card.style))) return false;
  if (skip !== 'tradeableOnly' && f.tradeableOnly && !card.tradeable) return false;
  if (skip !== 'elements' && f.elements.length && !(card.element && f.elements.includes(card.element))) return false;
  if (skip !== 'types' && f.types.length && !f.types.includes(card.kind)) return false;
  if (skip !== 'poke' && f.poke.length && !f.poke.some((p) => matchPoke(card, p))) return false;
  if (skip !== 'packs' && f.packs.length && !card.packs.some((p) => f.packs.includes(`${card.set}|${p}`))) return false;
  if (skip !== 'own' && !matchOwn(card, f.own, ctx)) return false;
  if (skip !== 'q' && f.q && !matchQuery(card, f.q, ctx)) return false;
  return true;
}

export function applyFilters(cards: Card[], f: Filters, ctx: FilterCtx): Card[] {
  const out = cards.filter((c) => matchCard(c, f, ctx));
  const count = (c: Card) => ctx.counts[c.key] ?? 0;
  switch (f.sort) {
    case 'name':
      out.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'count':
      out.sort((a, b) => count(b) - count(a));
      break;
    case 'spares':
      out.sort((a, b) => tradeCopies(b, ctx) - tradeCopies(a, ctx) || count(b) - count(a));
      break;
    case 'rarity':
      out.sort((a, b) => (TIER_RANK.get(b.tier) ?? 0) - (TIER_RANK.get(a.tier) ?? 0));
      break;
    case 'set':
      break; // catalog order is already newest set first
  }
  return out;
}

export interface Facets {
  sets: Map<string, number>;
  tiers: Map<string, number>;
  styles: Map<string, number>;
  own: Map<string, number>;
  elements: Map<string, number>;
  types: Map<string, number>;
  poke: Map<string, number>;
  packs: Map<string, number>;
}

const OWN_KEYS: OwnFilter[] = ['all', 'owned', 'missing', 'need', 'extra', 'spare', 'wanted', 'locked'];
const POKE_KEYS: PokeFilter[] = ['ex', 'mega', 'non-ex', 'basic', 'stage1', 'stage2'];

/** How many cards each filter option would show, given every other active filter. */
export function facetCounts(cards: Card[], f: Filters, ctx: FilterCtx): Facets {
  const facets: Facets = {
    sets: new Map(),
    tiers: new Map(),
    styles: new Map(),
    own: new Map(),
    elements: new Map(),
    types: new Map(),
    poke: new Map(),
    packs: new Map(),
  };
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const c of cards) {
    if (matchCard(c, f, ctx, 'sets')) bump(facets.sets, c.set);
    if (matchCard(c, f, ctx, 'tiers')) bump(facets.tiers, c.tier);
    if (c.style && matchCard(c, f, ctx, 'styles')) bump(facets.styles, c.style);
    if (c.element && matchCard(c, f, ctx, 'elements')) bump(facets.elements, c.element);
    if (matchCard(c, f, ctx, 'types')) bump(facets.types, c.kind);
    if (matchCard(c, f, ctx, 'packs')) for (const p of c.packs) bump(facets.packs, `${c.set}|${p}`);
    if (matchCard(c, f, ctx, 'poke')) for (const p of POKE_KEYS) if (matchPoke(c, p)) bump(facets.poke, p);
    if (matchCard(c, f, ctx, 'own')) for (const o of OWN_KEYS) if (matchOwn(c, o, ctx)) bump(facets.own, o);
  }
  return facets;
}

export interface Preset {
  id: string;
  name: string;
  filters: Partial<Filters>;
}

export const BUILTIN_PRESETS: Preset[] = [
  { id: 'lf-d4', name: '◆◆◆◆ I need', filters: { tiers: ['d4'], own: 'wanted' } },
  { id: 'ft-d4', name: '◆◆◆◆ for trade', filters: { tiers: ['d4'], own: 'spare' } },
  { id: 'all-d4', name: 'All ◆◆◆◆', filters: { tiers: ['d4'] } },
  { id: 'my-s2', name: 'My ★★', filters: { tiers: ['s2'], own: 'owned' } },
  { id: 'ft-s2', name: '★★ for trade', filters: { tiers: ['s2'], own: 'spare' } },
  { id: 'my-s1', name: 'My ★', filters: { tiers: ['s1'], own: 'owned' } },
  { id: 'wanted', name: 'Everything I need', filters: { own: 'wanted' } },
  { id: 'spares', name: 'Everything for trade', filters: { own: 'spare' } },
  { id: 'missing-star', name: 'Missing ★', filters: { tiers: ['s1'], own: 'missing' } },
];

export function withPreset(p: Preset): Filters {
  return { ...EMPTY_FILTERS, ...p.filters };
}

export function activeFilterCount(f: Filters): number {
  return (
    (f.q ? 1 : 0) +
    f.sets.length +
    f.tiers.length +
    (f.styles?.length ?? 0) +
    (f.own !== 'all' ? 1 : 0) +
    f.elements.length +
    f.types.length +
    f.poke.length +
    f.packs.length +
    (f.tradeableOnly ? 1 : 0)
  );
}

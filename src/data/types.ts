// Shapes of the community card database (github.com/flibustier/pokemon-tcg-pocket-database)
// and the normalized catalog the app builds from it.

export interface RawCard {
  set: string;
  number: number;
  name: string;
  rarity: string;
  image: string;
  packs?: string[];
  element?: string;
  type?: string;
  stage?: string | number;
  health?: number;
  retreatCost?: number;
  weakness?: string;
  evolvesFrom?: string;
}

export interface RawSet {
  code: string;
  releaseDate: string;
  count?: number;
  name: Record<string, string>;
  packs?: string[];
}

export type RawSets = Record<string, RawSet[]>;

export interface RawRarity {
  label: string;
  image?: string;
  count?: number;
  group: string;
  tradeable: boolean;
  tradePrice: number | null;
  points?: number;
}

export type RawRarities = Record<string, RawRarity>;

export interface RawBundle {
  sets: RawSets;
  cards: RawCard[];
  rarities: RawRarities;
  /** ISO time the data was downloaded. */
  fetchedAt: string;
  /** Where it came from: "bundled" or a host name. */
  source: string;
}

/** Filter-level rarity groups, matching the symbols the game shows. */
export type RarityTier = 'd1' | 'd2' | 'd3' | 'd4' | 's1' | 's2' | 's3' | 'sh1' | 'sh2' | 'crown' | 'other';

/**
 * The three kinds of ★★ card, which the game lumps together:
 * full-art trainers, full-art Pokémon (Super Rare) and rainbow special art (Special Art Rare).
 */
export type StarStyle = 'trainer' | 'fullart' | 'rainbow';

export type CardKind = 'pokemon' | 'supporter' | 'item' | 'tool' | 'stadium' | 'fossil' | 'other';
export type Stage = 'basic' | 'stage1' | 'stage2';

export interface CardSet {
  code: string;
  name: string;
  series: string;
  releaseDate: string;
  packs: string[];
  isDeluxe: boolean;
  isPromo: boolean;
  isSpecial: boolean;
  /** 0 = newest. */
  order: number;
}

export interface Card {
  /** Unique per printing: `${set}-${number}`. */
  id: string;
  /** The game's card id, shared by Deluxe Pack reprints. Counts are stored by this. */
  key: string;
  set: string;
  number: number;
  name: string;
  rarity: string;
  tier: RarityTier;
  /** Only set on ★★ cards. */
  style?: StarStyle;
  element?: string;
  kind: CardKind;
  stage?: Stage;
  isEx: boolean;
  isMega: boolean;
  packs: string[];
  health?: number;
  tradeable: boolean;
  /** True when an older set already has this exact card (Deluxe Pack reprints). */
  reprint: boolean;
  /** Ids of every printing of this card, oldest first. */
  printings: string[];
  image: string;
  /** Lowercased name for searching. */
  search: string;
}

export interface Catalog {
  sets: CardSet[];
  setByCode: Map<string, CardSet>;
  cards: Card[];
  byId: Map<string, Card>;
  /** Canonical (oldest) printing for each game card id. */
  byKey: Map<string, Card>;
  rarities: RawRarities;
  fetchedAt: string;
  source: string;
  elements: string[];
}

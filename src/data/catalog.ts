import type { Card, CardKind, CardSet, Catalog, RawBundle, Stage, StarStyle } from './types';
import { tierOf } from './rarity';

/** The game's own card id, e.g. "cPK_10_000360_00" from "cPK_10_000360_00_LIZARDONex_RR.webp". */
export function cardKey(image: string, fallback: string): string {
  const parts = image.replace(/\.\w+$/, '').split('_');
  return parts.length >= 4 ? parts.slice(0, 4).join('_') : fallback;
}

function kindOf(type: string | undefined): CardKind {
  switch ((type ?? '').toLowerCase()) {
    case 'pokemon':
      return 'pokemon';
    case 'supporter':
      return 'supporter';
    case 'item':
      return 'item';
    case 'tool':
      return 'tool';
    case 'stadium':
      return 'stadium';
    case 'fossil':
      return 'fossil';
    default:
      return 'other';
  }
}

function stageOf(stage: string | number | undefined): Stage | undefined {
  if (stage === 'basic') return 'basic';
  if (stage === 1 || stage === '1') return 'stage1';
  if (stage === 2 || stage === '2') return 'stage2';
  return undefined;
}

/** Splits ★★ into trainers, full-art Pokémon and rainbow special art. */
function styleOf(rarity: string, kind: CardKind): StarStyle | undefined {
  if (rarity === 'SAR') return 'rainbow';
  if (rarity === 'SR') return kind === 'pokemon' ? 'fullart' : 'trainer';
  return undefined;
}

function category(s: CardSet): number {
  if (s.isPromo) return 3;
  if (s.isSpecial) return 2;
  if (s.isDeluxe) return 1;
  return 0;
}

export function buildCatalog(raw: RawBundle): Catalog {
  // Flatten sets and sort newest first; on the same release day the main set comes
  // first, then deluxe, special and promo sets.
  const sets: CardSet[] = [];
  for (const [series, list] of Object.entries(raw.sets)) {
    for (const s of list) {
      const name = s.name.en ?? s.code;
      sets.push({
        code: s.code,
        name,
        series,
        releaseDate: s.releaseDate,
        packs: s.packs ?? [],
        isDeluxe: /deluxe/i.test(name),
        isPromo: s.code.toUpperCase().startsWith('PROMO'),
        isSpecial: series.toLowerCase() === 'special',
        order: 0,
      });
    }
  }
  // Cards may reference a set the sets file doesn't list yet (it happens right after a
  // release); give those a placeholder so they still show up.
  const known = new Set(sets.map((s) => s.code));
  for (const c of raw.cards) {
    if (!known.has(c.set)) {
      known.add(c.set);
      sets.push({
        code: c.set,
        name: c.set,
        series: c.set.replace(/\d.*$/, ''),
        releaseDate: '9999-12-31',
        packs: [],
        isDeluxe: false,
        isPromo: c.set.toUpperCase().startsWith('PROMO'),
        isSpecial: false,
        order: 0,
      });
    }
  }
  sets.sort((a, b) => (a.releaseDate === b.releaseDate ? category(a) - category(b) : a.releaseDate < b.releaseDate ? 1 : -1));
  sets.forEach((s, i) => (s.order = i));
  const setByCode = new Map(sets.map((s) => [s.code, s]));

  // Walk cards oldest set first so the first printing of a card id is the canonical one.
  const sorted = [...raw.cards].sort((a, b) => {
    const sa = setByCode.get(a.set)!;
    const sb = setByCode.get(b.set)!;
    return sa.order === sb.order ? a.number - b.number : sb.order - sa.order;
  });

  const byKey = new Map<string, Card>();
  const byId = new Map<string, Card>();
  const cards: Card[] = [];
  const elements = new Set<string>();

  for (const rc of sorted) {
    const id = `${rc.set}-${rc.number}`;
    const key = cardKey(rc.image, id);
    const canonical = byKey.get(key);
    const rarityInfo = raw.rarities[rc.rarity];
    const kind = kindOf(rc.type);
    const card: Card = {
      id,
      key,
      set: rc.set,
      number: rc.number,
      name: rc.name,
      rarity: rc.rarity,
      tier: tierOf(rc.rarity),
      style: styleOf(rc.rarity, kind),
      element: rc.element ?? undefined,
      kind,
      stage: stageOf(rc.stage),
      isEx: /\bex$/.test(rc.name),
      isMega: /^Mega /.test(rc.name),
      packs: rc.packs ?? [],
      health: rc.health,
      tradeable: rarityInfo?.tradeable ?? false,
      reprint: Boolean(canonical),
      printings: [],
      image: rc.image,
      search: rc.name.toLowerCase().replace(/[’']/g, "'"),
    };
    if (canonical) {
      canonical.printings.push(id);
      card.printings = canonical.printings;
    } else {
      card.printings.push(id);
      byKey.set(key, card);
    }
    if (card.element) elements.add(card.element);
    cards.push(card);
    byId.set(id, card);
  }

  // Display order: newest set first, then card number.
  cards.sort((a, b) => {
    const sa = setByCode.get(a.set)!;
    const sb = setByCode.get(b.set)!;
    return sa.order === sb.order ? a.number - b.number : sa.order - sb.order;
  });

  const ELEMENT_ORDER = ['grass', 'fire', 'water', 'lightning', 'psychic', 'fighting', 'darkness', 'metal', 'dragon', 'fairy', 'colorless'];
  const elementList = [...elements].sort((a, b) => {
    const ia = ELEMENT_ORDER.indexOf(a);
    const ib = ELEMENT_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  return {
    sets,
    setByCode,
    cards,
    byId,
    byKey,
    rarities: raw.rarities,
    fetchedAt: raw.fetchedAt,
    source: raw.source,
    elements: elementList,
  };
}

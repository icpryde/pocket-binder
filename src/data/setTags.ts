// Short set tags used in trade posts ("[RotS] Vespiquen, ...").
// The first six match the user's existing posts; the rest follow the same style.
// Anything not listed (a brand new expansion) gets an automatic acronym, and every
// tag can be changed in Settings.
const DEFAULT_TAGS: Record<string, string> = {
  C1: 'DF',
  B4b: 'DPM',
  B4a: 'TRA',
  B4: 'RotS',
  B3b: 'EW',
  B3a: 'PD',
  B3: 'PA',
  B2b: 'MS',
  B2a: 'PW',
  B2: 'FP',
  B1a: 'CB',
  B1: 'MR',
  A4b: 'DPex',
  A4a: 'SS',
  A4: 'WoSS',
  A3b: 'EG',
  A3a: 'EC',
  A3: 'CG',
  A2b: 'SR',
  A2a: 'TL',
  A2: 'STS',
  A1a: 'MI',
  A1: 'GA',
  'PROMO-A': 'P-A',
  'PROMO-B': 'P-B',
  'PROMO-C': 'P-C',
  SP1: 'SP1',
};

const SMALL_WORDS = new Set(['of', 'the', 'and', 'a', 'an', 'in', 'on', 'to']);

export function autoTag(name: string): string {
  const words = name
    .replace(/[’']s\b/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);
  const tag = words
    .map((w) => (SMALL_WORDS.has(w.toLowerCase()) ? w[0].toLowerCase() : w[0].toUpperCase()))
    .join('');
  return tag || name.slice(0, 3);
}

export function defaultTag(code: string, name: string): string {
  return DEFAULT_TAGS[code] ?? autoTag(name);
}

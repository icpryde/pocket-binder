// Loads the card database. Order of preference:
//   1. the copy saved in this browser (IndexedDB) from a previous download,
//   2. the snapshot bundled with the app (public/data),
// and then, in the background, a fresh download from GitHub (jsDelivr as backup).
// New expansions show up as soon as the community database adds them.
import { get, set } from 'idb-keyval';
import type { RawBundle, RawCard, RawRarities, RawSets } from './types';

const CACHE_KEY = 'card-db-v1';
const REMOTE_BASES = [
  'https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/',
  'https://cdn.jsdelivr.net/npm/pokemon-tcg-pocket-database@latest/dist/',
];
/** How old the saved copy may get before the app quietly checks for new cards. */
export const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return (await res.json()) as T;
}

async function fetchFrom(base: string, source: string, fetchedAt?: string): Promise<RawBundle> {
  const [sets, cards, rarities] = await Promise.all([
    getJson<RawSets>(base + 'sets.json'),
    getJson<RawCard[]>(base + 'cards.extra.json'),
    getJson<RawRarities>(base + 'rarities.json'),
  ]);
  if (!Array.isArray(cards) || cards.length < 100) throw new Error('Card list looks incomplete');
  return { sets, cards, rarities, fetchedAt: fetchedAt ?? new Date().toISOString(), source };
}

export async function loadSaved(): Promise<RawBundle | null> {
  try {
    return ((await get(CACHE_KEY)) as RawBundle | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function loadBundled(): Promise<RawBundle> {
  let fetchedAt = '2026-11-25T00:00:00.000Z';
  try {
    fetchedAt = (await getJson<{ updatedAt: string }>('./data/snapshot-info.json')).updatedAt;
  } catch {
    /* keep default */
  }
  return fetchFrom('./data/', 'bundled', fetchedAt);
}

export async function downloadLatest(): Promise<RawBundle> {
  let lastError: unknown;
  for (const base of REMOTE_BASES) {
    try {
      const bundle = await fetchFrom(base, new URL(base).host);
      try {
        await set(CACHE_KEY, bundle);
      } catch {
        /* storage full or blocked: still use it for this session */
      }
      return bundle;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not download card data');
}

/** Short fingerprint to tell whether a download changed anything. */
export function signature(b: RawBundle): string {
  const codes = Object.values(b.sets)
    .flat()
    .map((s) => `${s.code}:${s.count ?? ''}`)
    .join(',');
  return `${b.cards.length}|${codes}`;
}

/** Sets present in `next` but not in `prev`, with their card counts. */
export function newSets(prev: RawBundle, next: RawBundle): { code: string; name: string; added: number }[] {
  const before = new Map<string, number>();
  for (const c of prev.cards) before.set(c.set, (before.get(c.set) ?? 0) + 1);
  const after = new Map<string, number>();
  for (const c of next.cards) after.set(c.set, (after.get(c.set) ?? 0) + 1);
  const names = new Map(Object.values(next.sets).flat().map((s) => [s.code, s.name.en ?? s.code]));
  const out: { code: string; name: string; added: number }[] = [];
  for (const [code, n] of after) {
    const added = n - (before.get(code) ?? 0);
    if (added > 0) out.push({ code, name: names.get(code) ?? code, added });
  }
  return out;
}

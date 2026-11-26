// Three-way merge of the parts of the collection that sync between devices.
//
// base   = what this device last saw on GitHub (or the starting collection before the
//          first sync), local = this device now, remote = GitHub now. Whatever this
//          device changed since base wins; everything else comes from remote. So a count
//          changed on the phone and a need marked on the Mac both survive.
import type { CollectionState, LogEntry, TradeRecord } from '../state/store';

export const SYNC_FIELDS = ['counts', 'wanted', 'locked', 'forTrade', 'settings', 'presets', 'trades', 'log'] as const;
export type Synced = Pick<CollectionState, (typeof SYNC_FIELDS)[number]>;

export function pickSynced(s: Synced): Synced {
  return {
    counts: s.counts,
    wanted: s.wanted,
    locked: s.locked,
    forTrade: s.forTrade,
    settings: s.settings,
    presets: s.presets,
    trades: s.trades,
    log: s.log,
  };
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) out[k] = sortKeys((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

/** JSON with sorted keys, so equal data always gives equal text. */
export function stable(v: unknown, indent?: number): string {
  return JSON.stringify(sortKeys(v), null, indent);
}

export function sameSynced(a: Synced, b: Synced): boolean {
  return stable(pickSynced(a)) === stable(pickSynced(b));
}

function mergeMap<T>(base: Record<string, T>, local: Record<string, T>, remote: Record<string, T>): Record<string, T> {
  const out = { ...remote };
  for (const k of new Set([...Object.keys(base), ...Object.keys(local)])) {
    if (stable(local[k]) === stable(base[k])) continue;
    if (local[k] === undefined) delete out[k];
    else out[k] = local[k];
  }
  return out;
}

function mergeList<T>(base: T[], local: T[], remote: T[], id: (x: T) => string, cap: number): T[] {
  const known = new Set(base.map(id));
  const seen = new Set(remote.map(id));
  const out = [...remote];
  for (const x of local) {
    const k = id(x);
    if (!known.has(k) && !seen.has(k)) {
      out.push(x);
      seen.add(k);
    }
  }
  out.sort((a, b) => ((a as { t: number }).t ?? 0) - ((b as { t: number }).t ?? 0));
  return out.length > cap ? out.slice(out.length - cap) : out;
}

const logId = (e: LogEntry) => `${e.t}|${e.key}|${e.from}|${e.to}`;
const tradeId = (e: TradeRecord) => `${e.t}|${e.give ?? ''}|${e.get ?? ''}`;

export function merge(base: Synced, local: Synced, remote: Synced): Synced {
  const settings = { ...remote.settings } as Record<string, unknown>;
  const b = base.settings as unknown as Record<string, unknown>;
  const l = local.settings as unknown as Record<string, unknown>;
  for (const k of Object.keys(l)) if (stable(l[k]) !== stable(b[k])) settings[k] = l[k];
  return {
    counts: mergeMap(base.counts, local.counts, remote.counts),
    wanted: mergeMap(base.wanted, local.wanted, remote.wanted),
    locked: mergeMap(base.locked, local.locked, remote.locked),
    forTrade: mergeMap(base.forTrade, local.forTrade, remote.forTrade),
    settings: settings as unknown as Synced['settings'],
    presets: stable(local.presets) !== stable(base.presets) ? local.presets : remote.presets,
    trades: mergeList(base.trades, local.trades, remote.trades, tradeId, 300),
    log: mergeList(base.log, local.log, remote.log, logId, 1000),
  };
}

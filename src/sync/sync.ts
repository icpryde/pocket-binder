// Keeps this device's collection in step with collection.json on GitHub.
//
// Changes save about a second after you make them. Other devices pick them up within
// 30 seconds while the app is open, and right away when you switch back to it.
// Without a token the app works exactly as before, on this device only.
import { useSyncExternalStore } from 'react';
import { normalizeState, notify, startingCollection, store } from '../state/store';
import { checkToken, GitHubError, readRemote, writeRemote } from './github';
import { merge, pickSynced, sameSynced, stable, type Synced } from './merge';

const TOKEN_KEY = 'pocket-binder:sync-token:v1';
const BASE_KEY = 'pocket-binder:sync-base:v1';
const LAST_KEY = 'pocket-binder:sync-last:v1';

export type SyncState = 'off' | 'syncing' | 'saving' | 'synced' | 'offline' | 'error';
export type SyncProblem = 'expired' | 'perms' | null;

export interface SyncStatus {
  connected: boolean;
  state: SyncState;
  text: string;
  problem: SyncProblem;
  lastSynced: number;
}

const TEXT: Record<SyncState, string> = {
  off: 'Not syncing',
  syncing: 'Syncing…',
  saving: 'Saving…',
  synced: 'Synced',
  offline: 'Offline · will sync later',
  error: 'Sync problem',
};

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
}

let token: string | null = readLS(TOKEN_KEY);
let status: SyncStatus = {
  connected: Boolean(token),
  state: token ? 'syncing' : 'off',
  text: token ? TEXT.syncing : TEXT.off,
  problem: null,
  lastSynced: Number(readLS(LAST_KEY)) || 0,
};
const listeners = new Set<() => void>();

function setStatus(state: SyncState, text = TEXT[state], problem: SyncProblem = null) {
  status = { ...status, connected: Boolean(token), state, text, problem };
  listeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => status,
  );
}

function device(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'browser';
}

function loadBase(): Synced {
  const text = readLS(BASE_KEY);
  if (text) {
    try {
      return pickSynced(normalizeState(JSON.parse(text)));
    } catch {
      /* fall through */
    }
  }
  // Never synced: every device started from the same collection, so diff against that.
  return pickSynced(startingCollection());
}

function describe(base: Synced, local: Synced): string {
  let cards = 0;
  for (const field of ['counts', 'wanted', 'locked', 'forTrade'] as const) {
    const a = base[field] as Record<string, unknown>;
    const b = local[field] as Record<string, unknown>;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) cards += 1;
  }
  const where = `from ${device()}`;
  if (cards === 0) return `Update settings ${where}`;
  return `Update ${cards} card${cards === 1 ? '' : 's'} ${where}`;
}

let running = false;
let again = false;
let timer: number | undefined;
let lastRead = 0;
let dirty = false;
let applying = false;
let started = false;

function schedule(ms: number) {
  window.clearTimeout(timer);
  timer = window.setTimeout(syncNow, ms);
}

export async function syncNow(): Promise<void> {
  window.clearTimeout(timer);
  if (!token) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  again = false;
  let failed = false;
  if (status.state !== 'saving') setStatus('syncing');
  try {
    for (let attempt = 0; ; attempt++) {
      const remote = await readRemote(token);
      lastRead = Date.now();
      const base = loadBase();
      const local = pickSynced(store.get());
      const remoteData = remote.data ? pickSynced(normalizeState(remote.data)) : null;
      // First device to sync: its collection becomes the shared one.
      const merged = remoteData ? merge(base, local, remoteData) : local;
      if (!remoteData || !sameSynced(merged, remoteData)) {
        try {
          const message = remoteData ? describe(base, local) : `Start the shared collection from ${device()}`;
          await writeRemote(token, merged, remote.sha, message, device());
        } catch (err) {
          // Another device saved first: read again, merge again, try again.
          if (err instanceof GitHubError && (err.status === 409 || err.status === 422) && attempt < 3) continue;
          throw err;
        }
      }
      writeLS(BASE_KEY, stable(merged));
      // Keep anything changed on this device while the sync was running.
      const current = pickSynced(store.get());
      const next = merge(local, current, merged);
      if (!sameSynced(next, current)) {
        const fromElsewhere = !sameSynced(merged, local);
        applying = true;
        store.applySynced({ ...store.get(), ...next });
        applying = false;
        if (fromElsewhere) notify('Updated with changes from your other device');
      }
      dirty = !sameSynced(next, merged);
      break;
    }
    status.lastSynced = Date.now();
    writeLS(LAST_KEY, String(status.lastSynced));
    setStatus(dirty ? 'saving' : 'synced');
  } catch (err) {
    failed = true;
    handleError(err);
  } finally {
    running = false;
    if (again) schedule(300);
    else if (dirty && status.problem === null) schedule(failed ? 15000 : 1200);
  }
}

function handleError(err: unknown) {
  const e = err instanceof GitHubError ? err : null;
  if (e?.status === 401) setStatus('error', 'Token expired or deleted · reconnect', 'expired');
  else if (e && ((e.status === 403 && !e.rateLimited) || e.status === 404)) setStatus('error', "Token can't save to pocket-binder · fix it", 'perms');
  else if (e?.rateLimited) setStatus('error', 'GitHub asked to slow down · retrying soon');
  else if (!e || !navigator.onLine) setStatus('offline');
  else setStatus('error', "Couldn't reach GitHub · retrying");
}

/** Wires sync into the app: saves after changes, checks GitHub every 30 s and on return. */
export function startSync() {
  if (started) return;
  started = true;
  store.subscribe(() => {
    if (!token || applying || status.problem) return;
    if (sameSynced(pickSynced(store.get()), loadBase())) return;
    dirty = true;
    setStatus('saving');
    schedule(1200);
  });
  window.setInterval(() => {
    if (!token || running || document.visibilityState !== 'visible' || status.problem) return;
    if (Date.now() - lastRead >= 29000) syncNow();
  }, 10000);
  document.addEventListener('visibilitychange', () => {
    if (!token || status.problem) return;
    if (document.visibilityState === 'visible') {
      if (Date.now() - lastRead > 5000) syncNow();
    } else if (dirty) syncNow();
  });
  window.addEventListener('online', () => syncNow());
  if (token) syncNow();
}

/** Checks the token, saves it on this device and syncs. Returns an error message or null. */
export async function connect(input: string): Promise<string | null> {
  const t = input.trim();
  if (!t) return 'Paste your token first.';
  let check: Awaited<ReturnType<typeof checkToken>>;
  try {
    check = await checkToken(t);
  } catch {
    return "Couldn't reach GitHub. Check your connection and try again.";
  }
  if (check === 'bad') return "GitHub didn't accept that token. Make sure you copied all of it.";
  if (check === 'no-access') return "That token can't see the pocket-binder repo. Pick it under Repository access.";
  token = t;
  writeLS(TOKEN_KEY, t);
  setStatus('syncing');
  await syncNow();
  return null;
}

export function retry() {
  setStatus('syncing');
  syncNow();
}

export function disconnect() {
  token = null;
  writeLS(TOKEN_KEY, null);
  // The last-synced copy stays, so reconnecting later merges correctly.
  window.clearTimeout(timer);
  dirty = false;
  setStatus('off');
}

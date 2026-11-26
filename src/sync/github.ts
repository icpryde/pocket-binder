// Reads and writes collection.json on the repo's "data" branch through the GitHub
// contents API. Saving there doesn't trigger a site rebuild (that only runs for main).
import { stable, type Synced } from './merge';

export const REPO = { owner: 'icpryde', repo: 'pocket-binder', branch: 'data', path: 'collection.json' };
const API = `https://api.github.com/repos/${REPO.owner}/${REPO.repo}/contents/${REPO.path}`;
// Commits are signed with GitHub's no-reply address so no personal email lands in the public repo.
const AUTHOR = { name: 'icpryde', email: '29389746+icpryde@users.noreply.github.com' };

export class GitHubError extends Error {
  status: number;
  rateLimited: boolean;
  constructor(message: string, status: number, rateLimited: boolean) {
    super(message);
    this.status = status;
    this.rateLimited = rateLimited;
  }
}

function headers(token: string | null, json = false): HeadersInit {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function fail(res: Response): Promise<GitHubError> {
  let msg = '';
  try {
    msg = (await res.json()).message ?? '';
  } catch {
    /* no body */
  }
  const limited = res.status === 429 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0');
  return new GitHubError(msg || `GitHub answered ${res.status}`, res.status, limited);
}

function toBase64(text: string): string {
  let bin = '';
  new TextEncoder().encode(text).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export interface RemoteFile {
  sha: string | null;
  data: Partial<Synced> | null;
}

export async function readRemote(token: string): Promise<RemoteFile> {
  const res = await fetch(`${API}?ref=${REPO.branch}&t=${Date.now()}`, { headers: headers(token), cache: 'no-store' });
  if (res.status === 404) {
    // No file yet. A 404 can also mean the token can't see the repo; check that apart.
    const repo = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}`, { headers: headers(token), cache: 'no-store' });
    if (!repo.ok) throw await fail(repo);
    return { sha: null, data: null };
  }
  if (!res.ok) throw await fail(res);
  const j = await res.json();
  const parsed = JSON.parse(fromBase64(j.content));
  return { sha: j.sha, data: parsed.collection ?? null };
}

export async function writeRemote(token: string, data: Synced, sha: string | null, message: string, device: string) {
  const file = { app: 'pocket-binder', version: 1, updated: new Date().toISOString(), device, collection: data };
  const body: Record<string, unknown> = {
    message,
    branch: REPO.branch,
    content: toBase64(stable(file, 1) + '\n'),
    author: AUTHOR,
    committer: AUTHOR,
  };
  if (sha) body.sha = sha;
  const res = await fetch(API, { method: 'PUT', headers: headers(token, true), body: JSON.stringify(body) });
  if (!res.ok) throw await fail(res);
}

/** 'ok', 'bad' (GitHub rejects the token) or 'no-access' (it can't see the repo). */
export async function checkToken(token: string): Promise<'ok' | 'bad' | 'no-access'> {
  const res = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}`, { headers: headers(token), cache: 'no-store' });
  if (res.status === 401) return 'bad';
  if (!res.ok) return 'no-access';
  return 'ok';
}

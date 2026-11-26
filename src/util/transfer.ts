// Backups and moving the collection between devices (Mac ↔ iPhone) without a server.
import { normalizeState, type CollectionState } from '../state/store';

const PREFIX = 'PB1.';

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const body = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

/** A short text code holding counts, needs, trade marks, settings and saved filters. */
export async function makeTransferCode(state: CollectionState): Promise<string> {
  const { counts, wanted, locked, forTrade, settings, presets } = state;
  const json = JSON.stringify({ counts, wanted, locked, forTrade, settings, presets });
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream('gzip'));
  return PREFIX + toBase64Url(packed);
}

export async function readTransferCode(code: string, current: CollectionState): Promise<CollectionState> {
  const trimmed = code.trim().replace(/\s+/g, '');
  if (!trimmed.startsWith(PREFIX)) throw new Error('That is not a Pocket Binder transfer code.');
  const bytes = await pipe(fromBase64Url(trimmed.slice(PREFIX.length)), new DecompressionStream('gzip'));
  const data = JSON.parse(new TextDecoder().decode(bytes));
  return normalizeState({ ...current, ...data, log: current.log, trades: current.trades });
}

export function downloadBackup(state: CollectionState) {
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `pocket-binder-backup-${date}.json`);
}

export async function readBackupFile(file: File): Promise<CollectionState> {
  const data = JSON.parse(await file.text());
  if (!data || typeof data !== 'object' || !data.counts) throw new Error('That file is not a Pocket Binder backup.');
  return normalizeState(data);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

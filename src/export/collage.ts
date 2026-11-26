// Draws the image export: sections of card art (Looking for / For trade / Everything
// I have) with the friend code on top, ready to post or save. Long lists are split
// into several images, because Discord shrinks one very tall image until the cards
// are unreadable.
import type { Card } from '../data/types';
import { imageCandidates } from '../data/images';

export interface CollageBlock {
  title: string;
  color: string;
  items: { card: Card; caption: string; badge?: string }[];
}

export interface CollageOptions {
  columns: number;
  /** Card rows per image; 0 = everything in one image. */
  rowsPerImage: number;
  theme: 'dark' | 'light';
  heading: string;
  subheading?: string;
  showCaptions: boolean;
}

/** A section as it appears on one image (a long section continues on the next). */
interface PageBlock extends CollageBlock {
  total: number;
  continued: boolean;
}

const CARD_W = 220;
const CARD_H = Math.round(CARD_W / 0.7168); // card art is 367×512
const GAP = 14;
const PAD = 36;
const CAPTION_H = 26;
const HEADER_H = 96;
const SECTION_H = 64;
// Safari refuses canvases above ~16.7M pixels; stay under that.
const MAX_PIXELS = 16_000_000;

function loadImage(urls: string[]): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let i = 0;
    const tryNext = () => {
      if (i >= urls.length) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => {
        i += 1;
        tryNext();
      };
      img.src = urls[i];
    };
    tryNext();
  });
}

async function loadAll(cards: Card[], onProgress?: (done: number, total: number) => void) {
  const out = new Map<string, HTMLImageElement | null>();
  const unique = [...new Map(cards.map((c) => [c.id, c])).values()];
  let done = 0;
  let next = 0;
  const worker = async () => {
    while (next < unique.length) {
      const card = unique[next++];
      // The larger scans keep the cards sharp at this size.
      out.set(card.id, await loadImage(imageCandidates(card, 'large')));
      onProgress?.(++done, unique.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(12, unique.length) }, worker));
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Splits sections into images of at most `rows` card rows each. */
export function paginate(blocks: CollageBlock[], cols: number, rows: number): PageBlock[][] {
  const full = blocks.filter((b) => b.items.length);
  if (!rows) return [full.map((b) => ({ ...b, total: b.items.length, continued: false }))];
  const pages: PageBlock[][] = [];
  let page: PageBlock[] = [];
  let left = rows;
  for (const b of full) {
    for (let i = 0; i < b.items.length; ) {
      if (left === 0) {
        pages.push(page);
        page = [];
        left = rows;
      }
      const take = Math.min(b.items.length - i, left * cols);
      page.push({ ...b, items: b.items.slice(i, i + take), total: b.items.length, continued: i > 0 });
      left -= Math.ceil(take / cols);
      i += take;
    }
  }
  if (page.length || !pages.length) pages.push(page);
  return pages;
}

export async function renderCollage(
  blocks: CollageBlock[],
  opts: CollageOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob[]> {
  const cols = Math.max(2, Math.min(16, opts.columns));
  const pages = paginate(blocks, cols, Math.max(0, opts.rowsPerImage));
  const images = await loadAll(
    pages.flat().flatMap((b) => b.items.map((i) => i.card)),
    onProgress,
  );
  const out: Blob[] = [];
  for (let p = 0; p < pages.length; p++) {
    const heading = pages.length > 1 ? `${opts.heading}  ·  ${p + 1}/${pages.length}` : opts.heading;
    out.push(await renderPage(pages[p], { ...opts, heading }, cols, images));
  }
  return out;
}

async function renderPage(
  blocksWithCards: PageBlock[],
  opts: CollageOptions,
  cols: number,
  images: Map<string, HTMLImageElement | null>,
): Promise<Blob> {
  const cellH = CARD_H + (opts.showCaptions ? CAPTION_H : 0) + GAP;
  const width = PAD * 2 + cols * CARD_W + (cols - 1) * GAP;
  let height = PAD + HEADER_H;
  for (const b of blocksWithCards) height += SECTION_H + Math.ceil(b.items.length / cols) * cellH + 12;
  height += PAD;
  if (!blocksWithCards.length) height += 80;

  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (width * height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw images');
  ctx.scale(scale, scale);

  const dark = opts.theme === 'dark';
  const bg = dark ? '#0f1424' : '#f3f5fa';
  const fg = dark ? '#eef2ff' : '#141a2e';
  const muted = dark ? '#8f9bbd' : '#5a6480';
  const tile = dark ? '#1b2340' : '#ffffff';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const font = (weight: number, size: number) =>
    `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  // Header
  ctx.fillStyle = fg;
  ctx.font = font(800, 34);
  ctx.textBaseline = 'top';
  ctx.fillText(opts.heading, PAD, PAD);
  if (opts.subheading) {
    ctx.fillStyle = muted;
    ctx.font = font(600, 20);
    ctx.fillText(opts.subheading, PAD, PAD + 46);
  }

  let y = PAD + HEADER_H;
  if (!blocksWithCards.length) {
    ctx.fillStyle = muted;
    ctx.font = font(600, 22);
    ctx.fillText('Nothing to show with these settings.', PAD, y);
  }
  for (const block of blocksWithCards) {
    // Section title pill
    ctx.font = font(800, 24);
    const label = `${block.title} (${block.total})${block.continued ? ', continued' : ''}`;
    const lw = ctx.measureText(label).width + 32;
    ctx.fillStyle = block.color;
    roundRect(ctx, PAD, y + 8, lw, 40, 20);
    ctx.fill();
    ctx.fillStyle = '#0b0f1c';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, PAD + 16, y + 29);
    ctx.textBaseline = 'top';
    y += SECTION_H;

    block.items.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = PAD + col * (CARD_W + GAP);
      const cy = y + row * cellH;
      const img = images.get(item.card.id);
      ctx.save();
      roundRect(ctx, x, cy, CARD_W, CARD_H, 10);
      ctx.clip();
      if (img) ctx.drawImage(img, x, cy, CARD_W, CARD_H);
      else {
        ctx.fillStyle = tile;
        ctx.fillRect(x, cy, CARD_W, CARD_H);
        ctx.fillStyle = fg;
        ctx.font = font(700, 16);
        ctx.fillText(item.card.name, x + 10, cy + 12, CARD_W - 20);
      }
      ctx.restore();

      if (item.badge) {
        ctx.font = font(800, 18);
        const bw = ctx.measureText(item.badge).width + 16;
        ctx.fillStyle = 'rgba(8, 12, 24, 0.86)';
        roundRect(ctx, x + CARD_W - bw - 6, cy + CARD_H - 34, bw, 28, 14);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.badge, x + CARD_W - bw + 2, cy + CARD_H - 20);
        ctx.textBaseline = 'top';
      }
      if (opts.showCaptions) {
        ctx.fillStyle = muted;
        ctx.font = font(700, 15);
        ctx.fillText(item.caption, x + 2, cy + CARD_H + 5, CARD_W - 4);
      }
    });
    y += Math.ceil(block.items.length / cols) * cellH + 12;
  }

  return new Promise((resolve, reject) =>
    // JPEG keeps each image under ~1 MB, so several upload quickly from a phone.
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/jpeg', 0.92),
  );
}

import type { Card } from './types';

// Card art comes from three public hosts, tried in order until one works:
//  - pokemon-tcg.exchange: small thumbnails for every set (same project as the card data)
//  - Limitless TCG: sharper scans (367×512)
//  - TCGdex: older sets only, last resort
// All three allow other sites to draw the images, which the collage export needs.

const pad3 = (n: number) => String(n).padStart(3, '0');

function limitlessSet(set: string): string {
  return set.replace(/^PROMO-/i, 'P-');
}

export function thumbUrl(c: Card): string {
  return `https://pokemon-tcg.exchange/images/thumbnails/${c.set}/${c.number}.webp`;
}

export function limitlessUrl(c: Card): string {
  const s = limitlessSet(c.set);
  return `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/pocket/${s}/${s}_${pad3(c.number)}_EN_SM.webp`;
}

function tcgdexUrl(c: Card, quality: 'low' | 'high'): string {
  return `https://assets.tcgdex.net/en/tcgp/${limitlessSet(c.set)}/${pad3(c.number)}/${quality}.webp`;
}

export function imageCandidates(c: Card, size: 'thumb' | 'large'): string[] {
  return size === 'thumb'
    ? [thumbUrl(c), limitlessUrl(c), tcgdexUrl(c, 'low')]
    : [limitlessUrl(c), thumbUrl(c), tcgdexUrl(c, 'high')];
}

// Refreshes the card data bundled with the app (public/data/*.json).
// The app also downloads fresh data on its own while running; this snapshot is
// only what it shows on the very first launch or when it's offline.
//
//   npm run snapshot
import { writeFile, mkdir } from 'node:fs/promises';

const FILES = ['sets.json', 'cards.extra.json', 'rarities.json'];
const BASES = [
  'https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/',
  'https://cdn.jsdelivr.net/npm/pokemon-tcg-pocket-database@latest/dist/',
];

const out = new URL('../public/data/', import.meta.url);
await mkdir(out, { recursive: true });

for (const file of FILES) {
  let text;
  for (const base of BASES) {
    try {
      const res = await fetch(base + file);
      if (!res.ok) throw new Error(`${res.status}`);
      text = await res.text();
      JSON.parse(text); // must be valid JSON
      console.log(`${file}: ${(text.length / 1024).toFixed(0)} KB from ${new URL(base).host}`);
      break;
    } catch (err) {
      console.warn(`${file}: ${base} failed (${err.message}), trying next source`);
    }
  }
  if (!text) throw new Error(`Could not download ${file}`);
  await writeFile(new URL(file, out), text);
}

await writeFile(new URL('snapshot-info.json', out), JSON.stringify({ updatedAt: new Date().toISOString() }));
console.log('Snapshot updated.');

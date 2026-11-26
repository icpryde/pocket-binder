# Pocket Binder

A personal tracker for Pokémon TCG Pocket. It shows every card with its art, how many copies you have, which cards you need and which are spare for trading. It also makes the Discord trade post and a single trade-list image.

**Use it:** https://icpryde.github.io/pocket-binder/ (on iPhone: open it in Safari, then Share → Add to Home Screen).

**Sync between devices:** tap **Sync** (next to the card count) and paste a GitHub token that can edit only this repo, once on each device. Your collection is then saved to `collection.json` on this repo's `data` branch about a second after each change, and your other devices pick it up within 30 seconds, or right away when you switch back to them. Changes from different devices are merged card by card, so a trade logged on your phone and a count fixed on your computer both survive. Without a token, the app keeps everything in that browser only (a transfer code or backup file in Settings moves it by hand).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/ (works offline, can be added to the iPhone home screen)
```

Every push to `main` builds the app and publishes it to GitHub Pages (`.github/workflows/deploy.yml`). It also rebuilds every Monday so the bundled card list picks up new expansions.

## What it does

- **Card grid with art.** Every set, newest first. Missing cards are greyed out. Each card shows how many you have (×5) and your spares (+3). Cards you need get a pink border.
- **Tap modes** along the top:
  - **View** opens the card.
  - **Need** marks or unmarks it.
  - **Trade** puts it on your For Trade list or takes it off.
  - **+1** adds a copy (after opening packs or a trade).
  - **−1** removes a copy (when you trade it away).
- **Card view.** Big image, a large −/+ counter (or type the number), "I need this", "Willing to trade", "Keep all copies" (never trade it), trade cost, and recent changes.
- **For Trade list.** For ◆ and ★ cards, every copy above your keep number (2) goes on it automatically. For ★★ and up, only the cards you pick do (Trade mode, or "Willing to trade" on a card), even if you have just 1 or 2 copies. Settings → "Put extras on my For Trade list automatically for" changes which rarities work which way.
- **Filters:**
  - Quick lists such as "◆◆◆◆ I need" and "◆◆◆◆ spares". You can save your own.
  - Collection status: have, none, fewer than your keep number, spares, needed.
  - Rarity: ◆ to ◆◆◆◆, ★ to ★★★, shiny ✦/✦✦ and crown, plus "only rarities you can trade".
  - ★★ kinds: Trainers, Full art (Super Rare Pokémon) and Rainbow (Special Art Rare).
  - Expansion, with a completion bar per set.
  - Booster pack.
  - Energy type, and card type (ex, Mega, stage, Supporter, Item…).
  - Sort order.

  Every option shows how many cards it would match.
- **Log a trade.** Pick the card you gave and the card you got, in the same rarity. Both counts update, and the card you got leaves your need list once you have enough.
- **Share list:**
  - **Discord text** in the format `[Code] … / ◆◆◆◆ / [[LF]] / [DF] Mega Greninja, … / [[FT]] / …`. You choose which rarities go in, and the text splits itself into several messages if it runs over Discord's 2,000-character limit.
  - **Images**: Looking for / For trade / Everything I have, with the friend code on top. Long lists are split into several sharp images (3 rows each by default, changeable) so Discord doesn't shrink them. Share or save them all at once, or copy one at a time.
- **Undo.** The Undo button or Cmd+Z reverts the last change.
- **Backups.** Download a backup file, or move everything between devices with a transfer code (Settings).

"Keep number" (Settings, default 2): fewer copies than this means you need the card, more means the extras are spares.

## Where the cards come from

- **Card list:** [pokemon-tcg-pocket-database](https://github.com/flibustier/pokemon-tcg-pocket-database). It covers every set up to Dual Fusion (C1) and usually adds new expansions within a day. The app downloads it every few hours and keeps a copy for offline use. Settings → "Check for new cards now" forces a check. `npm run snapshot` refreshes the copy built into the app.
- **Images:** thumbnails from pokemon-tcg.exchange, larger scans from Limitless TCG, and TCGdex as a fallback. Each card tries the next host if one fails.
- **Deluxe Pack reprints:** they share the original card's count, matched by the game's own card id.

## Starting data

`src/state/seed.ts` holds the counts read from the game on 2026-11-25: ◆◆◆◆ (954 copies), ★ (307 cards, 801 copies) and ★★ (167 cards, 208 copies), plus the 7 cards marked as needed. ◆ to ◆◆◆ and the other rarities start at zero. A collection saved before the star counts existed gets them added once, without changing any card that already has a count. `my-star-cards.txt` is the same ★/★★ list as plain text.

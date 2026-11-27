# CLAUDE.md

Claude Code reads this file automatically. **The rules for this repository are in [`AGENTS.md`](AGENTS.md). Read that file first and follow it for every change.**

The short version, so it is never missed:

- **This is a browser game, mobile first** (iPad and phones in landscape; no native app). Desktop browsers are supported too (keyboard and mouse) since 2026-11-27.
- **Every game must work on an iPad browser.** Touch-first, targets of at least 44 px, no hover-only UI, audio unlocked by a tap, WebGL with a fallback, no `alert`/`confirm`/`prompt`, and no reliance on storage that Safari may clear.
- **Multiplayer is local only:** two players share one iPad (pass-and-play). No internet play, no servers, no realtime backends.
- **Every multiplayer game offers a "2 players (same iPad)" option** next to the computer levels, and shows whose turn it is in words.
- **Verify before calling it done:** `npm run build` passes, the game runs in a headless browser with no console errors, and it has been checked at an iPad viewport. Report anything you could not verify.
- **Full specification:** [`docs/SPEC.md`](docs/SPEC.md).

# BeatOk agent notes

- Single-page beat studio. No framework, no runtime dependencies; plain JS files in `src/` are concatenated by `build.mjs` into `dist/index.html` inside one block scope. Keep file number prefixes in load order.
- UI text is Russian; DAW window names stay English (Channel Rack, Piano Roll, Playlist).
- Project state is the global `P` (plain JSON). After any user edit call `History.commit(label)`; it snapshots `P`, bumps `UI.ver` and autosaves. Never keep references to `P` objects across `History.apply` (undo replaces `P`).
- Audio graph lives in `Graph` (`04-engine.js`). Structural changes: `graph.syncChannels()`, `graph.rebuildFx(i)`. Parameter changes: `updateChannel`, `updateInsert`, `updateFx`. The same `Graph` class is used for live playback and for offline WAV render, so instruments and effects must only use the `ctx` they are given.
- Instruments are functions `play*(ctx, out, params, t, midi, vel, dur, opt)` returning a `Voice`. `dur == null` means a held live note that ends with `voice.release(t)`.
- Times in patterns are in steps (1 step = 1/16 note). Notes: `{ t, d, n, v }`.
- Inside claude.ai the page uses capabilities: `downloads` (WAV and MID are wrapped into ZIP, because only some extensions are allowed), `db` and `user` (per-user projects under `data/users/<id>/`). Outside claude.ai it falls back to `<a download>` and localStorage.
- Deploy: `docker-compose.yml` has one public service `web` on port 8080 (`tlfpaas.route: "web"`), nginx runs as non-root. Do not add `ports` or Compose `user`.
- Tests: `npm test` (Playwright + system Chrome at `/usr/bin/google-chrome`).

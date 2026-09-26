# BotFleet TV-Face Pack v4

Public repo.  Orange TV-bot face system for BotFleet reactive avatars.

## Download

**Release:** https://github.com/jaywedgeworth22/botfleet-tv-face/releases/tag/tv-face-v4

- `TV-Face-gifs.zip` — all animated GIFs (transparent)
- `TV-Face-stills.zip` — all PNG stills + docs + framework
- `TV-Face.tar.gz` — full pack

## Style

- Orange TV-head robot, cyan neon visor glyphs only
- Transparent backgrounds (keyed)
- 480×480 GIFs, head shell still, glyph-only motion
- Segments: enter / hold / return + still PNG

## BotFleet CursorState coverage

Maps all 39 states in `framework/manifest.json` → `cursorStateMap`.

### Exact / dedicated art
idle (idle_loop), listening, thinking, working, searching, sleeping, waking,
happy, excited, celebrate, confused, curious, sad, angry, surprised, scared,
suspicious, shy, bored, drowsy, proud, playful, laughing, orbit, radar,
progress, loading, sending, receiving, uploading, notifying, alerting,
spawning, powering_down, typing (writing), speaking (dictating)

### Utility overlays
- `idle_loop.gif` / `resting_hold.gif` — breathing blink idle
- `blink.gif` — short blink overlay
- `anticipate.gif` — pre-enter anticipation

### Product-cycle extras (unique to TV-Face)
fleet, crash, memory, tools, routine, screen, git, webhook, computer

## Wiring sketch

```ts
// shared/bot-avatar.ts
avatarVariants?: Partial<Record<CursorState, string>>;

// player: anticipate → enter → hold loop → return → idle_loop
// optional: layer blink.gif on any hold
```

## Roadmap (not in this release)
- SVG recolorable glyphs
- 960×960 retina
- Body color variants (blue/green/purple/red)
- enter/return for every new emotion (holds + stills first)

## Drive
https://drive.google.com/drive/folders/18yY5nLXou1tmCmlBjN_SXcFWPUTxQ83C

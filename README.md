# BotFleet TV-Face Pack v5

Production-ready animated TV-head robot emoji / avatar pack for Discord, Telegram, and BotFleet.

## Style

- Glossy TV-head robot shell with **cyan neon visor glyphs only**
- Black transparent background (keyed)
- Head shell completely still — glyph-only motion
- 480×480 GIFs, 73 frames @ 80 ms (~5.8 s loops)
- Segments: **enter → hold → return** plus utilities

## Download

**Google Drive:** https://drive.google.com/drive/folders/18yY5nLXou1tmCmlBjN_SXcFWPUTxQ83C

**GitHub release:** https://github.com/jaywedgeworth22/botfleet-tv-face/releases

## Layout

```
TV-Face/
  gifs/                 # orange base (all enter/hold/return + utilities)
  stills/               # PNG stills
  stills_480/           # 480px stills
  glyphs/svg/           # recolorable SVG glyph set + shell template
  skins/
    orange|blue|green|purple|pink|red|yellow/
      gifs/
      stills/
    skins.json
  framework/            # manifest + player helpers
  docs/
  README.md
```

## Skins (7)

| Skin    | Hue | Notes              |
|---------|-----|--------------------|
| orange  | —   | base (default)     |
| blue    | 218 | cool fleet blue    |
| green   | 128 | status green       |
| purple  | 275 | accent purple      |
| pink    | 330 | soft pink          |
| red     | 5   | alert red          |
| yellow  | 48  | warm yellow        |

Cyan neon glyphs are preserved across all skins.

## Utilities

- `idle_loop.gif` / `resting_hold.gif` — breathing idle
- `blink.gif` — short blink overlay
- `anticipate.gif` — pre-enter anticipation
- `pack_intro.gif` / `pack_outro.gif` — pack intro/outro

## SVG glyphs

`glyphs/svg/*.svg` — pure cyan stroke glyphs (viewBox 0 0 512 512).  
`_shell_template.svg` — recolorable shell with CSS variables:

```css
:root {
  --shell: #E07030;
  --shell-dark: #C05820;
  --visor: #0A0A0A;
  --ear: #D06028;
  --lens: #4DB8FF;
  --glyph: #00E5FF;
}
```

Drop any glyph into the shell template for static/web use.

## BotFleet CursorState map

See `framework/manifest.json` → `cursorStateMap` (39 states).

Player sketch:

```ts
// anticipate → enter → hold loop → return → idle_loop
// optional: layer blink.gif on any hold
```

## Specs

- Format: GIF89a, transparency, disposal=2, loop=0
- Size: 480×480
- Frames: 73 @ 80 ms
- Transparency: black keyed
- Colors: 255 + transparent

## License

Internal BotFleet / Jay Wedgeworth assets.  Contact owner for redistribution.

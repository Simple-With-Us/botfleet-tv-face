# BotFleet TV-Face Framework v2

**Updated:** 2026-09-26  
**Transparent backgrounds:** yes  
**Clips:** enter · hold · return for **all 13** expressions

## Multi-bot design

One player, many skins.  Each BotFleet seat mounts `TVFace` / `TVFaceBoard` with a skin path (`skins/<botId>/`).  Expression IDs and event names stay identical so software does not change when you add a new bot look.

```
TV-Face/
  framework/
    manifest.json
    tvface-player.js      # TVFace + TVFaceBoard
    bot-skin-template.json
  skins/default/          # Orange TV-Head (canonical)
    stills/*.png
    gifs/*_{enter,hold,return}.gif
  docs/
```

## Expressions (complete)

fleet · crash · memory · tools · routine · screen · git · webhook · computer · listening · thinking · typing · speaking

## State machine

```
idle → enter → hold (loop) → return → idle
```

## Quick usage

```js
import { TVFaceBoard } from './framework/tvface-player.js';
import manifest from './framework/manifest.json';

const board = new TVFaceBoard({
  skinRoot: '/assets/TV-Face/skins',
  defaultSkin: 'default',
  manifest,
});
board.mount('seat-ops', document.getElementById('face-ops'));
board.onEvent('seat-ops', 'agent.thinking');
board.show('seat-ops', 'typing');
board.toIdle('seat-ops');
// board.setSkin('seat-ops', 'blue-bot'); // another bot skin
```

## Adding a bot skin

1. Copy `skins/default` → `skins/<botId>`
2. Keep identical filenames
3. Recolor/redesign art (480×480, transparent)
4. Register in `manifest.json` → `skins`
5. Seat config: `{ "tvFaceSkin": "<botId>" }`

## Specs

- 480×480, 12 fps, silent transparent GIF + PNG
- Flat cartoon TV-head, cyan neon icons, head still
- No extra half-smile flash on return

**Drive:** [TV-Face folder](https://drive.google.com/drive/folders/18yY5nLXou1tmCmlBjN_SXcFWPUTxQ83C)

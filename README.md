# BotFleet TV-Face Expression Pack

**Created:** 2026-09-26  
**Updated:** transparent backgrounds  
**Style:** Flat cartoon orange TV-head robot, **transparent background**, cyan neon face icons, head completely still.  
**Format:** Silent animated GIFs (480×480, 12 fps, ~2.5–3 s, loop) + transparent PNG stills.

## Resting Face
- `stills/resting.png` — slightly bigger horizontal cyan eyes + very slight smile.  
- Use as the default / idle state.

## Expression Sets (modular clips)

Each expression has:
1. **enter** — smooth transition *from resting → expression*
2. **hold** — expression paused with subtle neon pulse on the icons
3. **return** — smooth transition *from expression → resting*

### Original 8 (hold + return)
| Name | Meaning |
|------|---------|
| fleet | Multi-agent / fleet coordination |
| crash | Error / crash recovery |
| memory | Memory / storage access |
| tools | Tools / tool use |
| routine | Routine / scheduled job |
| screen | Screen / UI focus |
| git | Git commit (singular) |
| webhook | Webhook send (singular) |

### New 5 (full enter + hold + return)
| Name | Meaning |
|------|---------|
| computer | Using a computer |
| listening | Listening to others |
| thinking | Thinking / reasoning |
| typing | Typing / writing code |
| speaking | Speaking / explaining |

## How BotFleet software should use these

### State machine
```
idle (resting)
  → play enter_GIF
  → loop hold_GIF while action active
  → play return_GIF
  → idle
```

### Event mapping examples
- `agent.thinking` → thinking
- `agent.listening` → listening
- `agent.typing` / code.write → typing
- `agent.speaking` / TTS → speaking
- `agent.using_computer` → computer
- `git.commit` → git
- `webhook.send` → webhook
- fleet coordination → fleet
- error → crash

### Simple player (pseudo)
```js
class TVFace {
  constructor(el) { this.el = el; this.current = 'resting'; }
  show(name) {
    if (this.current === name) return;
    this.el.src = `gifs/${name}_hold.gif`;
    this.current = name;
  }
  async toIdle() {
    if (this.current === 'resting') return;
    this.el.src = 'stills/resting.png';
    this.current = 'resting';
  }
}
```

## Files layout
```
TV-Face/
  stills/   # transparent PNGs
  gifs/     # transparent animated GIFs (31 clips)
  docs/     # this README
```

All GIFs are silent with transparent backgrounds for clean UI compositing.

**Google Drive:** folder [TV-Face](https://drive.google.com/drive/folders/18yY5nLXou1tmCmlBjN_SXcFWPUTxQ83C)  
**This repo:** docs + future releases of the binary pack.

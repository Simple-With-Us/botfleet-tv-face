/**
 * <tv-face> v4 — SVG/CSS/JS runtime
 *
 * Animation craft inspired by bloub (https://bloub.vercel.app, MIT):
 *   - pure sample(t) — pose math never calls Date.now()
 *   - easeOutQuint morphs — body never overshoots
 *   - per-state morph duration (0.30–0.60s class like bloub)
 *   - freeze composite when chaining mid-fade
 *   - rest life = gaze drift + blink schedule (not big float bob)
 *   - speaking mouth is pure sample of t while [speaking]
 *
 * Silhouette stays TV-Face (shell + glass).  We do not copy the x.ai blob.
 */
(() => {
  let _uid = 0;

  const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const TAU = Math.PI * 2;

  function loopNoise(t, period, seed = 0) {
    const p = (t / period) * TAU;
    return (
      0.55 * Math.sin(p + seed) +
      0.3 * Math.sin(2 * p + seed * 1.7 + 1.1) +
      0.15 * Math.sin(3 * p + seed * 2.3 + 2.4)
    );
  }

  function createRng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Deterministic blink schedule (mulberry32).  Pure of t. */
  const BLINKS = (() => {
    const rng = createRng(0x5eed);
    const out = [];
    let t = 1.4;
    while (t < 3600) {
      out.push(t);
      t += 1.9 + rng() * 2.7;
      if (rng() < 0.12) out.push(t + 0.12);
    }
    return out;
  })();

  function lidAt(t) {
    let lid = 1;
    for (let i = 0; i < BLINKS.length; i++) {
      const b = BLINKS[i];
      if (b > t + 0.25) break;
      const d = t - b;
      if (d >= 0 && d < 0.16) {
        const u = d / 0.16;
        // close fast, open slower (ease)
        lid = u < 0.4 ? 1 - easeOutQuint(u / 0.4) : easeOutQuint((u - 0.4) / 0.6);
        break;
      }
    }
    return clamp(lid);
  }

  function liveliness(t) {
    return {
      gazeX: 7 * loopNoise(t, 7.5, 0.3),
      gazeY: 4.5 * loopNoise(t, 9.2, 1.1),
      tilt: 1.6 * loopNoise(t, 11, 2.0),
      breath: 1.8 * loopNoise(t, 4.8, 0.7),
      lid: lidAt(t),
      // specular drift rides gaze (glass highlight follows attention)
      specX: 36 + 4 * loopNoise(t, 8.1, 0.5),
      specY: 28 + 3 * loopNoise(t, 10.4, 1.4),
      ear: 1.2 * loopNoise(t, 5.5, 0.9),
    };
  }

  /**
   * Hold poses + morph duration (seconds), bloub-style per-state morph.
   * eyeL/eyeR scale for wink / wide.  mouth 0 closed → 1 open.
   */
  const HOLD = {
    resting:   { tilt: 0, bob: 0, scale: 1, eyeOpen: 1, eyeL: 1, eyeR: 1, mouth: 0, morph: 0.45 },
    thinking:  { tilt: -4, bob: -6, scale: 1.02, eyeOpen: 1, eyeL: 1, eyeR: 1, mouth: 0, morph: 0.40 },
    working:   { tilt: 2, bob: 2, scale: 1, eyeOpen: 1, eyeL: 1, eyeR: 1, mouth: 0, morph: 0.45 },
    waiting:   { tilt: 5, bob: 0, scale: 1, eyeOpen: 0.95, eyeL: 1, eyeR: 1, mouth: 0, morph: 0.45 },
    celebrate: { tilt: 0, bob: -12, scale: 1.05, eyeOpen: 1.08, eyeL: 1.1, eyeR: 1.1, mouth: 0.35, morph: 0.35 },
    error:     { tilt: -3, bob: 0, scale: 1, eyeOpen: 1.12, eyeL: 1.05, eyeR: 1.05, mouth: 0, morph: 0.30 },
    sleeping:  { tilt: -2, bob: 3, scale: 0.98, eyeOpen: 0.08, eyeL: 0.08, eyeR: 0.08, mouth: 0, morph: 0.55 },
    listening: { tilt: 3, bob: -2, scale: 1.01, eyeOpen: 1.05, eyeL: 1.05, eyeR: 1.05, mouth: 0, morph: 0.40 },
    wink:      { tilt: 2, bob: 0, scale: 1, eyeOpen: 1, eyeL: 1, eyeR: 0.08, mouth: 0.15, morph: 0.30 },
    alert:     { tilt: 0, bob: -4, scale: 1.03, eyeOpen: 1.15, eyeL: 1.12, eyeR: 1.12, mouth: 0.1, morph: 0.30 },
    notify:    { tilt: 0, bob: -8, scale: 1.04, eyeOpen: 1.1, eyeL: 1.08, eyeR: 1.08, mouth: 0.2, morph: 0.35 },
    speaking:  { tilt: 0, bob: 0, scale: 1, eyeOpen: 1, eyeL: 1, eyeR: 1, mouth: 0.5, morph: 0.40 },
  };

  function holdPose(state, t) {
    const base = HOLD[state] || HOLD.resting;
    let tilt = base.tilt;
    let bob = base.bob;
    let scale = base.scale;
    let mouth = base.mouth;
    let eyeL = base.eyeL;
    let eyeR = base.eyeR;

    if (state === 'thinking') {
      tilt = base.tilt + 4 * Math.sin(t * 2.2);
      bob = base.bob + 5 * Math.sin(t * 2.0);
    } else if (state === 'working') {
      tilt = base.tilt + 2.5 * Math.sin(t * 4.0);
      bob = base.bob + 2 * Math.sin(t * 4.0);
    } else if (state === 'waiting') {
      tilt = base.tilt * Math.sin(t * 1.1);
    } else if (state === 'celebrate') {
      bob = base.bob * (0.5 + 0.5 * Math.sin(t * 8));
      scale = 1 + 0.04 * Math.sin(t * 8);
      mouth = 0.25 + 0.2 * Math.abs(Math.sin(t * 6));
    } else if (state === 'error') {
      tilt = 3 * Math.sin(t * 18);
    } else if (state === 'sleeping') {
      bob = base.bob + 2 * Math.sin(t * 1.2);
      scale = 0.98 + 0.01 * Math.sin(t * 1.2);
    } else if (state === 'listening') {
      // ear lean + soft bob — "I hear you"
      tilt = base.tilt + 2 * Math.sin(t * 1.6);
      bob = base.bob + 1.5 * Math.sin(t * 2.4);
    } else if (state === 'wink') {
      // hold wink: right lid stays down; slight smile pulse
      mouth = 0.12 + 0.08 * Math.abs(Math.sin(t * 3));
    } else if (state === 'alert') {
      bob = base.bob + 1.5 * Math.sin(t * 10);
      scale = 1.02 + 0.015 * Math.sin(t * 10);
    } else if (state === 'notify') {
      bob = base.bob * (0.6 + 0.4 * Math.sin(t * 6));
    } else if (state === 'speaking') {
      // base mouth; speaking flag still drives open envelope
      mouth = 0.2;
    }

    return {
      tilt, bob, scale,
      eyeOpen: base.eyeOpen,
      eyeL, eyeR,
      mouth,
      morph: base.morph,
    };
  }

  /** Pure speaking envelope — irregular lip open while talking. */
  function speakEnvelope(t, t0, hz) {
    const u = t - t0;
    // multi-harmonic, non-periodic-looking chatter
    const a =
      0.55 * Math.abs(Math.sin(u * hz * TAU * 0.55)) +
      0.30 * Math.abs(Math.sin(u * hz * TAU * 0.91 + 0.7)) +
      0.15 * Math.abs(Math.sin(u * hz * TAU * 1.37 + 1.4));
    // soft gate so it does not stick at zero
    return clamp(0.08 + 0.92 * a);
  }

  const FALLBACK_CSS = `
:host{display:inline-block;width:var(--tv-size,240px);height:var(--tv-size,240px);
--shell-shadow:#782d0f;--shell-base:#d25f23;--shell-highlight:#ffbe78;--glyph:#22d3ee;--glass:#05070a;
--float-opacity:.28;--bob-amp:0px;--tilt-deg:0deg;--scale:1;--mouth-open:0;--spec-x:36%;--spec-y:28%;
--gaze-x:0px;--gaze-y:0px;--lid:1;--eye-open:1;--eye-l:1;--eye-r:1;--ear-nudge:0px;
background:transparent;line-height:0;position:relative;vertical-align:middle}
:host([float]){--float-opacity:.42}
:host([casing="blue"]){--shell-shadow:#0f2d6e;--shell-base:#286ec8;--shell-highlight:#8cc8ff}
:host([casing="purple"]){--shell-shadow:#371464;--shell-base:#8237be;--shell-highlight:#d2a0ff}
:host([casing="pink"]){--shell-shadow:#781946;--shell-base:#dc468c;--shell-highlight:#ffb4d2}
:host([casing="white"]){--shell-shadow:#8c919b;--shell-base:#dcdee4;--shell-highlight:#fff}
:host([casing="black"]){--shell-shadow:#0c0e12;--shell-base:#2d3037;--shell-highlight:#a0a5af}
:host([casing="green"]){--shell-shadow:#0f4a28;--shell-base:#1f9a4a;--shell-highlight:#8dffb0;--glyph:#ef4444}
:host([casing="cyan"]){--shell-shadow:#0a4a55;--shell-base:#14b8c8;--shell-highlight:#a5f3fc}
:host([casing="red"]){--shell-shadow:#6b1010;--shell-base:#dc2626;--shell-highlight:#fca5a5}
:host([casing="yellow"]){--shell-shadow:#6b5508;--shell-base:#eab308;--shell-highlight:#fef08a}
:host([casing="teal"]){--shell-shadow:#0f3f3a;--shell-base:#14b8a6;--shell-highlight:#99f6e4}
:host([casing="coral"]){--shell-shadow:#7a2e1a;--shell-base:#f97316;--shell-highlight:#fdba74}
.wrap,.tv{width:100%;height:100%;background:transparent;display:block;overflow:visible}
.hybrid{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;
  opacity:0;transition:opacity .25s ease;border-radius:12%}
:host([hybrid-active]) .hybrid{opacity:1}
:host([hybrid-active]) .rig-glyphs{opacity:0}
.rig{transform-origin:480px 520px;transform:translateY(var(--bob-amp)) rotate(var(--tilt-deg)) scale(var(--scale))}
@media (prefers-reduced-motion:reduce){:host{--bob-amp:0px !important;--tilt-deg:0deg !important}}
.shell-fill{fill:url(#__SHELL__)}.ear-fill{fill:url(#__EAR__)}.glass{fill:var(--glass)}
.ear-left{transform:translateY(var(--ear-nudge))}
.ear-right{transform:translateY(calc(var(--ear-nudge) * -0.6))}
.glyph{fill:none;stroke:var(--glyph);stroke-linecap:round;filter:url(#__NEON__)}
.glyph-fill{fill:var(--glyph);filter:url(#__NEON__)}
.state-glyph{opacity:0;stroke:var(--glyph);fill:none;stroke-width:10;stroke-linecap:round;filter:url(#__NEON__);transition:opacity .18s}
:host([state="thinking"]) .g-think,
:host([state="working"]) .g-work,
:host([state="waiting"]) .g-wait,
:host([state="celebrate"]) .g-celeb,
:host([state="error"]) .g-error,
:host([state="sleeping"]) .g-sleep,
:host([state="listening"]) .g-listen,
:host([state="alert"]) .g-alert,
:host([state="notify"]) .g-notify,
:host([state="wink"]) .g-wink,
:host([state="speaking"]) .g-speak{opacity:1}
.mouth-open-path{opacity:0}
:host([speaking]) .mouth-closed{opacity:calc(1 - var(--mouth-open))}
:host([speaking]) .mouth-open-path{opacity:var(--mouth-open)}
:host([state="speaking"]) .mouth-closed{opacity:calc(1 - var(--mouth-open))}
:host([state="speaking"]) .mouth-open-path{opacity:var(--mouth-open)}
.eye-group{transform:translate(var(--gaze-x), var(--gaze-y))}
.eye-left{transform-box:fill-box;transform-origin:center;transform:scale(var(--eye-l), calc(var(--eye-l) * var(--lid) * var(--eye-open)))}
.eye-right{transform-box:fill-box;transform-origin:center;transform:scale(var(--eye-r), calc(var(--eye-r) * var(--lid) * var(--eye-open)))}
.pupil{transform-box:fill-box;transform-origin:center}
`;

  class TvFace extends HTMLElement {
    static get observedAttributes() {
      return ['state', 'casing', 'phase', 'speaking', 'float', 'size', 'hybrid-src'];
    }
    constructor() {
      super();
      this._id = `tv${++_uid}`;
      this.attachShadow({ mode: 'open' });
      this._t0 = performance.now() / 1000;
      this._raf = 0;
      this._morph = null;
      this._frozen = null;
      this._speak = null; // { t0, hz } while speaking — pure sample
      this._hybrid = null;
      this._lastPose = { ...HOLD.resting };
    }
    connectedCallback() {
      this.shadowRoot.innerHTML = this._template();
      this._hybrid = this.shadowRoot.querySelector('.hybrid');
      if (!this.hasAttribute('state')) this.setAttribute('state', 'resting');
      if (!this.hasAttribute('phase')) this.setAttribute('phase', 'rest');
      if (!this.hasAttribute('casing')) this.setAttribute('casing', 'orange');
      this._applySize();
      this._startLoop();
    }
    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
    }
    attributeChangedCallback(name, o, v) {
      if (o === v) return;
      if (name === 'size') this._applySize();
      if (name === 'phase') this._emit('tv-phase', { phase: v });
      if (name === 'hybrid-src') this._syncHybrid();
      if (name === 'state' || name === 'phase') this._syncHybridPhase(this.getAttribute('phase'));
      if (name === 'speaking') {
        if (this.hasAttribute('speaking')) {
          if (!this._speak) this._speak = { t0: performance.now() / 1000 - this._t0, hz: 4.2 };
        } else {
          this._speak = null;
        }
      }
    }
    _applySize() {
      const s = this.getAttribute('size') || '240px';
      this.style.setProperty('--tv-size', s);
    }
    _sid(n) { return `${this._id}-${n}`; }
    _template() {
      const shell = this._sid('shell');
      const ear = this._sid('ear');
      const neon = this._sid('neon');
      const css = FALLBACK_CSS
        .replaceAll('__SHELL__', shell)
        .replaceAll('__EAR__', ear)
        .replaceAll('__NEON__', neon);
      return `
<style>${css}</style>
<img class="hybrid" alt=""/>
<svg class="tv wrap" viewBox="0 0 960 960" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${shell}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="var(--shell-highlight)"/>
      <stop offset="45%" stop-color="var(--shell-base)"/>
      <stop offset="100%" stop-color="var(--shell-shadow)"/>
    </linearGradient>
    <linearGradient id="${ear}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--shell-highlight)"/>
      <stop offset="100%" stop-color="var(--shell-shadow)"/>
    </linearGradient>
    <filter id="${neon}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="${this._sid('spec')}" cx="var(--spec-x)" cy="var(--spec-y)" r="55%">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.22"/>
      <stop offset="55%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g class="rig">
    <ellipse class="ear-fill ear-left" cx="175" cy="470" rx="42" ry="70"/>
    <ellipse class="ear-fill ear-right" cx="785" cy="470" rx="42" ry="70"/>
    <rect class="shell-fill" x="210" y="210" width="540" height="500" rx="72"/>
    <rect class="glass" x="255" y="270" width="450" height="340" rx="36"/>
    <rect fill="url(#${this._sid('spec')})" x="255" y="270" width="450" height="340" rx="36"/>
    <g class="rig-glyphs eye-group">
      <g class="eye-left">
        <ellipse class="glyph-fill" cx="390" cy="420" rx="28" ry="32" opacity="0.95"/>
        <ellipse class="pupil" cx="390" cy="424" rx="10" ry="12" fill="#0a0a0c"/>
      </g>
      <g class="eye-right">
        <ellipse class="glyph-fill" cx="570" cy="420" rx="28" ry="32" opacity="0.95"/>
        <ellipse class="pupil" cx="570" cy="424" rx="10" ry="12" fill="#0a0a0c"/>
      </g>
      <path class="glyph mouth-closed" d="M380 580 Q480 640 580 580" stroke-width="14"/>
      <ellipse class="glyph-fill mouth-open-path" cx="480" cy="600" rx="70" ry="36"/>
      <g class="state-glyph g-think"><circle cx="640" cy="300" r="10" class="glyph-fill"/><circle cx="670" cy="270" r="7" class="glyph-fill"/><circle cx="690" cy="245" r="5" class="glyph-fill"/></g>
      <g class="state-glyph g-work"><path d="M340 300 h80 M340 320 h60" stroke-width="10"/></g>
      <g class="state-glyph g-wait"><path d="M480 300 v50 M480 360 v8" stroke-width="12"/></g>
      <g class="state-glyph g-celeb"><path d="M320 280 l20 30 l-30 10 l30 10 l-20 30 l20-30 l30 10 l-30-10 z" stroke-width="6"/></g>
      <g class="state-glyph g-error"><path d="M450 300 h60 M480 300 v55" stroke-width="14"/><circle cx="480" cy="380" r="6" class="glyph-fill"/></g>
      <g class="state-glyph g-sleep"><path d="M600 300 q20 -20 40 0" stroke-width="8"/><path d="M620 280 q16 -16 32 0" stroke-width="6"/></g>
      <g class="state-glyph g-listen"><path d="M320 340 q-30 40 0 80" stroke-width="10"/><path d="M300 360 q-20 30 0 55" stroke-width="7"/></g>
      <g class="state-glyph g-alert"><path d="M480 285 l18 48 h-36 z" stroke-width="8"/><circle cx="480" cy="360" r="5" class="glyph-fill"/></g>
      <g class="state-glyph g-notify"><circle cx="640" cy="300" r="16" class="glyph-fill" opacity="0.9"/><path d="M640 292 v10 M640 308 v2" stroke="#0a0a0c" stroke-width="3"/></g>
      <g class="state-glyph g-wink"><path d="M540 430 q30 18 60 0" stroke-width="10"/></g>
      <g class="state-glyph g-speak"><path d="M640 560 q20 30 0 50" stroke-width="8"/><path d="M665 555 q24 35 0 58" stroke-width="6"/></g>
    </g>
  </g>
  <ellipse cx="480" cy="780" rx="160" ry="18" fill="#000" opacity="var(--float-opacity)"/>
</svg>`;
    }

    /**
     * Sample full visual pose at absolute time t (seconds).
     * Pure: same t + same morph/speak state => same pose.
     */
    sample(t) {
      const state = this.getAttribute('state') || 'resting';
      const phase = this.getAttribute('phase') || 'rest';
      let pose;

      if (this._morph) {
        const m = this._morph;
        const p = clamp((t - m.t0) / m.dur);
        const e = easeOutQuint(p);
        pose = {
          tilt: lerp(m.from.tilt, m.to.tilt, e),
          bob: lerp(m.from.bob, m.to.bob, e),
          scale: lerp(m.from.scale, m.to.scale, e),
          eyeOpen: lerp(m.from.eyeOpen, m.to.eyeOpen, e),
          eyeL: lerp(m.from.eyeL ?? 1, m.to.eyeL ?? 1, e),
          eyeR: lerp(m.from.eyeR ?? 1, m.to.eyeR ?? 1, e),
          mouth: lerp(m.from.mouth, m.to.mouth, e),
        };
        if (p >= 1 && m.resolve) {
          const r = m.resolve;
          this._morph = null;
          this._frozen = null;
          r();
        }
      } else if (phase === 'hold') {
        pose = holdPose(state, t);
      } else {
        pose = { ...HOLD.resting, eyeL: 1, eyeR: 1 };
      }

      const live =
        phase === 'rest' || phase === 'hold' || phase === 'enter' || phase === 'return'
          ? liveliness(t)
          : { gazeX: 0, gazeY: 0, tilt: 0, breath: 0, lid: 1, specX: 36, specY: 28, ear: 0 };

      let lid = live.lid;
      let eyeOpen = pose.eyeOpen;
      let eyeL = pose.eyeL ?? 1;
      let eyeR = pose.eyeR ?? 1;
      if (state === 'sleeping') {
        lid = Math.min(lid, 0.12);
        eyeOpen = 0.08;
        eyeL = eyeR = 0.08;
      }
      // wink holds right eye closed even during blink schedule
      if (state === 'wink') {
        eyeR = Math.min(eyeR, 0.08);
      }

      let mouth = pose.mouth;
      if (this._speak || this.hasAttribute('speaking') || state === 'speaking') {
        const sp = this._speak || { t0: 0, hz: 4.2 };
        mouth = Math.max(mouth, speakEnvelope(t, sp.t0, sp.hz));
      }

      // rest adds micro tilt/breath; hold keeps liveliness gaze only
      const restTilt = phase === 'rest' ? live.tilt : phase === 'hold' ? live.tilt * 0.35 : 0;
      const restBob = phase === 'rest' ? live.breath : phase === 'hold' ? live.breath * 0.25 : 0;

      const out = {
        tilt: pose.tilt + restTilt,
        bob: pose.bob + restBob,
        scale: pose.scale,
        eyeOpen,
        eyeL,
        eyeR,
        lid,
        mouth,
        gazeX: live.gazeX,
        gazeY: live.gazeY,
        specX: live.specX,
        specY: live.specY,
        ear: live.ear,
      };
      this._lastPose = out;
      return out;
    }

    _applyPose(p) {
      const st = this.style;
      st.setProperty('--tilt-deg', `${p.tilt}deg`);
      st.setProperty('--bob-amp', `${p.bob}px`);
      st.setProperty('--scale', String(p.scale));
      st.setProperty('--eye-open', String(p.eyeOpen));
      st.setProperty('--eye-l', String(p.eyeL));
      st.setProperty('--eye-r', String(p.eyeR));
      st.setProperty('--lid', String(p.lid));
      st.setProperty('--mouth-open', String(p.mouth));
      st.setProperty('--gaze-x', `${p.gazeX}px`);
      st.setProperty('--gaze-y', `${p.gazeY}px`);
      st.setProperty('--spec-x', `${p.specX}%`);
      st.setProperty('--spec-y', `${p.specY}%`);
      st.setProperty('--ear-nudge', `${p.ear}px`);
    }

    _startLoop() {
      const tick = (now) => {
        const t = now / 1000 - this._t0;
        this._applyPose(this.sample(t));
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    }

    /** Freeze current composite so chaining mid-fade never jumps. */
    _freezeNow() {
      const t = performance.now() / 1000 - this._t0;
      this._frozen = { ...this.sample(t) };
      return this._frozen;
    }

    _morphTo(target, durSec) {
      return new Promise((resolve) => {
        const t0 = performance.now() / 1000 - this._t0;
        const from = this._morph ? this._freezeNow() : { ...this._lastPose };
        // default morph duration from target state table if not provided
        const dur = durSec != null ? durSec : (target.morph || 0.45);
        this._morph = {
          from: {
            tilt: from.tilt, bob: from.bob, scale: from.scale,
            eyeOpen: from.eyeOpen, eyeL: from.eyeL ?? 1, eyeR: from.eyeR ?? 1,
            mouth: from.mouth,
          },
          to: {
            tilt: target.tilt, bob: target.bob, scale: target.scale,
            eyeOpen: target.eyeOpen, eyeL: target.eyeL ?? 1, eyeR: target.eyeR ?? 1,
            mouth: target.mouth,
          },
          t0,
          dur,
          resolve,
        };
      });
    }

    async play(state, { holdMs = Infinity, autoReturn = false, morphMs } = {}) {
      const s = state || 'thinking';
      if (s === 'resting') return this.stop();
      this.setAttribute('state', s);
      this.setAttribute('phase', 'enter');
      const target = holdPose(s, 0);
      const dur = morphMs != null ? morphMs / 1000 : target.morph;
      await this._morphTo(target, dur);
      this.setAttribute('phase', 'hold');
      if (Number.isFinite(holdMs)) {
        await wait(holdMs);
        if (autoReturn) await this.stop();
      }
    }
    async stop() {
      this.setAttribute('phase', 'return');
      const dur = (HOLD[this.getAttribute('state')] || HOLD.resting).morph;
      await this._morphTo({ ...HOLD.resting, eyeL: 1, eyeR: 1 }, dur);
      this.setAttribute('state', 'resting');
      this.setAttribute('phase', 'rest');
    }
    setSpeaking(on, hz = 4.2) {
      if (on) {
        this.setAttribute('speaking', '');
        this._speak = { t0: performance.now() / 1000 - this._t0, hz };
      } else {
        this.removeAttribute('speaking');
        this._speak = null;
      }
    }
    startTalking(hz = 4.2) {
      this.setSpeaking(true, hz);
    }
    stopTalking() {
      this.setSpeaking(false);
    }
    setCasing(name) { this.setAttribute('casing', name); }
    setHybrid(src) {
      if (src) this.setAttribute('hybrid-src', src);
      else this.removeAttribute('hybrid-src');
    }
    _syncHybrid() {
      const src = this.getAttribute('hybrid-src');
      if (!this._hybrid) return;
      if (src) { this._hybrid.src = src; }
      else { this._hybrid.removeAttribute('src'); this.removeAttribute('hybrid-active'); }
    }
    _syncHybridPhase(phase) {
      if (this.getAttribute('hybrid-src') && phase === 'hold') this.setAttribute('hybrid-active', '');
      else this.removeAttribute('hybrid-active');
    }
    _emit(name, detail) {
      this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }
  }

  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
  if (!customElements.get('tv-face')) customElements.define('tv-face', TvFace);
  window.TvFace = TvFace;
})();

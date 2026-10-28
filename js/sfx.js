/* TT Window Climber: sound effects, all synth through Kit.sound (so the page's one mute switch covers them).
   WC.sfx.log counts every effect played, so tests can check sound in code while muted. */
(function () {
  'use strict';
  const S = Kit.sound;
  const log = {};
  const note = (name, fn) => (...a) => { log[name] = (log[name] || 0) + 1; fn(...a); };
  WC.sfx = {
    log,
    hand: note('hand', (right) => S.tone({ type: 'triangle', f: right ? 620 : 520, to: right ? 700 : 600, dur: 0.06, vol: 0.07 })),
    ledge: note('ledge', () => S.tone({ f: 200, to: 120, dur: 0.07, vol: 0.09 })),
    row: note('row', (n) => S.coin(n || 0)),
    knock: note('knock', () => { S.tone({ type: 'square', f: 300, to: 250, dur: 0.05, vol: 0.06 }); S.tone({ type: 'square', f: 300, to: 250, dur: 0.05, vol: 0.06, at: 0.12 }); }),
    winShut: note('winShut', () => S.tone({ type: 'sawtooth', f: 700, to: 300, dur: 0.35, vol: 0.05, lp: 1800 })),
    shutOut: note('shutOut', () => { S.tone({ type: 'triangle', f: 500, to: 220, dur: 0.3, vol: 0.12 }); S.tone({ type: 'sine', f: 330, to: 440, dur: 0.12, vol: 0.08, at: 0.32 }); }),
    warn: note('warn', () => { S.tone({ type: 'triangle', f: 880, dur: 0.08, vol: 0.08 }); S.tone({ type: 'triangle', f: 1175, dur: 0.12, vol: 0.08, at: 0.1 }); }),
    fall: note('fall', () => S.tone({ type: 'sine', f: 1200, to: 300, dur: 0.6, vol: 0.06 })),
    bonk: note('bonk', (kind) => {
      if (kind === 'duck') { S.tone({ type: 'square', f: 1300, to: 1900, dur: 0.08, vol: 0.08 }); S.tone({ type: 'square', f: 1900, to: 1200, dur: 0.1, vol: 0.07, at: 0.08 }); }
      else if (kind === 'ball') { S.tone({ f: 320, to: 620, dur: 0.18, vol: 0.14 }); S.tone({ f: 420, to: 760, dur: 0.14, vol: 0.08, at: 0.2 }); }
      else S.hiss({ filter: 'lowpass', f: 900, to: 300, dur: 0.3, vol: 0.18 });
      for (let i = 0; i < 4; i++) S.tone({ f: 900 - i * 120, to: 1000 - i * 120, dur: 0.12, vol: 0.05, at: 0.3 + i * 0.12, type: 'sine' });
    }),
    plop: note('plop', () => S.tone({ f: 260, to: 120, dur: 0.12, vol: 0.06 })),
    dodge: note('dodge', () => S.coin(2)),
    top: note('top', () => [523, 659, 784, 1047].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.22, vol: 0.14, at: i * 0.12 }))),
    heli: note('heli', () => { for (let i = 0; i < 14; i++) S.hiss({ filter: 'bandpass', f: 500, q: 2, dur: 0.07, vol: 0.06, at: i * 0.11 }); }),
    first: note('first', () => [784, 988, 1175, 1568].forEach((f, i) => S.tone({ type: 'square', f, dur: 0.1, vol: 0.06, at: i * 0.09 }))),
    win: note('win', () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.26, vol: 0.14, at: i * 0.14 }))),
    buddy: note('buddy', () => { S.tone({ f: 400, to: 900, dur: 0.15, vol: 0.12 }); S.hiss({ f: 2000, to: 500, dur: 0.25, vol: 0.08 }); }),
    treat: note('treat', () => S.coin(4)),
    hold: note('hold', () => { [523, 784, 1047].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.18, vol: 0.09, at: i * 0.08 })); S.hiss({ filter: 'highpass', f: 2500, to: 6000, dur: 0.4, vol: 0.05 }); }),
    unhold: note('unhold', () => [1047, 784, 523].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.14, vol: 0.05, at: i * 0.08 }))),
    hi5: note('hi5', () => { S.hiss({ filter: 'bandpass', f: 1800, dur: 0.08, vol: 0.25, q: 1 }); S.tone({ f: 880, to: 1320, dur: 0.15, vol: 0.08, at: 0.05 }); }),
    life: note('life', () => [784, 988, 1175, 1568].forEach((f, i) => S.tone({ type: 'square', f, dur: 0.1, vol: 0.06, at: i * 0.09 }))),
    go: note('go', () => { S.tone({ type: 'square', f: 660, dur: 0.1, vol: 0.07 }); S.tone({ type: 'square', f: 990, dur: 0.18, vol: 0.07, at: 0.12 }); }),
    gameOver: note('gameOver', () => [523, 440, 392, 523].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.25, vol: 0.12, at: i * 0.2 }))),
    click: note('click', () => S.click()),
  };
})();

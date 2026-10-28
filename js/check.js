/* TT Window Climber: the headless check of the brief's rules, on the real rules in js/sim.js (no drawing).
   Runs in node (node tools/check.js) and in the page (game.check()).
   - climbOnlyOpen: ↑ climbs only through an open window: never into a shut, shutting or opening one, on every
     building; and in long autopilot and random-key runs every step up (or down) went through an open window.
   - shutNeverTraps: a window shutting while he's on it slides him to the ledge below, with no life lost, and then he
     walks and climbs again; every window row keeps an always-open window; random keys never leave him stuck.
   - autopilotEasy: the autopilot climbs all 4 buildings on 🐣 EASY (4 seeds); NORMAL is reported too.
   - warningFirst: every falling thing had its resident's warning first, for the full warning time (long runs, both
     levels, both players).
   - plus the brother holding every window open, bonks, the helicopter, and the 2-player race.
   fail() turns on one sabotage at a time (see w.sab in js/sim.js and js/bot.js) and each must be caught by its check. */
(function (root) {
  'use strict';
  const WC = (root.WC = root.WC || {});
  const S = () => WC.sim;
  const DT = () => S().DT;

  function world(o) {
    const w = S().create(Object.assign({ level: 'easy', seed: 5, go: true }, o || {}));
    w.towers.forEach((T) => (T.dropT = 1e9));
    return w;
  }
  function place(T, row, c) {
    const p = T.p;
    p.r = row; p.prog = 0; p.x = S().colX(T.L, c); p.col = c; p.mode = 'ledge'; p.sliding = false; p.slideRows = 0; p.dizzy = 0; p.inv = 0;
    p.best = Math.max(p.best, row);
  }
  function setWin(T, row, c, st) {
    const win = T.wins[row][c];
    win.st = st;
    win.amt = st === 'open' ? 1 : st === 'shut' ? 0 : 0.5;
    win.t = st === 'open' || st === 'shut' ? 1e9 : 30;
    return win;
  }
  const H = (T) => T.p.r + T.p.prog;
  function steps(w, inp, n, each) {
    for (let i = 0; i < n; i++) {
      S().step(w, typeof inp === 'function' ? inp(w, i) : inp);
      if (each && each(w, i) === false) return i;
    }
    return n;
  }
  // a watcher for "only through open windows": call before() then after() around every step
  function openWatch() {
    const bad = [];
    let moves = 0, snap = null;
    return {
      bad, get moves() { return moves; },
      before(w) {
        snap = w.towers.map((T) => {
          const p = T.p, c = p.prog > 0 ? p.col : S().nearestCol(T.L, p.x);
          return { T, h: H(T), r: p.r, prog: p.prog, sliding: p.sliding, dizzy: p.dizzy, c };
        });
      },
      after(w) {
        w.towers.forEach((T, i) => {
          const a = snap[i], h = H(T);
          if (a.T !== T) return; // the helicopter brought him to a new building's street
          // the windows as they were when he moved (windows change first in a step, then he climbs)
          const st = (row) => (row >= T.L.rows ? 'roof' : row <= 0 ? 'street' : T.wins[row][a.c].st);
          a.up = st(a.r + 1);
          a.down = st(a.r);
          if (a.sliding || T.p.sliding && h < a.h) return; // sliding down is the window pushing him, not climbing
          if (h > a.h + 1e-9) {
            moves++;
            const through = a.prog > 0 ? a.up : a.up; // up from a ledge or along the wall: the window above
            if (through !== 'open' && through !== 'roof') bad.push(`b${w.bi} row ${a.r}→ col ${a.c}: climbed up through a ${through} window`);
          } else if (h < a.h - 1e-9) {
            moves++;
            const through = a.prog > 0 ? a.up : a.down;
            if (through !== 'open' && through !== 'roof') bad.push(`b${w.bi} row ${a.r} col ${a.c}: climbed down through a ${through} window`);
          }
        });
      },
    };
  }
  function autoplay(w, secs, until, watch) {
    let k = 0, inps = w.towers.map(() => ({}));
    let bonks = 0;
    const t0 = w.t;
    while (w.t - t0 < secs) {
      if (k++ % 3 === 0) inps = w.towers.map((T, i) => WC.bot.decide(w, i));
      if (watch) watch.before(w);
      S().step(w, inps);
      if (watch) watch.after(w);
      for (const e of w.events) if (e.type === 'bonk') bonks++;
      if (w.phase === 'over') return { cleared: false, t: +(w.t - t0).toFixed(1), bi: w.bi, bonks, why: 'out of lives' };
      if (until(w)) return { cleared: true, t: +(w.t - t0).toFixed(1), bi: w.bi, bonks };
    }
    return { cleared: false, t: +(w.t - t0).toFixed(1), bi: w.bi, bonks, why: 'ran out of time', h: w.towers.map((T) => H(T).toFixed(2)) };
  }

  const checks = {
    climbOnlyOpen(sab) {
      const bad = [];
      let tries = 0;
      for (const level of ['easy', 'normal']) {
        for (let bi = 0; bi < WC.levels.count; bi++) {
          // every state but open, in the middle column and an edge column, from a low ledge and a high one
          for (const st of ['shut', 'shutting', 'opening', 'open']) {
            for (const [row, c] of [[1, 2], [4, 0], [WC.levels.list[bi].rows - 3, 4]]) {
              const w = world({ level, building: bi, sabotage: sab });
              const T = w.towers[0];
              place(T, row, c);
              setWin(T, row + 1, c, st);
              const h0 = H(T);
              const evs = [];
              steps(w, { ud: 1 }, 20, (ww) => { evs.push(...ww.events); });
              tries++;
              const went = H(T) > h0 + 1e-9;
              if (st === 'open' && !went) bad.push(`${level} b${bi} row ${row} col ${c}: an open window didn't let him climb`);
              if (st !== 'open' && went) bad.push(`${level} b${bi} row ${row} col ${c}: climbed into a ${st} window`);
              if (st !== 'open' && !evs.some((e) => e.type === 'knock')) bad.push(`${level} b${bi}: no knock on a ${st} window`);
            }
          }
        }
      }
      // long runs: the autopilot, then random keys, with the watcher on every step
      const watch = openWatch();
      for (const [level, seed] of [['easy', 3], ['normal', 4]]) {
        const w = S().create({ level, seed, sabotage: sab });
        autoplay(w, 240, (ww) => ww.phase === 'win', watch);
      }
      let rnd = 99;
      const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
      for (const level of ['easy', 'normal']) {
        const w = S().create({ level, seed: 8, go: true, sabotage: sab });
        w.players[0].lives = 99;
        let inp = {};
        for (let i = 0; i < 60 * 90; i++) {
          if (i % 9 === 0) inp = { lr: r() < 0.3 ? (r() < 0.5 ? -1 : 1) : 0, ud: r() < 0.75 ? 1 : r() < 0.5 ? -1 : 0 };
          watch.before(w);
          S().step(w, inp);
          watch.after(w);
          if (w.phase !== 'play' && w.phase !== 'ready') break;
        }
      }
      bad.push(...watch.bad.slice(0, 5));
      return [!bad.length, bad.length ? bad.slice(0, 4).join('; ') : `${tries} placed tries (only open windows let him up); ${watch.moves} climbing steps in autopilot and random-key runs, all through open windows`];
    },

    shutNeverTraps(sab) {
      const bad = [];
      let n = 0;
      for (const level of ['easy', 'normal']) {
        for (let bi = 0; bi < WC.levels.count; bi++) {
          const L = WC.levels.layout(bi, 5, level);
          for (let row = 1; row < L.rows; row++) if (!L.kinds[row].includes('open')) bad.push(`${level} b${bi} row ${row} has no always-open window`);
          for (const prog of [0.2, 0.5, 0.8]) {
            const w = world({ level, building: bi, sabotage: sab });
            const T = w.towers[0], L2 = T.L;
            const row = 3, c = 1;
            place(T, row, c);
            const win = setWin(T, row + 1, c, 'open');
            win.kind = 'busy';
            steps(w, { ud: 1 }, Math.round((prog * 2 * w.cfg.half) / DT()));
            const lives0 = w.players[0].lives;
            win.st = 'open'; win.t = DT() / 2; // it starts to shut right now
            const evs = [];
            const took = steps(w, {}, 90, (ww) => { evs.push(...ww.events); return !(T.p.prog === 0 && !T.p.sliding); });
            n++;
            if (!(T.p.prog === 0 && !T.p.sliding && T.p.r === row)) { bad.push(`${level} b${bi} prog ${prog}: still on the wall after 1.5 s (r ${T.p.r} prog ${T.p.prog.toFixed(2)})`); continue; }
            if (!evs.some((e) => e.type === 'shutOut')) bad.push(`${level} b${bi}: no shutOut event`);
            if (w.players[0].lives !== lives0) bad.push(`${level} b${bi}: a shutting window cost a life`);
            // free to walk away, and to climb another window
            const x0 = T.p.x;
            steps(w, { lr: 1 }, 20);
            if (!(T.p.x > x0 + 0.3)) bad.push(`${level} b${bi} prog ${prog}: can't walk after the window shut`);
            const oc = T.wins[row + 1].findIndex((x, k) => k !== c && x.kind === 'open');
            place(T, row, oc);
            steps(w, { ud: 1 }, 90);
            if (!(T.p.r >= row + 1)) bad.push(`${level} b${bi}: couldn't climb the open window next door`);
            if (took > 80) bad.push(`${level} b${bi}: took ${took} steps to get back to the ledge`);
          }
        }
      }
      // random keys with lots of shutting: afterwards → and ← always move him (or he's dizzy for a moment)
      let rnd = 5;
      const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
      for (const level of ['easy', 'normal']) {
        for (let bi = 0; bi < WC.levels.count; bi++) {
          const w = S().create({ level, seed: 12 + bi, building: bi, go: true, sabotage: sab, cfg: { openT: [0.4, 1.2] } });
          w.players[0].lives = 99;
          let inp = {};
          for (let i = 0; i < 60 * 40; i++) {
            if (i % 7 === 0) inp = { lr: r() < 0.25 ? (r() < 0.5 ? -1 : 1) : 0, ud: r() < 0.8 ? 1 : 0 };
            S().step(w, inp);
            if (w.phase !== 'play') break;
          }
          const T = w.towers[0];
          if (T.p.mode === 'top') continue;
          T.drops = [];
          T.dropT = 1e9;
          steps(w, {}, 150); // let any slide or dizzy end
          const xa = T.p.x;
          steps(w, { lr: T.p.x > 0 ? -1 : 1 }, 30);
          n++;
          if (Math.abs(T.p.x - xa) < 0.3 && T.p.prog === 0) bad.push(`${level} b${bi}: random keys left him unable to walk`);
          if (T.p.prog > 0 && T.p.r < T.L.rows) {
            const h = H(T);
            steps(w, { ud: -1 }, 60);
            if (Math.abs(H(T) - h) < 1e-6 && !T.p.sliding) bad.push(`${level} b${bi}: stuck on the wall at ${h.toFixed(2)}`);
          }
        }
      }
      return [!bad.length, bad.length ? bad.slice(0, 4).join('; ') : `${n} shut-on-him and random-key cases: always back on the ledge in < 1.4 s, no life lost, then walks and climbs; every row has an always-open window`];
    },

    autopilotEasy(sab) {
      const bad = [], info = [];
      for (const seed of [1, 2, 3, 4]) {
        const w = S().create({ level: 'easy', seed, sabotage: sab });
        const r = autoplay(w, 420, (ww) => ww.phase === 'win');
        if (!r.cleared) bad.push(`seed ${seed}: stopped on building ${r.bi + 1} (${r.why})`);
        else info.push(`seed ${seed} ${r.t}s ${r.bonks} bonks`);
      }
      const n = [];
      for (const seed of [1, 2]) {
        const w = S().create({ level: 'normal', seed, sabotage: sab });
        const r = autoplay(w, 420, (ww) => ww.phase === 'win');
        n.push(r.cleared ? `seed ${seed} ${r.t}s ${r.bonks} bonks` : `seed ${seed} stopped on building ${r.bi + 1}`);
      }
      return [!bad.length, bad.length ? bad.join('; ') : `EASY all 4 buildings: ${info.join(', ')} · NORMAL: ${n.join(', ')}`];
    },

    warningFirst(sab) {
      const bad = [];
      let falls = 0;
      for (const [level, players] of [['easy', ['teddy']], ['normal', ['teddy']], ['normal', ['teddy', 'tommy']]]) {
        for (const seed of [6, 7]) {
          const w = S().create({ level, seed, players, sabotage: sab });
          w.players.forEach((pl) => (pl.lives = 99));
          const warned = new Map(), seen = new Map();
          let k = 0, inps = [];
          while (w.t < 300 && w.phase !== 'win') {
            if (k++ % 3 === 0) inps = w.towers.map((T, i) => WC.bot.decide(w, i));
            S().step(w, inps);
            for (const e of w.events) {
              if (e.type === 'warn') warned.set(e.slot + ':' + e.id, w.t);
              if (e.type === 'fall') {
                falls++;
                const t0 = warned.get(e.slot + ':' + e.id);
                if (t0 == null) bad.push(`${level} drop ${e.id}: fell with no warning`);
                else if (w.t - t0 < w.cfg.warn - 2 * DT()) bad.push(`${level} drop ${e.id}: warned only ${(w.t - t0).toFixed(2)} s`);
              }
            }
            // and nothing is ever falling that wasn't first leaning out of a window
            for (const T of w.towers) {
              for (const d of T.drops) {
                const key = T.slot + ':' + d.id;
                if (d.st === 'warn') seen.set(key, (seen.get(key) || 0) + DT());
                else if (!((seen.get(key) || 0) >= w.cfg.warn - 2 * DT())) { bad.push(`${level} drop ${d.id}: falling after ${(seen.get(key) || 0).toFixed(2)} s of warning`); seen.set(key, 99); }
              }
            }
          }
        }
      }
      if (falls < 40) bad.push(`only ${falls} things fell: not a real test`);
      return [!bad.length, bad.length ? bad.slice(0, 4).join('; ') : `${falls} soft things fell in long runs (EASY, NORMAL, 2 players): every one leaned out with its warning first for the full time`];
    },

    buddyHolds(sab) {
      const bad = [];
      const w = world({ building: 2, sabotage: sab });
      const T = w.towers[0];
      place(T, 2, 0);
      const score0 = w.players[0].score;
      S().call(w);
      const evs = [];
      steps(w, {}, Math.round((S().BUDDY_INTRO + 0.4) / DT()), (ww) => { evs.push(...ww.events); });
      if (!evs.some((e) => e.type === 'treat')) bad.push('no treat');
      if (w.players[0].score - score0 !== 100) bad.push(`treat scored ${w.players[0].score - score0}`);
      if (!evs.some((e) => e.type === 'hold')) bad.push('no hold event');
      let notOpen = 0, checked = 0;
      steps(w, {}, Math.round((S().HOLD - 0.6) / DT()), () => {
        checked++;
        for (let row = 1; row < T.L.rows; row++) for (let c = 0; c < T.L.cols; c++) if (T.wins[row][c].st !== 'open') notOpen++;
      });
      if (notOpen) bad.push(`${notOpen} window-steps not open during the 5 s hold`);
      // a stay-shut window can be climbed while he holds it
      const sc = T.L.kinds.findIndex((k, row) => row > 0 && k.includes('shut'));
      const w2 = world({ building: 3, sabotage: sab });
      const T2 = w2.towers[0], srow = T2.L.kinds.findIndex((k, row) => row > 1 && k.includes('shut'));
      const scol = T2.L.kinds[srow].indexOf('shut');
      place(T2, srow - 1, scol);
      S().call(w2);
      steps(w2, {}, Math.round((S().BUDDY_INTRO + 0.4) / DT()));
      steps(w2, { ud: 1 }, 60);
      if (!(T2.p.r >= srow)) bad.push(`couldn't climb a stay-shut window while he held it (row ${srow})`);
      // afterwards the stay-shut windows shut again
      steps(w2, {}, Math.round((S().HOLD + 3) / DT()));
      if (T2.wins[srow][scol].st !== 'shut') bad.push(`a stay-shut window stayed ${T2.wins[srow][scol].st} after the hold`);
      if (w2.buddy) bad.push('the brother never left');
      // call as often as you like
      const w3 = world({ sabotage: sab });
      let calls = 0;
      for (let i = 0; i < 4; i++) { if (S().call(w3)) calls++; steps(w3, {}, 30); }
      if (calls !== 4) bad.push(`only ${calls} of 4 calls worked`);
      return [!bad.length, bad.length ? bad.join('; ') : `treat +100, then all ${T.L.rows - 1}x${T.L.cols} windows open for ${checked} steps, a stay-shut window climbed while held and shut again after, 4 calls in a row (${sc >= 0 ? 'stay-shut found' : ''})`];
    },

    bonks(sab) {
      const bad = [];
      for (const level of ['easy', 'normal']) {
        const w = world({ level, building: 1, sabotage: sab });
        const T = w.towers[0];
        place(T, 4, 2);
        const lives = w.players[0].lives;
        T.drops.push({ id: 900, kind: 'pillow', who: 0, c: 2, row: 6, x: 0, y: 4 * S().FH + 2.5, st: 'fall', t: 0, warnT: 1, vy: 0, spin: 0, hit: false, passed: false });
        const evs = [];
        steps(w, {}, 120, (ww) => { evs.push(...ww.events); });
        if (!evs.some((e) => e.type === 'bonk')) { bad.push(`${level}: no bonk`); continue; }
        if (w.players[0].lives !== lives - 1) bad.push(`${level}: lives ${lives}→${w.players[0].lives}`);
        const want = level === 'easy' ? 4 : 3;
        if (T.p.r !== want || T.p.prog !== 0) bad.push(`${level}: after the bonk on row ${T.p.r} (wanted ${want})`);
        const x0 = T.p.x;
        steps(w, { lr: -1 }, 20);
        if (!(T.p.x < x0 - 0.3)) bad.push(`${level}: can't walk after a bonk`);
      }
      // 2 players: a bonk costs time, not a life
      const w = world({ players: ['teddy', 'tommy'], sabotage: sab });
      const T = w.towers[1];
      place(T, 3, 2);
      T.drops.push({ id: 901, kind: 'ball', who: 0, c: 2, row: 5, x: 0, y: 3 * S().FH + 2.5, st: 'fall', t: 0, warnT: 1, vy: 0, spin: 0, hit: false, passed: false });
      steps(w, {}, 120);
      if (w.players[1].lives !== w.cfg.lives || w.phase !== 'play') bad.push('2 players: a bonk cost a life');
      return [!bad.length, bad.length ? bad.join('; ') : 'EASY: −1 life, stays on his ledge; NORMAL: −1 life, down one floor; walks again after; 2 players: no lives lost'];
    },

    helicopter(sab) {
      const bad = [];
      const w = world({ building: 0, sabotage: sab });
      const T = w.towers[0];
      place(T, T.L.rows - 1, 2);
      const evs = [];
      steps(w, { ud: 1 }, 60, (ww) => { evs.push(...ww.events); });
      const top = evs.find((e) => e.type === 'top');
      if (!top || w.phase !== 'heli') bad.push(`no helicopter at the roof (phase ${w.phase})`);
      steps(w, {}, Math.round((S().HELI + 0.2) / DT()));
      if (w.bi !== 1 || w.phase !== 'ready' || w.towers[0].p.r !== 0) bad.push(`not on building 2's street (b${w.bi} ${w.phase} r${w.towers[0].p.r})`);
      S().loadBuilding(w, 3);
      w.phase = 'play';
      place(w.towers[0], w.towers[0].L.rows - 1, 2);
      steps(w, { ud: 1 }, 60);
      steps(w, {}, Math.round((S().HELI + 0.2) / DT()));
      if (w.phase !== 'win') bad.push(`the last building didn't end in a win (${w.phase})`);
      return [!bad.length, bad.length ? bad.join('; ') : `roof → helicopter → the next building's street; the 4th roof wins (+${top.bonus} bonus)`];
    },

    twoPlayerRace(sab) {
      const bad = [];
      const w = S().create({ level: 'easy', seed: 9, players: ['teddy', 'tommy'], sabotage: sab });
      // twin towers: the same windows doing the same thing at the same time
      let diff = 0;
      let k = 0, inps = [];
      const firsts = [];
      const t0 = w.t;
      while (w.t - t0 < 600 && w.phase !== 'win' && w.phase !== 'over') {
        if (k++ % 3 === 0) inps = [WC.bot.decide(w, 0), w.t % 20 < 6 ? {} : WC.bot.decide(w, 1)];
        S().step(w, inps);
        for (const e of w.events) if (e.type === 'first') firsts.push(e.slot);
        const [A, B] = w.towers;
        if (!w.hold) for (let row = 1; row < A.L.rows; row++) for (let c = 0; c < A.L.cols; c++) if (A.wins[row][c].st !== B.wins[row][c].st) diff++;
      }
      if (w.phase !== 'win') bad.push(`the race didn't finish (${w.phase} on building ${w.bi + 1})`);
      if (diff) bad.push(`${diff} window-steps differ between the twin towers`);
      if (firsts.length !== 4) bad.push(`${firsts.length} buildings had a winner`);
      const wins = w.players.map((p) => p.wins);
      return [!bad.length, bad.length ? bad.join('; ') : `4 races, firsts ${firsts.map((s) => w.players[s].who).join(' ')}, wins ${wins.join('-')}, twin windows identical, scores ${w.players.map((p) => p.score).join(' / ')}`];
    },
  };

  const SABOTAGE = [
    ['climbShut', 'climbOnlyOpen', 'up climbs through shut windows too'],
    ['trapShut', 'shutNeverTraps', 'a shutting window freezes him on the wall'],
    ['lazyBot', 'autopilotEasy', 'the autopilot stands still'],
    ['noWarn', 'warningFirst', 'things fall with no warning'],
    ['noHold', 'buddyHolds', "the brother's hold does nothing"],
  ];

  WC.check = {
    names: Object.keys(checks),
    run(only) {
      const results = [];
      for (const name of Object.keys(checks)) {
        if (only && !only.includes(name)) continue;
        let ok, info;
        try { [ok, info] = checks[name](); } catch (e) { ok = false; info = 'threw ' + ((e && e.stack) || e); }
        results.push({ name, ok, info });
      }
      return { ok: results.every((r) => r.ok), results, failed: results.filter((r) => !r.ok).map((r) => r.name) };
    },
    fail() {
      const caught = SABOTAGE.map(([sab, name, what]) => {
        let ok, info;
        try { [ok, info] = checks[name](sab); } catch (e) { ok = false; info = 'threw ' + e; }
        return { sabotage: sab, check: name, what, caught: !ok, failed: [info] };
      });
      return { ok: caught.every((c) => c.caught), caught };
    },
    autoplay,
  };
})(typeof window !== 'undefined' ? window : globalThis);

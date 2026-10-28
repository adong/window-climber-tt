/* TT Window Climber: the rules, in fixed 1/60 s steps, with no drawing (js/game.js draws; js/check.js tests these).
   Each player climbs his own tower (2 players race up twin towers side by side). A climber stands on a ledge (row r,
   prog 0) and can walk left and right along it. ↑ climbs to the next ledge, left hand then right hand, but only through
   an open window: the window just above him in his column. On the wall, ← or → first takes him to the nearest ledge. A window that starts to shut while he is on it slides him
   gently down to the ledge below: it stops him but never traps him, the ledge always lets him walk to another window.
   Friendly residents lean out first (the warning, with a shadow on the wall) and then drop something soft. The roof
   has the helicopter, which flies him to the next tower. The called brother holds every window open for 5 seconds. */
(function (root) {
  'use strict';
  const WC = (root.WC = root.WC || {});
  const DT = 1 / 60, CW = 1.6, FH = 1.7;
  const BUDDY_INTRO = 1.3, HOLD = 5, READY = 1.6, HELI = 4.4, LIFE_EVERY = 10000;
  const TREATS = ['🍦', '💧', '🧃', '🍪', '🍉', '🍌'];
  const ITEMS = ['pillow', 'ball', 'duck'];
  const CFG = {
    easy: {
      lives: 5, walk: 2.6, glide: 2.6, half: 0.36, shutT: 2.4, shutHold: [1.4, 2.6], openT: [3, 6.5], opening: 0.6,
      drop: [6, 4.4], warn: 1.8, g: 7, vmax: 5, maxDrops: 1, dizzy: 0.6, knock: 0, inv: 1.8, bonus: 3000, slide: 3.2,
    },
    normal: {
      lives: 3, walk: 3.0, glide: 3.0, half: 0.3, shutT: 0.9, shutHold: [1.8, 3.4], openT: [2, 4.6], opening: 0.45,
      drop: [3.4, 2.1], warn: 1.2, g: 10, vmax: 7, maxDrops: 2, dizzy: 1.1, knock: 1, inv: 1.5, bonus: 4000, slide: 4,
    },
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const colX = (L, c) => (c - (L.cols - 1) / 2) * CW;
  const nearestCol = (L, x) => clamp(Math.round(x / CW + (L.cols - 1) / 2), 0, L.cols - 1);
  const range = (ab, r) => ab[0] + (ab[1] - ab[0]) * r();

  function create(o) {
    o = o || {};
    const level = o.level === 'normal' ? 'normal' : 'easy';
    const ids = o.players || ['teddy'];
    const w = {
      level, cfg: Object.assign({}, CFG[level], o.cfg || {}), seed: o.seed == null ? 1 : o.seed, sab: o.sabotage || null,
      two: ids.length === 2, players: ids.map((who) => ({ who, score: 0, lives: CFG[level].lives, nextLife: LIFE_EVERY, wins: 0 })),
      bi: 0, towers: [], phase: 'ready', phaseT: 0, t: 0, events: [], buddy: null, hold: 0, calls: 0, hi5T: 0, did: 0,
      bonus: 0, bonusAcc: 0, arrived: 0, ending: 0, dropId: 0, buddyFor: o.buddyFor || ((id) => (id === 'tommy' ? 'teddy' : 'tommy')),
    };
    loadBuilding(w, o.building || 0);
    if (o.go) { w.phase = 'play'; w.phaseT = 0; }
    return w;
  }

  function loadBuilding(w, bi) {
    w.bi = bi;
    w.towers = w.players.map((pl, slot) => makeTower(w, slot));
    w.phase = 'ready';
    w.phaseT = 0;
    w.bonus = w.cfg.bonus + 1000 * bi;
    w.bonusAcc = 0;
    w.arrived = 0;
    w.hold = 0;
    w.buddy = null;
  }

  function makeTower(w, slot) {
    const L = WC.levels.layout(w.bi, w.seed, w.level);
    const rw = WC.levels.rng(w.seed * 31 + w.bi * 7 + 5); // windows: the same for both players, so the race is fair
    const rd = WC.levels.rng(w.seed * 17 + w.bi * 3 + slot * 1000 + 9); // drops: each tower its own
    const cfg = w.cfg;
    const wins = L.kinds.map((row) => row.map((kind) => {
      if (kind === 'none') return null;
      if (kind === 'open') return { kind, st: 'open', t: 1e9, amt: 1 };
      if (kind === 'shut') return { kind, st: 'shut', t: 1e9, amt: 0 };
      return rw() < 0.6 ? { kind, st: 'open', t: 0.5 + range(cfg.openT, rw) * rw(), amt: 1 } : { kind, st: 'shut', t: 0.3 + range(cfg.shutHold, rw) * rw(), amt: 0 };
    }));
    const c = Math.floor(L.cols / 2);
    return {
      slot, L, wins, rw, rd, drops: [], dropT: 2.5 + cfg.drop[0] * 0.5 * rd(), done: false, place: 0,
      p: { x: colX(L, c), r: 0, prog: 0, col: c, mode: 'ledge', sliding: false, slideRows: 0, dizzy: 0, inv: 0, face: 1, best: 0, knockT: 0, walkT: 0, stuck: false },
    };
  }

  // can he climb into this row in column c? The roof's edge is always there to grab; a window only when it's fully open.
  function climbable(w, T, c, row) {
    if (row >= T.L.rows) return true;
    if (row <= 0) return false;
    if (w.sab === 'climbShut') return true;
    const win = T.wins[row][c];
    return !!win && win.st === 'open';
  }

  function addScore(w, slot, n) {
    const pl = w.players[slot];
    pl.score += n;
    if (!w.two) {
      while (pl.score >= pl.nextLife) {
        pl.nextLife += LIFE_EVERY;
        pl.lives++;
        w.events.push({ type: 'extraLife', slot });
      }
    }
  }

  // ---------- windows ----------
  function stepWindows(w, T) {
    const cfg = w.cfg;
    const held = !w.two && w.hold > 0 && w.sab !== 'noHold';
    const p = T.p, nc = nearestCol(T.L, p.x);
    for (let row = 1; row < T.L.rows; row++) {
      for (let c = 0; c < T.L.cols; c++) {
        const win = T.wins[row][c];
        if (held) {
          win.held = true;
          if (win.st !== 'open') {
            win.st = 'opening';
            win.amt = Math.min(1, win.amt + DT / 0.3);
            if (win.amt >= 1) { win.st = 'open'; win.amt = 1; if (win.kind === 'busy' && win.t < 1.5) win.t = 1.5; }
          }
          continue;
        }
        if (win.held) {
          win.held = false;
          if (win.kind === 'shut') { win.st = 'shutting'; win.t = cfg.shutT; }
          else if (win.kind === 'busy' && win.st === 'open' && win.t < 1) win.t = 1;
        }
        if (win.kind === 'open') continue;
        if (win.st === 'shut' && win.kind === 'shut') continue;
        win.t -= DT;
        if (win.st === 'open') {
          if (win.t <= 0) {
            win.st = 'shutting';
            win.t = cfg.shutT;
            if (row === p.r + 1 && c === (p.prog > 0 ? p.col : nc)) w.events.push({ type: 'winShut', slot: T.slot, row, c });
          }
        } else if (win.st === 'shutting') {
          win.amt = Math.max(0, win.t / cfg.shutT);
          if (win.t <= 0) { win.amt = 0; win.st = 'shut'; win.t = win.kind === 'shut' ? 1e9 : range(cfg.shutHold, T.rw); }
        } else if (win.st === 'shut') {
          if (win.t <= 0) { win.st = 'opening'; win.t = cfg.opening; }
        } else if (win.st === 'opening') {
          win.amt = 1 - Math.max(0, win.t / cfg.opening);
          if (win.t <= 0) { win.amt = 1; win.st = 'open'; win.t = range(cfg.openT, T.rw); }
        }
      }
    }
  }

  // ---------- the climber ----------
  function stepClimber(w, T, inp) {
    const p = T.p, L = T.L, cfg = w.cfg;
    p.inv = Math.max(0, p.inv - DT);
    p.knockT = Math.max(0, p.knockT - DT);
    if (p.mode === 'top' || p.stuck) return;
    const rate = 1 / (2 * cfg.half);
    // a window shutting on him (or a bonk) slides him down to a ledge: no keys until he's there
    if (p.sliding) {
      p.prog -= cfg.slide * DT;
      if (p.prog <= 0) {
        if (p.slideRows > 0 && p.r > 0) { p.r--; p.prog += 1; p.slideRows--; }
        else { p.prog = 0; p.sliding = false; p.slideRows = 0; p.mode = 'ledge'; w.events.push({ type: 'land', slot: T.slot }); }
      }
      if (p.dizzy > 0) p.dizzy -= DT;
      return;
    }
    if (p.dizzy > 0) { p.dizzy -= DT; return; }
    if (w.phase !== 'play') return;
    const lr = inp && inp.lr ? Math.sign(inp.lr) : 0, ud = inp && inp.ud ? Math.sign(inp.ud) : 0;
    if (p.prog <= 0) {
      p.prog = 0;
      p.mode = 'ledge';
      const x0 = colX(L, 0) - 0.25, x1 = colX(L, L.cols - 1) + 0.25;
      if (lr) {
        p.x = clamp(p.x + lr * cfg.walk * DT, x0, x1);
        p.face = lr;
        p.walkT += DT;
        return;
      }
      // no side key: settle in front of the nearest column (so ↑ finds a window to climb)
      const c = nearestCol(L, p.x), d = colX(L, c) - p.x;
      p.x += Math.sign(d) * Math.min(Math.abs(d), cfg.glide * DT);
      if (!ud || Math.abs(colX(L, c) - p.x) > 0.001) return;
      p.x = colX(L, c);
      if (ud > 0) {
        if (climbable(w, T, c, p.r + 1)) {
          p.col = c;
          p.prog = rate * DT;
          p.mode = 'climb';
          w.events.push({ type: 'hand', slot: T.slot, hand: 'L' });
        } else if (p.knockT <= 0) {
          p.knockT = 0.55;
          w.events.push({ type: 'knock', slot: T.slot, row: p.r + 1, c });
        }
      } else if (p.r > 0) {
        if (climbable(w, T, c, p.r)) {
          p.col = c;
          p.r--;
          p.prog = 1 - rate * DT;
          p.mode = 'climb';
        } else if (p.knockT <= 0) {
          p.knockT = 0.55;
          w.events.push({ type: 'knock', slot: T.slot, row: p.r, c });
        }
      }
      return;
    }
    // on the wall between two ledges: up and down; a side key takes him back to the nearest ledge, then he walks
    p.mode = 'climb';
    let dir = ud;
    if (!dir && lr) dir = p.prog >= 0.5 ? 1 : -1;
    if (dir > 0) {
      const was = p.prog;
      p.prog += rate * DT;
      if (was < 0.5 && p.prog >= 0.5) w.events.push({ type: 'hand', slot: T.slot, hand: 'R' });
      if (p.prog >= 1) {
        p.r++;
        p.prog = 0;
        p.mode = 'ledge';
        w.events.push({ type: 'ledge', slot: T.slot, row: p.r });
        if (p.r > p.best) {
          p.best = p.r;
          if (p.r < L.rows) { addScore(w, T.slot, 50); w.events.push({ type: 'row', slot: T.slot, row: p.r }); }
        }
        if (p.r >= L.rows) reachTop(w, T);
      }
    } else if (dir < 0) {
      p.prog -= rate * DT;
      if (p.prog <= 0) { p.prog = 0; p.mode = 'ledge'; w.events.push({ type: 'ledge', slot: T.slot, row: p.r }); }
    }
  }

  function reachTop(w, T) {
    const p = T.p;
    p.mode = 'top';
    T.done = true;
    T.place = ++w.arrived;
    T.drops.forEach((d) => { if (d.st === 'warn') d.gone = true; });
    T.drops = T.drops.filter((d) => !d.gone);
    const bonus = w.bonus;
    addScore(w, T.slot, bonus);
    w.events.push({ type: 'top', slot: T.slot, place: T.place, bonus });
    if (w.two && T.place === 1) {
      addScore(w, T.slot, 2000);
      w.players[T.slot].wins++;
      w.events.push({ type: 'first', slot: T.slot });
    }
    if (w.towers.every((t) => t.done)) {
      w.phase = 'heli';
      w.phaseT = 0;
      w.buddy = null;
      w.hold = 0;
      w.events.push({ type: 'heli' });
    }
  }

  // a window just above him in his column, or a pushing shutter: he slides gently back down to the ledge below
  function shutCheck(w, T) {
    const p = T.p;
    if (p.prog <= 0 || p.sliding || p.mode === 'top') return;
    const row = p.r + 1;
    if (row >= T.L.rows) return;
    const win = T.wins[row][p.col];
    if (win.st === 'open') return;
    if (w.sab === 'trapShut') { p.stuck = true; return; }
    if (w.sab === 'climbShut') return;
    p.sliding = true;
    p.slideRows = 0;
    w.events.push({ type: 'shutOut', slot: T.slot, row, c: p.col });
  }

  // ---------- the friendly residents and the soft things they drop ----------
  function stepDrops(w, T) {
    const cfg = w.cfg, p = T.p, L = T.L;
    const py = (p.r + p.prog) * FH;
    if (w.phase === 'play' && !T.done) {
      T.dropT -= DT;
      if (T.dropT <= 0) {
        T.dropT = 0.4;
        if (T.drops.length < cfg.maxDrops) spawnDrop(w, T);
      }
    }
    for (const d of T.drops) {
      if (d.st === 'warn') {
        d.t -= DT;
        if (d.t <= 0 || w.sab === 'noWarn') {
          d.st = 'fall';
          d.vy = 0;
          w.events.push({ type: 'fall', slot: T.slot, id: d.id, warned: d.warnT - Math.max(0, d.t) });
        }
        continue;
      }
      d.vy = Math.min(cfg.vmax, d.vy + cfg.g * DT);
      d.y -= d.vy * DT;
      d.spin += DT * (d.kind === 'ball' ? 7 : 3);
      const near = Math.abs(d.x - p.x) < 0.62 && d.y < py + 1.35 && d.y > py - 0.15;
      if (!d.hit && near && p.mode !== 'top' && p.inv <= 0 && w.phase === 'play') bonk(w, T, d);
      if (!d.hit && !d.passed && d.y < py - 0.2 && p.mode !== 'top') {
        d.passed = true;
        if (Math.abs(d.x - p.x) < CW * 1.3 && d.aimed) { addScore(w, T.slot, 50); w.events.push({ type: 'dodge', slot: T.slot, x: p.x, y: py }); }
      }
      if (d.y < -0.4 || d.y < py - 14) { d.gone = true; if (d.y < 0.2 && d.y > -1) w.events.push({ type: 'plop', slot: T.slot, x: d.x }); }
    }
    if (T.drops.some((d) => d.gone)) T.drops = T.drops.filter((d) => !d.gone);
  }

  function spawnDrop(w, T) {
    const p = T.p, L = T.L, cfg = w.cfg, r = T.rd;
    const lo = p.r + 2, hi = Math.min(L.rows - 1, p.r + 4);
    if (lo > hi) return;
    const nc = nearestCol(L, p.x);
    const cand = [];
    for (let row = lo; row <= hi; row++) {
      for (let c = Math.max(0, nc - 1); c <= Math.min(L.cols - 1, nc + 1); c++) {
        const win = T.wins[row][c];
        if (win.kind === 'shut' || win.st !== 'open') continue;
        if (T.drops.some((d) => d.c === c)) continue;
        cand.push({ row, c, weight: c === nc ? 3 : 1 });
      }
    }
    if (!cand.length) return;
    let u = r() * cand.reduce((a, k) => a + k.weight, 0), pick = cand[0];
    for (const k of cand) { u -= k.weight; if (u <= 0) { pick = k; break; } }
    const d = {
      id: ++w.dropId, kind: ITEMS[Math.floor(r() * ITEMS.length)], who: Math.floor(r() * 5), c: pick.c, row: pick.row,
      x: colX(L, pick.c), y: pick.row * FH + 0.95, st: 'warn', t: cfg.warn, warnT: cfg.warn, vy: 0, spin: 0, hit: false, passed: false,
      aimed: pick.c === nc,
    };
    T.drops.push(d);
    const f = cfg.drop[0] + ((cfg.drop[1] - cfg.drop[0]) * w.bi) / 3;
    T.dropT = f * (0.75 + 0.5 * r());
    w.events.push({ type: 'warn', slot: T.slot, id: d.id, row: d.row, c: d.c, kind: d.kind });
  }

  function bonk(w, T, d) {
    const p = T.p, cfg = w.cfg, pl = w.players[T.slot];
    d.hit = true;
    d.vy = -3; // it bounces off his head, softly
    p.dizzy = cfg.dizzy;
    p.inv = cfg.inv;
    if (p.prog > 0) { p.sliding = true; p.slideRows = cfg.knock; }
    else if (cfg.knock && p.r > 0) { p.r--; p.prog = 1; p.sliding = true; p.slideRows = cfg.knock - 1; }
    if (!w.two) pl.lives--;
    w.events.push({ type: 'bonk', slot: T.slot, id: d.id, kind: d.kind, x: p.x, y: (p.r + p.prog) * FH, lives: pl.lives });
    if (!w.two && pl.lives <= 0) w.ending = 1.6;
  }

  // ---------- the brother ----------
  function call(w) {
    if (w.phase !== 'play' && w.phase !== 'ready') return false;
    if (w.two) {
      if (w.hi5T > 0) return false;
      w.hi5T = 0.8;
      w.players.forEach((pl, i) => addScore(w, i, 50));
      w.events.push({ type: 'hi5' });
      return true;
    }
    const who = w.buddyFor(w.players[0].who);
    w.calls++;
    w.buddy = { who, t: 0, n: w.calls, treat: TREATS[(w.calls - 1) % TREATS.length], treated: false, shouted: false };
    w.events.push({ type: 'buddyIn', who });
    return true;
  }
  function stepBuddy(w) {
    w.hi5T = Math.max(0, w.hi5T - DT);
    if (w.hold > 0) w.hold = Math.max(0, w.hold - DT);
    const b = w.buddy;
    if (!b) return;
    b.t += DT;
    if (!b.treated && b.t >= 0.75) {
      b.treated = true;
      addScore(w, 0, 100);
      w.events.push({ type: 'treat', e: b.treat, who: b.who });
    }
    if (!b.shouted && b.t >= BUDDY_INTRO) {
      b.shouted = true;
      w.hold = HOLD;
      w.events.push({ type: 'hold', who: b.who });
    }
    if (b.shouted && w.hold <= 0) {
      w.buddy = null;
      w.events.push({ type: 'buddyOut', who: b.who });
    }
  }

  // ---------- one step ----------
  function step(w, inps) {
    w.events = [];
    if (!Array.isArray(inps)) inps = [inps || {}];
    w.t += DT;
    w.phaseT += DT;
    if (w.phase === 'over' || w.phase === 'win') return;
    stepBuddy(w);
    if (w.phase === 'ready' && w.phaseT >= READY) { w.phase = 'play'; w.phaseT = 0; w.events.push({ type: 'go' }); }
    if (w.phase === 'play') {
      w.bonusAcc += DT;
      while (w.bonusAcc >= 0.5) { w.bonusAcc -= 0.5; w.bonus = Math.max(0, w.bonus - 10); }
    }
    w.towers.forEach((T, i) => {
      stepWindows(w, T);
      shutCheck(w, T); // a window starting to shut slides him down before he can climb on through it
      stepClimber(w, T, inps[i] || {});
      stepDrops(w, T);
    });
    if (w.ending > 0) {
      w.ending -= DT;
      if (w.ending <= 0) { w.phase = 'over'; w.phaseT = 0; w.buddy = null; w.hold = 0; w.events.push({ type: 'over' }); }
    }
    if (w.phase === 'heli' && w.phaseT >= HELI) {
      if (w.bi + 1 < WC.levels.count) {
        loadBuilding(w, w.bi + 1);
        w.events.push({ type: 'building', bi: w.bi });
      } else {
        w.phase = 'win';
        w.phaseT = 0;
        w.events.push({ type: 'win' });
      }
    }
  }

  WC.sim = {
    DT, CW, FH, BUDDY_INTRO, HOLD, READY, HELI, CFG, TREATS,
    create, step, call, loadBuilding, climbable, colX, nearestCol,
    y: (T) => (T.p.r + T.p.prog) * FH,
  };
})(typeof window !== 'undefined' ? window : globalThis);

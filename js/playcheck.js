/* TT Window Climber: the play check with real keys and taps, in the page: game.playCheck().
   Everything here presses keys with real keydown/keyup events on window and taps the touch buttons with pointer
   events, so it goes through the same input code a kid's fingers do (never the autopilot). Time moves with
   game.step, which runs the same frame code as the browser's own frames. Positions are read on the screen; up and
   down are measured against the building (the camera rides up with the climber, so the building is the ruler).
   - direction: → moves right and ← moves left on screen on all 4 buildings, for Teddy, Tommy and both towers in
     2 players (W A S D and the arrows each move only their own climber), with keys and with the touch buttons;
     ↑ climbs up the screen through an open window and ↓ climbs back down; ↑ at a shut window doesn't move him.
   - nothing leaves him stuck: a window shutting while he's on it (↑ still held), the middle of the wall (↓, or ← →
     back to the nearest ledge), a bonk, the
     brother's hold, a key held through pause, the helicopter to the next building, a brother finishing first in
     2 players, and a "keyboard kid" mashing keys on every building with things dropping.
   game.playCheck('mirror') and game.playCheck('stuckWall') prove the check fails when the controls are wrong. */
(function () {
  'use strict';
  const NAMES = { ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', Space: ' ', KeyT: 't', KeyP: 'p', KeyA: 'a', KeyD: 'd', KeyW: 'w', KeyS: 's' };
  const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: NAMES[code] || code, bubbles: true, cancelable: true }));
  const step = (s) => game.step(s, { draw: false });
  const KEYS = [{ l: 'KeyA', r: 'KeyD', u: 'KeyW', d: 'KeyS' }, { l: 'ArrowLeft', r: 'ArrowRight', u: 'ArrowUp', d: 'ArrowDown' }];
  function press(code, secs) {
    key(code, true);
    step(secs);
    key(code, false);
    step(1 / 60);
  }
  function button(pad, k, big) {
    if (big) return document.querySelector('#touch .tbtns [data-k="u"]');
    return document.querySelector(`#touch .dpad[data-pad="${pad}"] [data-k="${k}"]`);
  }
  function tap(el, secs, id) {
    const o = { pointerId: id || 11, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    step(secs);
    el.dispatchEvent(new PointerEvent('pointerup', o));
    step(1 / 60);
  }
  // hold a key until he's on a ledge (or 2 s)
  function toLedge(slot, code) {
    key(code, true);
    for (let i = 0; i < 120 && game.state().towers[slot].prog > 0; i++) step(1 / 60);
    key(code, false);
    step(1 / 60);
  }
  function fresh(o) {
    game.start(Object.assign({ go: true, level: 'easy', players: 1, who: 'teddy' }, o || {}));
    game.quiet();
    step(0.05);
  }
  // where he is: on screen, and up/down against a fixed point of his building
  function at(slot) {
    const s = game.state().towers[slot];
    const [ax, ay] = game.toScreen(slot, game.towerX(slot), 0, 0.5);
    return { x: s.x, r: s.r, prog: s.prog, mode: s.mode, sliding: s.sliding, sx: s.sx, rx: s.sx - ax, ry: s.sy - ay };
  }

  function run(sab) {
    const results = [];
    const ok = (name, pass, info) => results.push({ name, ok: !!pass, info });
    const wasHold = game.G.hold;
    game.hold(true);
    const hadTouch = document.body.classList.contains('touch');
    game.sabotage(sab || null);
    try {
      // ---------- direction on every building, each brother, both towers in 2 players, keys and touch ----------
      const setups = [['teddy', 1, 0, 1], ['tommy', 1, 0, 0], ['teddy', 2, 0, 0], ['tommy', 2, 1, 1]]; // who, players, slot, which key set
      for (let bi = 0; bi < 4; bi++) {
        for (const [who, players, slot, ks] of setups) {
          for (const how of ['keys', 'touch']) {
            document.body.classList.toggle('touch', how === 'touch');
            fresh({ building: bi, players, who: players === 1 ? who : undefined });
            const K = KEYS[ks];
            const pad = players === 2 ? slot : 0;
            const go = (d, secs, big) => (how === 'keys' ? press(K[d], secs) : tap(button(pad, d, big), secs));
            const other = players === 2 ? 1 - slot : -1;
            const tag = `b${bi + 1} ${who}${players === 2 ? ' 2P' : ''} ${how}`;
            // → and ←
            game.put(slot, 2, 2);
            if (other >= 0) game.put(other, 2, 2);
            step(0.05);
            let a = at(slot);
            const o0 = other >= 0 ? at(other) : null;
            go('r', 0.45);
            let b = at(slot);
            const right = b.sx - a.sx > 25 && b.x > a.x;
            const o1 = other >= 0 ? at(other) : null;
            game.put(slot, 2, 2);
            step(0.05);
            a = at(slot);
            go('l', 0.45);
            b = at(slot);
            const left = b.sx - a.sx < -25 && b.x < a.x;
            const alone = !o0 || (o0.x === o1.x && o0.r === o1.r);
            ok(`dir ${tag}`, right && left && alone, `→ ${right ? 'right' : 'WRONG'}, ← ${left ? 'left' : 'WRONG'}${o0 ? `, the other climber ${alone ? 'stayed put' : 'MOVED'}` : ''}`);
            // ↑ through an open window, ↓ back down
            game.put(slot, 2, 1);
            game.setWin(slot, 3, 1, 'open');
            game.setWin(slot, 2, 1, 'shut'); // so ↓ stops on row 2 instead of going on down
            step(0.05);
            a = at(slot);
            game.setWin(slot, 4, 1, 'shut'); // so ↑ stops on row 3 instead of going on up
            go('u', 0.95, how === 'touch' && players === 1 && bi % 2 === 1);
            b = at(slot);
            go('d', 0.95);
            const c = at(slot);
            ok(`climb ${tag}`, b.r === 3 && b.ry < a.ry - 25 && c.r === 2 && c.prog === 0 && c.ry > b.ry + 25, `↑ row ${a.r}→${b.r} (${a.ry}→${b.ry} px on the building), ↓ row ${c.r} (${c.ry} px)`);
            // ↑ at a shut window: he stays on his ledge
            game.put(slot, 2, 3);
            game.setWin(slot, 3, 3, 'shut');
            step(0.05);
            a = at(slot);
            go('u', 0.9);
            b = at(slot);
            ok(`shut window ${tag}`, b.r === 2 && b.prog === 0 && Math.abs(b.ry - a.ry) < 2, `↑ at a shut window: row ${a.r}→${b.r}, moved ${b.ry - a.ry} px`);
          }
        }
      }
      document.body.classList.toggle('touch', hadTouch);

      // ---------- nothing leaves him stuck ----------
      // a window shuts while he's on it, ↑ still held: he slides to the ledge, then walks and climbs again
      for (const level of ['easy', 'normal']) {
        fresh({ level, building: 1 });
        game.put(0, 2, 1);
        const win = game.setWin(0, 3, 1, 'open');
        win.kind = 'busy';
        key('ArrowUp', true);
        step(0.25);
        const m0 = at(0);
        win.t = 0.001; // it starts to shut now
        step(1.5);
        key('ArrowUp', false);
        step(0.05);
        const m1 = at(0);
        press('ArrowRight', 1.25);
        step(0.6);
        const m2 = at(0);
        game.setWin(0, 3, m2.r === 2 ? game.state().towers[0].col : 3, 'open');
        press('ArrowUp', 0.95);
        const m3 = at(0);
        ok(`shut on him ${level}`, m0.prog > 0 && m1.r === 2 && m1.prog === 0 && !m1.sliding && m2.x > m1.x + 2 && m3.r === 3, `on the wall ${m0.prog}, after the shutter: row ${m1.r} prog ${m1.prog}, walked ${(m2.x - m1.x).toFixed(1)} m, climbed to row ${m3.r}`);
      }
      // the middle of the wall: ↓ gets him off, and so does → (back to the nearest ledge, then he walks)
      fresh({ building: 2 });
      game.put(0, 4, 2);
      game.setWin(0, 5, 2, 'open');
      game.setWin(0, 4, 2, 'shut');
      game.setWin(0, 6, 2, 'shut');
      press('ArrowUp', 0.3);
      const w0 = at(0);
      press('ArrowRight', 0.9);
      const w1 = at(0);
      game.put(0, 4, 2);
      press('ArrowUp', 0.3);
      press('ArrowDown', 0.8);
      const w2 = at(0);
      press('ArrowUp', 0.5);
      press('ArrowLeft', 0.9);
      const w3 = at(0);
      game.put(0, 4, 2);
      press('ArrowUp', 0.3);
      press('ArrowUp', 0.8);
      const w4 = at(0);
      ok('middle of the wall', w0.prog > 0 && w1.prog === 0 && w1.r === 4 && w1.x > w0.x + 0.3 && w2.prog === 0 && w2.r === 4 && w3.prog === 0 && w3.r === 5 && w3.x < -0.3 && w4.r === 5 && w4.prog === 0,
        `on the wall ${w0.prog}: → down to row ${w1.r} and walks ${(w1.x - w0.x).toFixed(1)} m; ↓ back to row ${w2.r}; past halfway ← up to row ${w3.r} and walks ${w3.x.toFixed(1)} m; ↑ to row ${w4.r}`);
      // a bonk: dizzy for a moment, then the keys work again
      for (const level of ['easy', 'normal']) {
        fresh({ level, building: 0 });
        game.put(0, 4, 2);
        const Tw = game.world().towers[0];
        Tw.drops.push({ id: 900, kind: 'ball', who: 1, c: 2, row: 6, x: 0, y: 4 * WC.sim.FH + 2.4, st: 'fall', t: 0, warnT: 1, vy: 0, spin: 0, hit: false, passed: false });
        const lives = game.state().players[0].lives;
        let d0 = null;
        for (let i = 0; i < 120 && !d0; i++) { step(1 / 60); if (game.state().players[0].lives < lives) d0 = game.state().towers[0]; }
        step(2);
        game.quiet();
        const a = at(0);
        press('ArrowLeft', 0.45);
        const b = at(0);
        ok(`after a bonk ${level}`, d0 && d0.dizzy > 0 && b.sx < a.sx - 25, `bonked ${!!d0} (dizzy ${d0 && d0.dizzy}), row ${a.r}, then ← ${b.sx - a.sx} px`);
      }
      // the brother holds every window open: keys still move him, and ↑ goes through a stay-shut window
      fresh({ building: 3 });
      const W = game.world(), T3 = W.towers[0];
      const srow = T3.L.kinds.findIndex((k, row) => row > 1 && k.includes('shut'));
      const scol = T3.L.kinds[srow].indexOf('shut');
      game.put(0, srow - 1, scol);
      press('KeyT', 0.05);
      step(1.6);
      let a = at(0);
      key('ArrowUp', true);
      for (let i = 0; i < 90 && game.state().towers[0].r < srow; i++) step(1 / 60);
      key('ArrowUp', false);
      step(1 / 60);
      let b = at(0);
      press('ArrowRight', 0.45);
      const c = at(0);
      ok('during the hold', game.state().hold > 0 && b.r === srow && b.ry < a.ry - 25 && c.sx > b.sx + 20, `hold ${game.state().hold}s, ↑ through a stay-shut window to row ${b.r}, → ${c.sx - b.sx} px`);
      // a key held through pause: no runaway walking or climbing afterwards
      fresh({ building: 0 });
      game.put(0, 2, 2);
      key('ArrowRight', true);
      step(0.2);
      press('KeyP', 0.05);
      key('ArrowRight', false);
      press('KeyP', 0.05);
      a = at(0);
      step(0.6);
      b = at(0);
      game.put(0, 2, 1);
      game.setWin(0, 3, 1, 'open');
      key('ArrowUp', true);
      step(0.2);
      press('KeyP', 0.05);
      key('ArrowUp', false);
      press('KeyP', 0.05);
      const p0 = at(0);
      step(0.6);
      const p1 = at(0);
      // (with no key he only settles in front of the nearest window: never on to the right)
      ok('keys held through pause', !game.state().paused && b.sx - a.sx < 2 && p1.prog === p0.prog, `after resume: walked ${b.sx - a.sx} px (settling), climbed ${(p1.prog - p0.prog).toFixed(2)} with no key held`);
      // the helicopter: ↑ onto the roof, the ride, the next building, and → still goes right there
      fresh({ building: 0 });
      const rows = game.world().towers[0].L.rows;
      game.put(0, rows - 1, 2);
      press('ArrowUp', 0.95);
      const h0 = game.state();
      step(WC.sim.HELI + WC.sim.READY + 0.4);
      game.quiet();
      a = at(0);
      press('ArrowRight', 0.45);
      b = at(0);
      ok('helicopter to the next building', h0.phase === 'heli' && game.state().bi === 1 && game.state().phase === 'play' && b.sx > a.sx + 25, `${h0.phase}, now building ${game.state().bi + 1} (${game.state().phase}), → ${b.sx - a.sx} px`);
      // 2 players: Teddy reaches the roof first; Tommy still climbs with the arrows, then both fly on
      fresh({ players: 2, building: 1 });
      const r2 = game.world().towers[0].L.rows;
      game.put(0, r2 - 1, 2);
      press('KeyW', 0.95);
      const t0 = game.state();
      game.put(1, r2 - 1, 1);
      game.setWin(1, r2 - 1, 1, 'open');
      a = at(1);
      press('ArrowRight', 0.45);
      b = at(1);
      press('ArrowUp', 0.95);
      const t1 = game.state();
      step(WC.sim.HELI + WC.sim.READY + 0.4);
      game.quiet();
      const q0 = at(0), q1 = at(1);
      press('KeyD', 0.45);
      press('ArrowLeft', 0.45);
      const q2 = at(0), q3 = at(1);
      ok('2 players: one finishes first', t0.towers[0].done && !t0.towers[1].done && b.sx > a.sx + 25 && t1.phase === 'heli' && game.state().bi === 2 && q2.sx > q0.sx + 25 && q3.sx < q1.sx - 25,
        `Teddy on the roof ${t0.towers[0].done}, Tommy → ${b.sx - a.sx} px, both done → ${t1.phase}, building ${game.state().bi + 1}: D ${q2.sx - q0.sx} px, ← ${q3.sx - q1.sx} px`);

      // the keyboard kid: random mashing on every building with things dropping; afterwards → still moves him
      let rnd = 7;
      const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
      const MASH = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowUp', 'KeyW'];
      for (let bi = 0; bi < 4; bi++) {
        for (const players of [1, 2]) {
          fresh({ building: bi, players });
          game.world().towers.forEach((Tw) => (Tw.dropT = 0.5)); // things dropping
          game.world().players.forEach((pl) => (pl.lives = 99));
          const down = new Set();
          let errors = 0;
          try {
            for (let i = 0; i < 260; i++) {
              const k = MASH[Math.floor(r() * MASH.length)];
              if (down.has(k)) { key(k, false); down.delete(k); } else { key(k, true); down.add(k); }
              if (r() < 0.04) press('KeyT', 0.02);
              step(0.05 + r() * 0.1);
            }
          } catch (e) { errors++; }
          down.forEach((k) => key(k, false));
          game.quiet();
          step(2.5);
          const s = game.state();
          const moved = [];
          s.towers.forEach((tw, slot) => {
            if (tw.done || s.phase !== 'play') { moved.push('done'); return; }
            const K = KEYS[players === 2 ? slot : 1];
            if (tw.prog > 0) toLedge(slot, K.d);
            const a1 = at(slot);
            press(K.r, 0.4);
            const b1 = at(slot);
            press(K.l, 0.4);
            const c1 = at(slot);
            moved.push(b1.x !== a1.x || c1.x !== b1.x ? 'moves' : 'STUCK');
          });
          ok(`keyboard kid b${bi + 1}${players === 2 ? ' 2P' : ''}`, !errors && !moved.includes('STUCK'), `${errors} errors, ${s.phase}, ${moved.join(' ')}`);
        }
      }
    } finally {
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].forEach((k) => key(k, false));
      game.sabotage(null);
      document.body.classList.toggle('touch', hadTouch);
      game.hold(wasHold);
    }
    const failed = results.filter((x) => !x.ok);
    return { ok: !failed.length, total: results.length, failed: failed.map((x) => `${x.name}: ${x.info}`), results };
  }
  game.playCheck = run;
})();
/* the layout check (tools/layout.json): the kit's left-edge buttons, the HUD and the touch buttons never cover the
   tower around the climber, or each other, and every touch button is a big target. */
window.layoutCheck = function () {
  const r = (el) => el && el.getBoundingClientRect();
  const hit = (a, b) => a && b && a.width && b.width && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const shown = (e) => e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
  const kit = ['kit-help-btn', 'kit-lang-btn', 'kit-sound-btn'].map((id) => document.getElementById(id)).filter(shown);
  const ctrls = [...document.querySelectorAll('#touch .dk, #touch .tb')].filter(shown);
  const hud = [...document.querySelectorAll('.box, .ibtn, .bud')].filter(shown);
  const w = game.world(), bad = [], areas = [];
  w.towers.forEach((Tw, slot) => {
    const ox = game.towerX(slot), y = WC.sim.y(Tw);
    const [x0, y0] = game.toScreen(slot, ox - 4.2, y + 4.2, 0.5); // the climber's floor, and the window above him
    const [x1, y1] = game.toScreen(slot, ox + 4.2, y - 0.2, 0.5);
    const area = { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 };
    areas.push([Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)]);
    for (const k of kit) if (hit(r(k), area)) bad.push(k.id + ' x tower ' + slot);
    for (const c of ctrls) if (hit(r(c), area)) bad.push((c.dataset.k || c.className) + ' x tower ' + slot);
    for (const h of hud) if (hit(r(h), area)) bad.push((h.id || h.className) + ' x tower ' + slot);
  });
  for (const k of kit) for (const c of ctrls.concat(hud)) if (hit(r(k), r(c))) bad.push(k.id + ' x ' + (c.dataset.k || c.id || c.className));
  for (const c of ctrls) for (const d of ctrls) if (c !== d && hit(r(c), r(d))) bad.push((c.dataset.k || c.className) + ' x ' + (d.dataset.k || d.className));
  const small = ctrls.map((e) => Math.round(Math.min(r(e).width, r(e).height)));
  return { size: innerWidth + 'x' + innerHeight, touch: document.body.classList.contains('touch'), towers: areas, bad: [...new Set(bad)], smallestTap: small.length ? Math.min(...small) : null };
};

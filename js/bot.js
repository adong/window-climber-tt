/* TT Window Climber: the autopilot. It plays the title screen's demo and the headless check's "climbs every building on
   EASY", through the same input a kid gives ({ lr, ud }). On a ledge it steps out from under anything a resident is
   about to drop, walks to the nearest window above that is open (and will stay open long enough), and climbs. */
(function (root) {
  'use strict';
  const WC = (root.WC = root.WC || {});
  function decide(w, i) {
    if (w.sab === 'lazyBot') return {};
    const S = WC.sim, T = w.towers[i || 0], p = T.p, L = T.L, cfg = w.cfg;
    if (w.phase !== 'play' || p.mode === 'top' || p.sliding || p.dizzy > 0) return {};
    const py = S.y(T);
    if (p.prog > 0) return { ud: 1 }; // on the wall: finish the climb (the window was open for long enough)
    const need = 2 * cfg.half + 0.4;
    const danger = (c) => T.drops.some((d) => d.c === c && !d.hit && (d.st === 'warn' || d.y > py - 0.2));
    const row = p.r + 1;
    const good = (c) => {
      if (danger(c)) return false;
      if (row >= L.rows) return true;
      const win = T.wins[row][c];
      if (win.st !== 'open') return false;
      if (win.held) return w.hold > need || win.kind !== 'shut';
      return win.kind === 'open' || win.t > need;
    };
    const dist = (c) => Math.abs(S.colX(L, c) - p.x);
    let best = -1;
    for (let c = 0; c < L.cols; c++) if (good(c) && (best < 0 || dist(c) < dist(best))) best = c;
    if (best < 0) {
      // nothing to climb right now: wait in front of a safe window that will open (never under a resident)
      for (let c = 0; c < L.cols; c++) {
        if (danger(c)) continue;
        const k = row < L.rows ? T.wins[row][c].kind : 'open';
        const score = dist(c) + (k === 'shut' ? 20 : 0);
        if (best < 0 || score < dist(best) + (T.wins[row] && T.wins[row][best] && T.wins[row][best].kind === 'shut' ? 20 : 0)) best = c;
      }
      if (best < 0) best = S.nearestCol(L, p.x);
      const nc = S.nearestCol(L, p.x);
      return nc === best ? {} : { lr: Math.sign(S.colX(L, best) - p.x) };
    }
    const nc = S.nearestCol(L, p.x);
    if (nc !== best) return { lr: Math.sign(S.colX(L, best) - p.x) };
    return { ud: 1 };
  }
  WC.bot = { decide };
})(typeof window !== 'undefined' ? window : globalThis);

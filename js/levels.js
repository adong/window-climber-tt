/* TT Window Climber: the four toy skyscrapers. Each is a grid of windows, cols wide and rows high: row 0 is the street,
   rows 1 .. rows-1 have windows, and row `rows` is the roof where the helicopter waits.
   Window kinds: 'open' always open, 'busy' slides shut and open again, 'shut' stays shut (a sleepy resident inside).
   Every window row keeps at least one always-open window, so there is always a way up: you can wait, or move over. */
(function (root) {
  'use strict';
  const WC = (root.WC = root.WC || {});
  const B = [
    { id: 'candy', name: 'CANDY TOWER', cols: 5, rows: 10, busy: [0.3, 0.45], shut: [0.08, 0.14] },
    { id: 'mint', name: 'MINT HEIGHTS', cols: 5, rows: 12, busy: [0.38, 0.55], shut: [0.1, 0.16] },
    { id: 'sunny', name: 'SUNNY SPIRE', cols: 5, rows: 14, busy: [0.44, 0.62], shut: [0.12, 0.18] },
    { id: 'star', name: 'STARRY SKYSCRAPER', cols: 5, rows: 16, busy: [0.5, 0.68], shut: [0.12, 0.2] },
  ];
  // a small seeded random (the same seed builds the same building, so 2 players race on twins)
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  }
  function layout(bi, seed, level) {
    const b = B[bi];
    const r = rng(seed * 7 + bi * 101 + 13);
    const hard = level === 'normal' ? 1 : 0;
    const kinds = [];
    for (let row = 0; row <= b.rows; row++) {
      const k = [];
      for (let c = 0; c < b.cols; c++) {
        if (row === 0 || row === b.rows) { k.push('none'); continue; }
        const u = r();
        k.push(u < b.shut[hard] ? 'shut' : u < b.shut[hard] + b.busy[hard] ? 'busy' : 'open');
      }
      if (row > 0 && row < b.rows && !k.includes('open')) k[Math.floor(r() * b.cols)] = 'open';
      kinds.push(k);
    }
    return { index: bi, id: b.id, name: b.name, cols: b.cols, rows: b.rows, kinds };
  }
  WC.levels = { list: B, count: B.length, names: B.map((b) => b.name), ids: B.map((b) => b.id), layout, rng };
})(typeof window !== 'undefined' ? window : globalThis);

/* TT Window Climber: the page. The Three.js scene with a fixed arcade camera that rides up with the climber (two side
   by side for 2 players), the HUD and screens, keys and touch, the brother who pops in to hold the windows open, the
   residents and their soft drops, the helicopter, the celebrations, and the window.game test hooks.
   The rules are js/sim.js (fixed 1/60 s steps); the 3D things are js/art.js; sounds are js/sfx.js. */
(function () {
  'use strict';
  const T = THREE, S = WC.sim, A = WC.art, SFX = WC.sfx;
  const $ = (id) => document.getElementById(id);
  const PI = Math.PI, DT = S.DT, FH = S.FH;
  const KEY = 'windowClimberTT.v1';
  const NAME = (id) => (Kit.roster.get(id) || { name: id.toUpperCase() }).name;
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const SCALE = 0.58; // the kit's people are 2 m tall; climbers here are about 1.2 m
  const FRIENDS = { easy: [['foxy', 9000], ['froggy', 6000]], normal: [['foxy', 14000], ['froggy', 9000]] };
  const BW = 10.4, BH = 10.6; // what the camera must show: the tower's width, and about six floors
  const GAP = 6.1; // 2 players: each twin tower's middle sits this far from the middle
  const ITEM_WORDS = { pillow: 'FLUMP!', ball: 'BOING!', duck: 'SQUEAK!' };

  const store = {
    d: {},
    load() {
      try { this.d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { this.d = {}; }
      this.d.top = this.d.top || {};
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* private mode: fine */ } },
    table(level) {
      const t = (this.d.top[level] || []).slice();
      for (const [who, score] of FRIENDS[level]) if (!t.some((r) => r.who === who && r.cpu)) t.push({ who, score, cpu: true });
      return t.sort((a, b) => b.score - a.score).slice(0, 6);
    },
    add(level, who, score) {
      if (!score) return null;
      const row = { who, score, at: Date.now() };
      const mine = (this.d.top[level] || []).concat([row]).sort((a, b) => b.score - a.score).slice(0, 5);
      this.d.top[level] = mine;
      this.save();
      return mine.includes(row) ? row : null;
    },
  };

  const G = {
    screen: 'loading', w: null, demo: false, paused: false, hold: false, autoPause: true,
    keys: {}, taps: [{}, {}], pressed: new Set(), acc: 0, time: 0,
    players: 1, who: 'teddy', level: 'easy', sab: null, botInp: [{}, {}], botK: 0,
    views: [], vps: [], camY: [0, 0], snap: true, scene2: null, overT: 0, newRows: [], frame: 0, lastWalk: [0, 0], knockPop: [0, 0], plopT: 0,
  };
  let renderer, scene, backdrop, confetti, buddyCloud, treat, last = 0;
  const cams = [], helis = [], starsFx = [], balls = [], peaces = [];
  const people = {};
  let portraits = {};
  const v3 = new T.Vector3();

  function Pool(make) {
    const items = [];
    let n = 0;
    return {
      begin() { n = 0; },
      get() { if (n >= items.length) { const o = make(); scene.add(o); items.push(o); } const o = items[n++]; o.visible = true; return o; },
      end() { for (let i = n; i < items.length; i++) items[i].visible = false; },
    };
  }
  let residents, shadows;
  const itemPools = {};

  // ---------- start-up ----------
  function boot() {
    renderer = new T.WebGLRenderer({ canvas: $('game'), antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(2, Math.max(1, devicePixelRatio || 1)));
    renderer.autoClear = true;
    scene = new T.Scene();
    scene.background = new T.Color('#9fdcff');
    scene.fog = new T.Fog('#9fdcff', 40, 120); // the far toy city fades into the sky (fit() sets the distances)
    for (let i = 0; i < 2; i++) cams.push(new T.PerspectiveCamera(30, 1, 1, 400));
    scene.add(new T.HemisphereLight('#ffffff', '#c9b48a', 0.85));
    const sun = new T.DirectionalLight('#fff4dd', 0.75);
    sun.position.set(-8, 30, 30);
    scene.add(sun);
    backdrop = A.backdrop(scene);
    confetti = A.confetti(scene, 700);
    for (const id of ['teddy', 'tommy', 'foxy', 'froggy']) {
      const r = Kit.roster.get(id);
      const p = Kit.people.build(r.look);
      p.root.scale.setScalar(SCALE);
      p.root.visible = false;
      scene.add(p.root);
      people[id] = p;
    }
    for (let i = 0; i < 2; i++) {
      const h = A.heli(i ? '#18b4ff' : '#ff3d7f');
      h.visible = false;
      scene.add(h);
      helis.push(h);
      const st = A.stars();
      st.visible = false;
      scene.add(st);
      starsFx.push(st);
      const b = A.emoji('🏀', 0.4);
      b.visible = false;
      scene.add(b);
      balls.push(b);
      const pc = A.emoji('✌️', 0.45);
      pc.visible = false;
      scene.add(pc);
      peaces.push(pc);
    }
    buddyCloud = A.cloud();
    buddyCloud.visible = false;
    scene.add(buddyCloud);
    treat = A.emoji('🍦', 0.5);
    treat.visible = false;
    scene.add(treat);
    residents = Pool(() => A.resident());
    shadows = Pool(() => A.shadow());
    for (const k of ['pillow', 'ball', 'duck']) itemPools[k] = Pool(() => A.item(k));
    portraits = Kit.portraits(['teddy', 'tommy', 'foxy', 'froggy'].map((id) => Kit.roster.get(id)), { size: 128 });
    store.load();
    const o = store.d.opts || {};
    if (o.players === 2) G.players = 2;
    if (o.who === 'tommy') G.who = 'tommy';
    if (o.level === 'normal') G.level = 'normal';
    setupUI();
    Kit.lang.onChange(() => G.views.forEach((v) => v && v.view.drawSign()));
    addEventListener('resize', fit);
    showTitle();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }

  // ---------- the fixed arcade camera: one per tower, riding up with its climber ----------
  const towerX = (slot) => (G.w && G.w.two ? (slot ? GAP : -GAP) : 0);
  function fit() {
    const W = innerWidth, H = innerHeight;
    renderer.setSize(W, H, false);
    const two = !!(G.w && G.w.two && !G.demo);
    const n = two ? 2 : 1;
    const short = H <= 460, narrow = W <= 520;
    const touch = document.body.classList.contains('touch') && (G.screen === 'play' || G.screen === 'pause');
    G.vps = [];
    for (let i = 0; i < n; i++) {
      const vx = two ? Math.round((i * W) / 2) : 0, vw = two ? Math.round(W / 2) : W;
      let top = short ? 52 : narrow ? 62 : 72, bottom = 6, left = i === 0 ? 58 : 8, right = 10;
      if (G.screen === 'title' || G.screen === 'results') top = 6;
      if (touch) {
        const s = short ? 0.82 : 1;
        if (two) bottom = 64 * (narrow ? 0.8 : s) + 22; // a row of ◀ ▲ ▶ under each tower
        else if (H > W) bottom = 186 * s + 18;
        else { left = 64 + 186 * s + 4; right = 190 * s + 20; }
      }
      const sw = Math.max(50, vw - left - right), sh = Math.max(50, H - top - bottom);
      const k = Math.min(sw / BW, sh / BH);
      const viewH = H / k;
      const D = viewH / 2 / Math.tan((cams[i].fov * PI) / 360);
      const cam = cams[i];
      cam.aspect = vw / H;
      cam.near = Math.max(1, D * 0.4);
      cam.far = D + 160;
      cam.updateProjectionMatrix();
      G.vps.push({ x: vx, w: vw, k, D, offX: left + sw / 2 - vw / 2, offY: top + sh / 2 - H / 2, sw, sh, cam });
    }
    $('split').style.left = two ? Math.round(W / 2) + 'px' : '';
    scene.fog.near = G.vps[0].D + 8;
    scene.fog.far = G.vps[0].D + 70;
    G.snap = true;
    if (G.w) placeCams(0);
  }
  function followY(slot) {
    const w = G.w, Tw = w.towers[slot], top = Tw.L.rows * FH;
    const sc = G.scene2;
    if (sc && sc.kind === 'win') return sc.roof ? top + 1.2 : 2.5;
    if (w.phase === 'heli' || (Tw.done && w.phase !== 'ready')) return heliPos(slot).y - 2.2;
    return S.y(Tw) + 1.5;
  }
  function placeCams(dt) {
    if (!G.w) return;
    G.vps.forEach((vp, i) => {
      const Tw = G.w.towers[i];
      if (!Tw) return;
      const halfH = vp.sh / vp.k / 2;
      const lo = -0.9 + halfH, hi = Tw.L.rows * FH + 12 - halfH;
      const want = Math.max(lo, Math.min(Math.max(lo, hi), followY(i)));
      G.camY[i] += (want - G.camY[i]) * (G.snap ? 1 : 1 - Math.exp(-5 * dt));
      const cx = towerX(i) - vp.offX / vp.k, cy = G.camY[i] + vp.offY / vp.k;
      vp.cam.position.set(cx, cy, vp.D);
      vp.cam.lookAt(cx, cy, 0);
      vp.cam.updateMatrixWorld();
    });
    G.snap = false;
  }
  function toScreen(slot, x, y, z) {
    const vp = G.vps[Math.min(slot || 0, G.vps.length - 1)];
    if (!vp) return [0, 0];
    v3.set(x, y, z || 0).project(vp.cam);
    return [vp.x + (v3.x * 0.5 + 0.5) * vp.w, (-v3.y * 0.5 + 0.5) * innerHeight];
  }

  // ---------- games ----------
  function newWorld(demo) {
    const who = demo ? ['teddy'] : G.players === 2 ? ['teddy', 'tommy'] : [G.who];
    return S.create({ level: demo ? 'easy' : G.level, players: who, seed: (Math.random() * 1e9) | 0, buddyFor: (id) => Kit.roster.buddyFor(id) });
  }
  function play() {
    Kit.sound.init();
    store.d.opts = { players: G.players, who: G.who, level: G.level };
    store.save();
    G.w = newWorld(false);
    G.demo = false;
    G.paused = false;
    G.overT = 0;
    G.scene2 = null;
    G.keys = {};
    G.taps = [{}, {}];
    releaseTouch();
    G.acc = 0;
    confetti.clear();
    clearPops();
    $('toast').classList.remove('show');
    showScreen('play');
    setupBud();
    big('READY?', buildingLine());
    Kit.sound.music('play');
  }
  function setupBud() {
    const w = G.w;
    const who = w.two ? null : Kit.roster.buddyFor(w.players[0].who);
    const img = w.two ? '' : portraits[who];
    $('budBtn').querySelector('img').src = img || '';
    document.querySelector('.tb.call img').src = img || '';
    $('budBtn').querySelector('img').style.display = w.two ? 'none' : '';
    setText($('budLbl'), w.two ? 'HIGH FIVE ✋' : `CALL ${NAME(who)}`);
  }
  function call() {
    if (!G.w || G.demo || G.screen !== 'play' || G.paused) return false;
    const ok = S.call(G.w);
    if (ok) handleEvents(G.w.events.splice(0));
    return ok;
  }

  // ---------- screens ----------
  function showScreen(id) {
    G.screen = id;
    for (const s of ['title', 'pause', 'results']) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', id === 'title' || id === 'results');
    $('touch').classList.toggle('hidden', id !== 'play');
    $('menuMute').classList.toggle('hidden', id === 'play' || id === 'pause');
    document.body.classList.toggle('title', id === 'title');
    document.body.classList.toggle('playing', id === 'play' || id === 'pause');
    document.body.classList.toggle('two', !!(G.w && G.w.two && !G.demo));
    if (id !== 'play' && id !== 'pause') { $('bigmsg').classList.remove('show'); $('toast').classList.remove('show'); clearPops(); }
    fit();
  }
  function showTitle() {
    G.w = newWorld(true);
    G.demo = true;
    G.paused = false;
    G.scene2 = null;
    confetti.clear();
    clearPops();
    showScreen('title');
    refreshTitle();
    Kit.sound.music('title');
  }
  function refreshTitle() {
    document.querySelectorAll('[data-players]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.players === G.players)));
    document.querySelectorAll('[data-who]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.who === G.who)));
    document.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === G.level)));
    $('whoRow').classList.toggle('off', G.players === 2);
    const top = store.table(G.level)[0];
    setText($('titleHi'), `HI-SCORE ${fmt(top.score)} · ${NAME(top.who)}`);
  }
  function setOpt(k, v) {
    G[k] = v;
    SFX.click();
    refreshTitle();
  }
  function releaseTouch() {
    G.pressed.clear();
    document.querySelectorAll('#touch .down').forEach((b) => b.classList.remove('down'));
  }
  function pause() {
    if (G.screen !== 'play' || G.paused) return;
    G.paused = true;
    showScreen('pause');
    Kit.sound.music('pause');
  }
  function resume() {
    if (!G.paused) return;
    G.paused = false;
    G.keys = {};
    releaseTouch();
    showScreen('play');
    Kit.sound.music('play');
  }
  function showResults() {
    const w = G.w;
    const ps = w.players;
    const bestScore = Math.max(...ps.map((p) => p.score));
    const winners = ps.filter((p) => p.score === bestScore);
    G.newRows = ps.map((p) => store.add(w.level, p.who, p.score)).filter(Boolean);
    const title = $('resTitle');
    const allDone = w.phase === 'win';
    if (ps.length === 2) setText(title, winners.length === 2 ? "IT'S A TIE!" : `${NAME(winners[0].who)} WINS!`);
    else setText(title, allDone ? 'ALL 4 CLIMBED!' : 'GREAT CLIMBING!');
    const pl = ps[0];
    setText($('resSub'), ps.length === 2
      ? `${NAME(ps[0].who)} ${fmt(ps[0].score)} (${ps[0].wins} 🏆) · ${NAME(ps[1].who)} ${fmt(ps[1].score)} (${ps[1].wins} 🏆)`
      : `${fmt(pl.score)} points · building ${w.bi + 1} of 4`);
    const rows = store.table(w.level);
    const tb = $('resTable');
    tb.innerHTML = '';
    const cap = document.createElement('caption');
    cap.textContent = w.level === 'easy' ? '🐣 TOP CLIMBERS' : '🔥 TOP CLIMBERS';
    tb.appendChild(cap);
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (G.newRows.some((n) => n.at === r.at && n.who === r.who && n.score === r.score)) tr.className = 'me';
      tr.innerHTML = `<td class="rk">${i + 1}</td><td class="who"><img alt="" src="${portraits[r.who] || ''}"><span>${NAME(r.who)}</span></td><td class="pts">${fmt(r.score)}</td>`;
      tb.appendChild(tr);
    });
    const best = $('resBest');
    const isTop = G.newRows.some((n) => rows[0] && n.score === rows[0].score && n.who === rows[0].who && n.at === rows[0].at);
    setText(best, isTop ? '⭐ NEW HI-SCORE!' : G.newRows.length ? '⭐ ON THE BOARD!' : '');
    best.classList.toggle('new', G.newRows.length > 0);
    G.scene2 = { kind: 'win', who: winners.map((p) => p.who), t: 0, roof: allDone };
    showScreen('results');
    G.snap = true;
    Kit.sound.music('over');
  }

  // ---------- keys and touch ----------
  const DIRS = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
  // 2 players: Teddy (left tower) has W A S D, Tommy (right tower) has the arrows. 1 player: both work.
  const sideOf = (code) => (code.startsWith('Arrow') ? 1 : 0);
  function held(slot, d) {
    const two = G.w && G.w.two;
    for (const c in G.keys) if (G.keys[c] && DIRS[c] === d && (!two || sideOf(c) === slot)) return true;
    for (const el of G.pressed) if (el.k === d && (!two || el.pad === slot)) return true;
    return !!G.taps[slot][d];
  }
  function readInput(slot) {
    let lr = (held(slot, 'r') ? 1 : 0) - (held(slot, 'l') ? 1 : 0);
    let ud = (held(slot, 'u') ? 1 : 0) - (held(slot, 'd') ? 1 : 0);
    if (G.sab === 'mirror') lr = -lr; // the play check's own sabotage
    if (G.sab === 'stuckWall' && G.w.towers[slot].p.prog > 0) ud = 0;
    return { lr, ud };
  }
  function setupUI() {
    const logo = () => {
      const zh = Kit.lang.is('zh');
      $('logoText').textContent = zh ? WC.ZH : WC.TITLE;
      $('logoSub').textContent = zh ? WC.TITLE : '';
    };
    $('tagline').textContent = WC.TAGLINE;
    logo();
    Kit.lang.onChange(logo);
    document.querySelectorAll('[data-who] img').forEach((im) => (im.src = portraits[im.parentNode.dataset.who] || ''));
    document.querySelectorAll('[data-players]').forEach((b) => b.addEventListener('click', () => setOpt('players', +b.dataset.players)));
    document.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => setOpt('who', b.dataset.who)));
    document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => setOpt('level', b.dataset.level)));
    $('startBtn').addEventListener('click', play);
    $('pauseBtn').addEventListener('click', pause);
    $('resumeBtn').addEventListener('click', resume);
    $('quitBtn').addEventListener('click', showTitle);
    $('againBtn').addEventListener('click', play);
    $('menuBtn').addEventListener('click', showTitle);
    $('budBtn').addEventListener('click', call);
    const syncMute = () => document.querySelectorAll('.muteBtn').forEach((b) => (b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊'));
    document.querySelectorAll('.muteBtn').forEach((b) => b.addEventListener('click', () => { Kit.sound.init(); Kit.sound.toggleMute(); syncMute(); }));
    Kit.sound.onMute(syncMute);
    syncMute();

    addEventListener('pointerdown', (e) => {
      Kit.sound.init();
      if (e.pointerType === 'touch' && !document.body.classList.contains('touch')) {
        document.body.classList.add('touch');
        fit();
      }
    }, true);
    if (matchMedia('(hover: none) and (pointer: coarse)').matches || /[?&]touch=1/.test(location.search)) document.body.classList.add('touch');

    addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      Kit.sound.init();
      const c = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
      if (c === 'KeyM' && !e.repeat) { Kit.sound.toggleMute(); syncMute(); return; }
      if (G.screen === 'title') {
        if (e.repeat) return;
        if (c === 'Digit1') setOpt('players', 1);
        else if (c === 'Digit2') setOpt('players', 2);
        else if (c === 'KeyE') setOpt('level', 'easy');
        else if (c === 'KeyN') setOpt('level', 'normal');
        else if ((c === 'KeyC' || c === 'ArrowLeft' || c === 'ArrowRight') && G.players === 1) setOpt('who', G.who === 'teddy' ? 'tommy' : 'teddy');
        else if (c === 'Enter' || c === 'Space') play();
        return;
      }
      if (G.screen === 'results') {
        if (e.repeat) return;
        if (c === 'Enter' || c === 'Space') play();
        else if (c === 'Escape' || c === 'KeyQ') showTitle();
        return;
      }
      if (G.paused) {
        if (e.repeat) return;
        if (c === 'KeyP' || c === 'Escape' || c === 'Space' || c === 'Enter') resume();
        else if (c === 'KeyQ') showTitle();
        return;
      }
      if (G.screen === 'play') {
        if ((c === 'KeyP' || c === 'Escape') && !e.repeat) return pause();
        if ((c === 'KeyT' || c === 'Enter' || c === 'NumpadEnter') && !e.repeat) { call(); return; }
        G.keys[c] = true;
        if (DIRS[c]) { const s = G.w.two ? sideOf(c) : 0; G.taps[s][DIRS[c]] = true; } // a tap shorter than a frame still moves
      }
    });
    addEventListener('keyup', (e) => { G.keys[e.code] = false; });
    addEventListener('blur', () => { G.keys = {}; releaseTouch(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && G.autoPause && G.screen === 'play' && !G.paused) pause();
      if (document.hidden) Kit.sound.suspend();
      else Kit.sound.resume();
    });

    // touch: the arrow crosses, the CLIMB button, the brother's face (2 players: the high five)
    const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* a test's pointer: fine */ } };
    document.querySelectorAll('#touch [data-k]').forEach((b) => {
      const k = b.dataset.k;
      const padEl = b.closest('[data-pad]');
      const rec = { k, pad: padEl ? +padEl.dataset.pad : 0 };
      const on = (v) => {
        b.classList.toggle('down', v);
        if (k === 'call') { if (v) call(); return; }
        if (v) { G.pressed.add(rec); G.taps[rec.pad][k] = true; } else G.pressed.delete(rec);
      };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); capture(b, e); on(true); });
      b.addEventListener('pointerup', () => on(false));
      b.addEventListener('pointercancel', () => on(false));
      b.addEventListener('lostpointercapture', () => on(false));
    });
  }

  // ---------- each frame ----------
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - (last || now)) / 1000));
    last = now;
    if (!G.hold) advance(dt);
    draw();
  }
  function advance(dt) {
    G.time += dt;
    G.frame++;
    const w = G.w;
    if (!w) return;
    const frozen = G.paused || G.screen === 'pause';
    if (!frozen) {
      G.acc = Math.min(G.acc + dt, 0.25);
      while (G.acc >= DT - 1e-9) {
        G.acc -= DT;
        tick();
      }
      visuals(dt);
    }
  }
  function tick() {
    const w = G.w;
    let inps;
    if (G.demo) {
      if (G.botK++ % 3 === 0) G.botInp = w.towers.map((T, i) => WC.bot.decide(w, i));
      inps = G.botInp;
    } else if (G.screen === 'play') {
      inps = w.towers.map((T, i) => readInput(i));
      G.taps = [{}, {}];
    } else inps = [];
    S.step(w, inps);
    handleEvents(w.events);
    if (G.demo) {
      if (w.phase === 'over' || w.phase === 'win' || w.t > 240) { G.w = newWorld(true); G.snap = true; }
    } else if ((w.phase === 'over' || w.phase === 'win') && G.screen === 'play') {
      G.overT += DT;
      if (G.overT > (w.phase === 'win' ? 0.4 : 2.2)) showResults();
    }
  }

  // ---------- what the rules said happened ----------
  function handleEvents(evs) {
    const w = G.w;
    const loud = !G.demo;
    const snd = (f, ...a) => { if (loud) f(...a); };
    const at = (slot) => { const Tw = w.towers[slot || 0]; return [towerX(slot || 0) + Tw.p.x, S.y(Tw)]; };
    for (const e of evs) {
      const s = e.slot || 0;
      switch (e.type) {
        case 'go': snd(SFX.go); big('GO!'); break;
        case 'hand': snd(SFX.hand, e.hand === 'R'); break;
        case 'ledge': snd(SFX.ledge); break;
        case 'row': { snd(SFX.row, Math.min(8, e.row >> 1)); const [x, y] = at(s); pop(s, x, y + 1.6, '+50'); break; }
        case 'knock': if (G.time - G.knockPop[s] > 1.4) { G.knockPop[s] = G.time; const [x, y] = at(s); pop(s, x, y + 1.9, 'SHUT! WAIT OR MOVE OVER', 'cool'); } snd(SFX.knock); break;
        case 'winShut': snd(SFX.winShut); break;
        case 'shutOut': { snd(SFX.shutOut); const [x, y] = at(s); pop(s, x, y + 1.7, 'WHOOPS! WHEEE!', 'cool'); break; }
        case 'warn': { snd(SFX.warn); const d = w.towers[s].drops.find((q) => q.id === e.id); if (d) pop(s, towerX(s) + d.x, d.y + 1.3, 'HEADS UP!'); break; }
        case 'fall': snd(SFX.fall); break;
        case 'bonk': {
          snd(SFX.bonk, e.kind);
          const [x, y] = at(s);
          pop(s, x, y + 1.8, ITEM_WORDS[e.kind] || 'BONK!', 'ouch');
          confetti.burst(x, y + 1.3, 0.8, e.kind === 'pillow' ? 24 : 12, 2.5, e.kind === 'pillow' ? ['#ffffff', '#ffe0f0'] : e.kind === 'duck' ? ['#ffd60a', '#ffffff'] : undefined);
          break;
        }
        case 'plop': if (loud && G.time - G.plopT > 0.3) { G.plopT = G.time; SFX.plop(); } break;
        case 'dodge': { snd(SFX.dodge); pop(s, towerX(s) + e.x, e.y + 1.9, '+50 MISSED ME!'); break; }
        case 'extraLife': { snd(SFX.life); const [x, y] = at(0); pop(0, x, y + 2.2, 'EXTRA LIFE!', 'big'); break; }
        case 'top': {
          snd(SFX.top);
          const [x, y] = at(s);
          confetti.burst(x, y + 1, 0.8, 50, 5);
          if (!w.two) big('TOP!', `BONUS +${fmt(e.bonus)}`);
          else pop(s, x, y + 2, `TOP! +${fmt(e.bonus)}`, 'big');
          break;
        }
        case 'first': snd(SFX.first); toast(`${NAME(w.players[s].who)} IS FIRST! +2000`); break;
        case 'heli': snd(SFX.heli); if (!w.two) toast('HELICOPTER RIDE!'); break;
        case 'building': big(WC.levels.names[w.bi], buildingLine()); G.snap = true; break;
        case 'win': snd(SFX.win); break;
        case 'over': snd(SFX.gameOver); big('GAME OVER'); break;
        case 'buddyIn': { snd(SFX.buddy); const [x, y] = at(0); confetti.burst(x - (w.towers[0].p.face || 1), y + 1, 0.8, 16, 2.5, ['#ffffff', '#bff3ff']); break; }
        case 'treat': { snd(SFX.treat); const [x, y] = at(0); pop(0, x, y + 1.9, `${e.e} +100`); break; }
        case 'hold': snd(SFX.hold); toast(`${NAME(e.who)} SAYS: I'LL HOLD THE WINDOWS!`); break;
        case 'buddyOut': snd(SFX.unhold); break;
        case 'hi5': snd(SFX.hi5); w.towers.forEach((Tw, i) => { const [x, y] = at(i); pop(i, x, y + 2, 'HIGH FIVE! ✋ +50', 'big'); }); break;
      }
    }
  }
  const buildingLine = () => (G.w ? `BUILDING ${G.w.bi + 1} OF 4` : '');

  // ---------- pops, toasts, big words (page text, so 中文 works by itself) ----------
  function pop(slot, x, y, text, cls) {
    if (G.demo) return;
    const [sx, sy] = toScreen(slot, x, y, 0.6);
    const d = document.createElement('div');
    d.className = 'pop' + (cls ? ' ' + cls : '');
    d.textContent = text;
    d.style.left = sx + 'px';
    d.style.top = sy + 'px';
    $('pops').appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }
  function clearPops() { $('pops').innerHTML = ''; }
  let toastTimer = 0;
  function toast(text) {
    if (G.demo) return;
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }
  let bigTimer = 0;
  function big(text, small) {
    if (G.demo) return;
    const b = $('bigmsg');
    b.innerHTML = '';
    b.appendChild(document.createTextNode(text));
    if (small) { const s = document.createElement('small'); s.textContent = small; b.appendChild(s); }
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(bigTimer);
    bigTimer = setTimeout(() => b.classList.remove('show'), 1500);
  }
  function setText(el, s) {
    if (el._t === s) return;
    el._t = s;
    el.textContent = s;
  }

  // ---------- drawing the world ----------
  function syncViews() {
    const w = G.w;
    w.towers.forEach((Tw, slot) => {
      let v = G.views[slot];
      if (!v || v.L !== Tw.L) {
        if (v) {
          scene.remove(v.view.group);
          v.view.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        }
        const view = A.tower(Tw.L);
        scene.add(view.group);
        v = G.views[slot] = { L: Tw.L, view };
        if (slot === 0) backdrop.setLook(Tw.L.id, scene);
      }
      v.view.group.position.x = towerX(slot);
      v.view.group.visible = true;
    });
    for (let i = w.towers.length; i < G.views.length; i++) if (G.views[i]) G.views[i].view.group.visible = false;
  }
  const FACE_R = -2.02, FACE_L = 2.02;
  const turn = (cur, want, k) => cur + (((want - cur + PI * 3) % (PI * 2)) - PI) * k;
  function signature(who, n) {
    const sig = (Kit.roster.get(who) || {}).signature || ['wave'];
    return sig[(n || 0) % sig.length];
  }
  function heliPos(slot) {
    const w = G.w, Tw = w.towers[slot], top = Tw.L.rows * FH;
    let x = towerX(slot) + 0.4, y = top + 3.6 + Math.sin(G.time * 2 + slot) * 0.12;
    if (w.phase === 'heli') {
      const u = Math.max(0, w.phaseT - 0.7) / (S.HELI - 0.7);
      y += u * u * 20;
      x += u * u * 8 * (slot ? 1 : w.two ? -1 : 1);
    }
    return { x, y, z: -0.2 };
  }
  function visuals(dt) {
    const w = G.w;
    syncViews();
    const k = 1 - Math.exp(-16 * dt);
    for (const c of backdrop.clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 60) c.position.x = -60; }
    residents.begin();
    shadows.begin();
    for (const kd in itemPools) itemPools[kd].begin();
    for (const id of ['teddy', 'tommy', 'foxy', 'froggy']) people[id].root.visible = false;
    helis.forEach((h) => (h.visible = false));
    balls.forEach((b) => (b.visible = false));
    peaces.forEach((b) => (b.visible = false));
    starsFx.forEach((b) => (b.visible = false));
    const sc = G.scene2;
    if (sc) sc.t += dt;
    w.towers.forEach((Tw, slot) => {
      towerVisuals(slot, dt);
      if (sc && sc.kind === 'win') return;
      climber(slot, dt, k);
      heli(slot, dt, k);
    });
    if (sc && sc.kind === 'win') winPose(sc, dt, k);
    buddy(dt, k);
    spectators(dt, k);
    residents.end();
    shadows.end();
    for (const kd in itemPools) itemPools[kd].end();
    confetti.update(dt);
    if (sc && sc.kind === 'win' && Math.floor(sc.t * 2) !== Math.floor((sc.t - dt) * 2)) {
      const y = sc.roof ? w.towers[0].L.rows * FH + 4 : 6;
      confetti.rain(towerX(0) - 6, towerX(w.towers.length - 1) + 6, y, 30);
    }
    placeCams(dt);
    hud();
  }

  function towerVisuals(slot, dt) {
    const w = G.w, Tw = w.towers[slot], V = G.views[slot].view, p = Tw.p, ox = towerX(slot), L = Tw.L;
    const held = !w.two && w.hold > 0;
    V.setWindows(Tw.wins, held);
    // the window he'd climb into: a green frame when it's open, red when it's not
    const r1 = p.r + 1;
    const ringOn = !G.demo && w.phase === 'play' && p.mode !== 'top' && r1 < L.rows && !p.sliding;
    V.ring.visible = ringOn;
    if (ringOn) {
      const c = p.prog > 0 ? p.col : S.nearestCol(L, p.x);
      const [x, y] = V.winPos(r1, c);
      V.ring.position.set(x, y, 0);
      V.ringMat.color.set(S.climbable(w, Tw, c, r1) ? '#7dff5a' : '#ff4d6d');
      V.ringMat.opacity = 0.6 + 0.3 * Math.sin(G.time * 8);
    }
    // the brother's help: little hands holding the windows open around the climber
    let n = 0;
    if (held) {
      for (let r = Math.max(1, p.r - 1); r < Math.min(L.rows, p.r + 4); r++) {
        for (let c = 0; c < L.cols && n < V.hands.length; c++) {
          const [x, y] = V.winPos(r, c);
          const hs = V.hands[n++];
          hs.visible = true;
          hs.position.set(x + (c % 2 ? 0.3 : -0.3), y + A.WIN.H + 0.05 + Math.sin(G.time * 6 + r + c) * 0.04, 0.25);
        }
      }
    }
    for (let i = n; i < V.hands.length; i++) V.hands[i].visible = false;
    // the residents, the soft things and their warning shadows
    const py = S.y(Tw);
    for (const d of Tw.drops) {
      const wy = d.row * FH + A.WIN.Y;
      const outFor = d.warnT - (d.st === 'warn' ? d.t : 0);
      if (d.st === 'warn' || d.y > wy - 1.2) {
        const R = residents.get();
        R.userData.setWho(d.who);
        const pop = Math.min(1, outFor * 5);
        R.position.set(ox + d.x, wy + 0.05, 0.02);
        R.scale.setScalar(Math.max(0.01, pop));
        R.userData.bang.visible = d.st === 'warn' && Math.floor(G.time * 6) % 2 === 0;
        R.userData.arms.visible = d.st === 'warn';
      }
      const M = itemPools[d.kind].get();
      if (d.st === 'warn') {
        M.position.set(ox + d.x, wy + 1.05 + Math.sin(G.time * 9) * 0.05, 0.45);
        M.rotation.set(0, 0, Math.sin(G.time * 5) * 0.2);
      } else {
        M.position.set(ox + d.x, d.y, 0.6);
        M.rotation.set(d.spin * 0.6, 0, d.spin);
      }
      if (!d.hit && d.y > py && !Tw.done) {
        const sh = shadows.get();
        const grow = d.st === 'warn' ? 0.55 + 0.45 * (outFor / d.warnT) : 1 + Math.min(0.4, (d.y - py) < 2 ? 0.4 : 0);
        sh.position.set(ox + d.x, py + 1.0, 0.08);
        sh.scale.set(grow, grow * 0.6, 1);
        sh.material.opacity = 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(G.time * 10));
      }
    }
  }

  function climber(slot, dt, k) {
    const w = G.w, Tw = w.towers[slot], p = Tw.p, pl = w.players[slot];
    const P = people[pl.who];
    const ox = towerX(slot), top = Tw.L.rows * FH;
    const st = starsFx[slot];
    st.visible = false;
    balls[slot].visible = false;
    peaces[slot].visible = false;
    P.root.visible = true;
    P.root.scale.setScalar(SCALE);
    P.root.rotation.z = 0;
    P.rig.position.y = 0;
    let x = ox + p.x, y = S.y(Tw), z = 0.5, mode = 'stand', ph = G.time * 8, want = PI - 0.35 * (p.face || 1);
    const walking = p.walkT !== G.lastWalk[slot];
    G.lastWalk[slot] = p.walkT;
    if (p.mode === 'top') {
      const h = heliPos(slot), roofY = top + 0.42;
      if (w.phase === 'heli') {
        // he jumps up onto the rope ladder and hangs on, legs swinging
        const u = Math.min(1, w.phaseT / 0.6), e = 1 - (1 - u) * (1 - u);
        x = x + (h.x + 0.15 - x) * e;
        y = roofY + (h.y - 4.2 - roofY) * e;
        z = 0.15 + 0.05 * e;
        want = PI;
        Kit.people.pose(P, ph, 'jump', k);
        P.armL.rotation.set(2.95, 0, 0.15);
        P.armR.rotation.set(2.95, 0, -0.15);
        P.legL.rotation.x = Math.sin(G.time * 5) * 0.5;
        P.legR.rotation.x = -Math.sin(G.time * 5) * 0.5;
      } else {
        // on the roof: his signature move while he waits for the helicopter
        y = roofY; z = 0.15; want = PI;
        mode = signature(pl.who, w.bi);
        Kit.people.pose(P, ph, mode, k);
        props(slot, P, mode);
      }
      P.root.position.set(x, y, z);
      P.root.rotation.y = turn(P.root.rotation.y, want, Math.min(1, k * 1.4));
      return;
    }
    if (p.prog > 0 || p.sliding) {
      // on the wall: back to us, left hand then right hand
      want = 0;
      const right = p.prog >= 0.5;
      const reach = Math.sin((p.prog % 0.5) * 2 * PI) * 0.25;
      Kit.people.pose(P, 0, 'stand', 1);
      if (p.sliding) {
        P.armL.rotation.set(3.0, 0, 0.25);
        P.armR.rotation.set(3.0, 0, -0.25);
        P.legL.rotation.x = 0.3;
        P.legR.rotation.x = -0.1;
        x += Math.sin(G.time * 30) * 0.02;
      } else {
        P.armL.rotation.set(right ? 2.4 : 2.95 + reach, 0, 0.1);
        P.armR.rotation.set(right ? 2.95 + reach : 2.4, 0, -0.1);
        P.legL.rotation.x = right ? 0.2 : 0.9;
        P.legR.rotation.x = right ? 0.9 : 0.2;
      }
      z = 0.42;
    } else if (p.dizzy > 0) {
      want = PI;
      Kit.people.pose(P, ph, 'stand', k);
      P.root.rotation.z = Math.sin(G.time * 9) * 0.12;
    } else if (walking && w.phase === 'play') {
      mode = 'run';
      ph = p.walkT * 11;
      want = p.face > 0 ? FACE_R : FACE_L;
      Kit.people.pose(P, ph, mode, k);
    } else if (p.knockT > 0) {
      // ↑ at a shut window: he turns to it and knocks, knock knock
      want = 0;
      Kit.people.pose(P, 0, 'stand', k);
      P.armR.rotation.set(2.2 + Math.abs(Math.sin(p.knockT * 18)) * 0.5, 0, 0);
    } else {
      Kit.people.pose(P, ph, w.phase === 'ready' ? 'wave' : 'stand', k);
    }
    if (p.dizzy > 0) {
      st.visible = true;
      P.head.getWorldPosition(v3);
      st.position.set(v3.x, v3.y + 0.3, v3.z);
      st.userData.spin(G.time);
    }
    P.root.position.set(x, y, z);
    P.root.rotation.y = turn(P.root.rotation.y, want, Math.min(1, k * 1.4));
    P.root.visible = !(p.inv > 0 && p.dizzy <= 0 && Math.floor(G.time * 10) % 2 === 0);
  }
  function props(slot, P, mode) {
    if (mode === 'jumpshot') {
      P.root.position.y += Math.abs(Math.sin(G.time * 4)) * 0.3;
      balls[slot].visible = true;
      P.root.updateMatrixWorld(true);
      Kit.people.handWorld(P, 1, v3);
      balls[slot].position.set(v3.x, v3.y + 0.25 + Math.max(0, Math.sin(G.time * 4)) * 0.7, v3.z + 0.2);
    } else if (mode === 'peace') {
      peaces[slot].visible = true;
      P.root.updateMatrixWorld(true);
      P.head.getWorldPosition(v3);
      peaces[slot].position.set(v3.x + 0.4, v3.y + 0.25 + Math.sin(G.time * 5) * 0.06, v3.z + 0.3);
    }
  }
  function heli(slot, dt, k) {
    const w = G.w, H = helis[slot], h = heliPos(slot);
    H.visible = true;
    H.position.set(h.x, h.y, h.z);
    H.rotation.set(0, 0, w.phase === 'heli' && w.phaseT > 0.7 ? 0.12 : Math.sin(G.time * 1.3) * 0.04);
    H.userData.rotor.rotation.y += dt * 22;
    H.userData.trot.rotation.z += dt * 30;
    // the pilot: Froggy (and Foxy flies the second one)
    const pilot = people[slot ? 'foxy' : 'froggy'];
    pilot.root.visible = true;
    pilot.root.scale.setScalar(0.24);
    pilot.root.position.set(h.x + 0.41, h.y - 0.34, h.z + 0.22);
    pilot.root.rotation.y = PI - 0.5;
    Kit.people.pose(pilot, G.time * 6, w.towers[slot].done ? 'wave' : 'stand', k);
    pilot.rig.position.y = 0;
  }
  function winPose(sc, dt, k) {
    // the winner (or both, on a tie) does his signature move: on the last roof, or on the street
    const w = G.w, ids = sc.who;
    ids.forEach((id, i) => {
      const slot = Math.max(0, w.players.findIndex((p) => p.who === id));
      const Tw = w.towers[slot];
      const P = people[id];
      P.root.visible = true;
      P.root.scale.setScalar(SCALE);
      P.root.rotation.z = 0;
      const y = sc.roof ? Tw.L.rows * FH + 0.42 : 0;
      P.root.position.set(towerX(slot) + (ids.length === 2 && !w.two ? (i ? 0.8 : -0.8) : 0), y, sc.roof ? 0.15 : 1.4);
      P.root.rotation.y = PI;
      const mode = signature(id, id === 'teddy' ? Math.floor(sc.t / 3) : 0);
      Kit.people.pose(P, G.time * 8, mode, k);
      P.rig.position.y = 0;
      props(i, P, mode);
    });
    w.towers.forEach((Tw, slot) => {
      const H = helis[slot];
      H.visible = sc.roof;
      if (sc.roof) { H.position.set(towerX(slot) - 3, Tw.L.rows * FH + 3.8 + Math.sin(G.time * 2) * 0.2, -1); H.userData.rotor.rotation.y += dt * 22; }
    });
  }

  function buddy(dt, k) {
    const w = G.w, bd = w.buddy;
    buddyCloud.visible = false;
    treat.visible = false;
    if (!bd || (G.scene2 && G.scene2.kind === 'win')) return;
    const Tw = w.towers[0], p = Tw.p;
    const B = people[bd.who];
    const r = Kit.roster.get(bd.who) || {};
    const s = SCALE * (r.buddyScale || 0.8) * Math.min(1, bd.t * 5);
    B.root.visible = true;
    B.root.scale.setScalar(Math.max(0.01, s));
    B.root.rotation.z = 0;
    const side = -(p.face || 1);
    const bx = Math.max(-4.6, Math.min(4.6, p.x + side * 1.0));
    const by = S.y(Tw) + 0.6 + Math.sin(G.time * 3) * 0.08;
    B.root.position.set(bx, by, 0.9);
    B.root.rotation.y = PI;
    buddyCloud.visible = true;
    buddyCloud.position.set(bx, by - 0.05, 0.9);
    let mode;
    if (bd.t < 0.55) mode = signature(bd.who, bd.n);
    else if (bd.t < S.BUDDY_INTRO) mode = 'give';
    else mode = 'grab'; // both hands out: holding the windows open
    Kit.people.pose(B, G.time * 8, mode, k);
    B.rig.position.y = 0;
    if (bd.t < 0.55) props(1, B, mode);
    if (bd.t >= 0.55 && bd.t < 0.9) {
      const u = (bd.t - 0.55) / 0.35;
      treat.visible = true;
      if (treat.userData.e !== bd.treat) { treat.material.map = Kit.gfx.emojiTexture(bd.treat); treat.userData.e = bd.treat; }
      const py = S.y(Tw);
      treat.position.set(bx + (p.x - bx) * u, by + 1 + Math.sin(u * PI) * 0.8 + (py + 0.9 - by - 1) * u, 1.0);
    }
  }

  function spectators(dt, k) {
    // Foxy cheers on the street in 1 player (in 2 players he flies the second helicopter)
    const w = G.w;
    if (w.two) return;
    const F = people.foxy;
    if (F.root.visible) return; // flying already
    F.root.visible = true;
    F.root.scale.setScalar(SCALE * 0.95);
    F.root.position.set(towerX(0) - 3.3, 0, 1.6);
    F.root.rotation.y = PI + 0.4;
    const cheer = w.phase === 'ready' || w.phase === 'heli' || (G.scene2 && G.scene2.kind === 'win');
    Kit.people.pose(F, G.time * 7, cheer ? 'wave' : 'stand', k);
    F.rig.position.y = cheer ? Math.abs(Math.sin(G.time * 7)) * 0.15 : 0;
  }

  // ---------- HUD ----------
  function hud() {
    const w = G.w;
    if (!w || G.demo) return;
    const top = store.table(w.level)[0].score;
    for (let i = 0; i < 2; i++) {
      const box = $('hudP' + i);
      const pl = w.players[i];
      box.style.display = pl ? '' : 'none';
      if (!pl) continue;
      const Tw = w.towers[i];
      box.classList.toggle('first', w.two && Tw.place === 1);
      setText(box.querySelector('.lbl'), NAME(pl.who));
      setText(box.querySelector('.sc'), fmt(pl.score));
      const lv = box.querySelector('.lives');
      lv.style.display = w.two ? 'none' : '';
      if (!w.two) setText(lv, pl.lives > 6 ? `❤️ ×${pl.lives}` : '❤️'.repeat(Math.max(0, pl.lives)));
      setText(box.querySelector('.fl'), Tw.done ? 'ROOF!' : Tw.p.r ? `FLOOR ${Tw.p.r} OF ${Tw.L.rows}` : 'ON THE STREET');
    }
    setText($('hudHi'), fmt(Math.max(top, ...w.players.map((p) => p.score))));
    setText($('hudStage'), `${WC.levels.names[w.bi]} · ${w.bi + 1}/4`);
    const bonus = $('hudBonus');
    setText(bonus, fmt(w.bonus));
    bonus.classList.toggle('low', w.bonus < 1000);
    const hb = $('holdBar');
    hb.classList.toggle('off', !(w.hold > 0));
    hb.querySelector('i').style.setProperty('--fill', (w.hold / S.HOLD).toFixed(3));
    const on = !!w.buddy;
    $('budBtn').classList.toggle('on', on);
    document.querySelector('.tb.call').classList.toggle('on', on);
  }

  function draw() {
    if (!G.w) return;
    syncViews();
    if (!G.vps.length) fit();
    const H = innerHeight;
    if (G.vps.length === 1) {
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, innerWidth, H);
      renderer.render(scene, cams[0]);
    } else {
      renderer.setScissorTest(true);
      for (const vp of G.vps) {
        renderer.setViewport(vp.x, 0, vp.w, H);
        renderer.setScissor(vp.x, 0, vp.w, H);
        renderer.render(scene, vp.cam);
      }
      renderer.setScissorTest(false);
    }
  }

  // ---------- test hooks ----------
  function state() {
    const w = G.w;
    if (!w) return { screen: G.screen };
    const towers = w.towers.map((Tw, i) => {
      const p = Tw.p;
      const [sx, sy] = toScreen(i, towerX(i) + p.x, S.y(Tw) + 0.6, 0.5);
      return { r: p.r, prog: +p.prog.toFixed(3), x: +p.x.toFixed(3), col: S.nearestCol(Tw.L, p.x), mode: p.mode, sliding: p.sliding, dizzy: +p.dizzy.toFixed(2), done: Tw.done, drops: Tw.drops.length, sx: Math.round(sx), sy: Math.round(sy) };
    });
    return {
      screen: G.screen, paused: G.paused, demo: G.demo, phase: w.phase, bi: w.bi, building: w.towers[0].L.id, level: w.level, two: w.two,
      players: w.players.map((q) => ({ who: q.who, score: q.score, lives: q.lives, wins: q.wins })), towers, p: towers[0],
      hold: +w.hold.toFixed(2), buddy: w.buddy && { who: w.buddy.who, t: +w.buddy.t.toFixed(2) }, bonus: w.bonus,
      muted: Kit.sound.isMuted(), sfx: Object.assign({}, SFX.log), lang: Kit.lang.get(), touch: document.body.classList.contains('touch'),
    };
  }
  window.game = {
    start(o) {
      o = o || {};
      if (o.players) G.players = o.players;
      if (o.who) G.who = o.who;
      if (o.level) G.level = o.level;
      play();
      if (o.building) { S.loadBuilding(G.w, o.building); }
      if (o.go) { G.w.phase = 'play'; G.w.phaseT = 0; }
      G.snap = true;
      return state();
    },
    step(secs, o) {
      const n = Math.max(1, Math.round((secs || DT) / DT));
      for (let i = 0; i < n; i++) advance(DT);
      if (!o || o.draw !== false) draw();
      return state();
    },
    state,
    hold(v) { G.hold = v !== false; return G.hold; },
    call,
    pause, resume, showTitle, showResults,
    check: (only) => WC.check.run(only),
    checkFail: () => WC.check.fail(),
    // put a climber on a ledge (tests): the rules stay the real ones
    put(slot, row, col) {
      const Tw = G.w.towers[slot || 0], p = Tw.p;
      p.r = row; p.prog = 0; p.x = S.colX(Tw.L, col); p.col = col; p.mode = 'ledge'; p.sliding = false; p.slideRows = 0; p.dizzy = 0; p.inv = 0; p.knockT = 0;
      p.best = Math.max(p.best, row);
      G.snap = true;
      return state();
    },
    // a window's state (tests): 'open' or 'shut' and it stays that way
    setWin(slot, row, col, st) {
      const win = G.w.towers[slot || 0].wins[row][col];
      win.st = st; win.amt = st === 'open' ? 1 : 0; win.t = 1e9;
      return win;
    },
    openAll() { G.w.towers.forEach((Tw) => Tw.wins.forEach((row) => row && row.forEach((win) => { if (win) { win.st = 'open'; win.amt = 1; win.t = 1e9; } }))); },
    quiet() { G.w.towers.forEach((Tw) => { Tw.drops = []; Tw.dropT = 1e9; }); return state(); }, // nothing dropping (tests that only look at moving)
    sabotage(s) { G.sab = s || null; return G.sab; },
    toScreen,
    towerX,
    world: () => G.w,
    G,
    info() { draw(); const r = renderer.info.render; let meshes = 0; scene.traverseVisible((o) => { if (o.isMesh || o.isSprite) meshes++; }); return { calls: r.calls, triangles: r.triangles, meshes, pixelRatio: renderer.getPixelRatio() }; },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* TT Window Climber: the 3D things, chunky toy style. The sky and the toy city behind, each toy skyscraper (wall,
   ledges, window frames, cosy rooms, sliding shutters, flower boxes, the shop floor and the roof with its sign), the
   helicopter, the friendly residents, the soft things they drop (pillows, beach balls, rubber ducks), the warning
   shadow, confetti and dizzy stars. js/game.js places and moves them. */
(function () {
  'use strict';
  const T = THREE, G = Kit.gfx;
  const A = (WC.art = {});
  const CW = WC.sim.CW, FH = WC.sim.FH;
  const WIN_W = 1.0, WIN_H = 1.05, WIN_Y = 0.32; // a window's size, and its bottom above its own ledge

  // each building's colours: wall, trim (ledges, pilasters), shutter, sky, far city
  const LOOK = {
    candy: { wall: '#ff8fb8', trim: '#fff1f7', shutter: '#ff4d8d', sky: '#9fdcff', city: ['#c7b8ff', '#9ad4ff', '#ffd0e4'] },
    mint: { wall: '#62d8b4', trim: '#effff9', shutter: '#18a77a', sky: '#aee9ff', city: ['#ffe08a', '#b5f2ff', '#c9ffd9'] },
    sunny: { wall: '#ffc24a', trim: '#fff8e6', shutter: '#ff7a1a', sky: '#ffcf9e', city: ['#ff9eb1', '#ffd38a', '#c6a3ff'] },
    star: { wall: '#9a84ff', trim: '#f2eeff', shutter: '#5a3fd6', sky: '#2c3478', city: ['#4f5bb5', '#6b4fa8', '#3e7ab8'] },
  };
  A.LOOK = LOOK;
  A.WIN = { W: WIN_W, H: WIN_H, Y: WIN_Y };

  const mats = new Map();
  const mat = (color, o) => {
    const k = color + JSON.stringify(o || {});
    if (!mats.has(k)) mats.set(k, G.std(color, o));
    return mats.get(k);
  };
  // many still meshes with one material drawn as one (fewer draw calls for older iPads)
  function merge(meshes, material) {
    const parts = meshes.map((m) => {
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrix);
      return g;
    });
    const cat = (name, n) => {
      const out = new Float32Array(parts.reduce((a, g) => a + g.attributes.position.count * n, 0));
      let o = 0;
      for (const g of parts) { out.set(g.attributes[name].array, o); o += g.attributes.position.count * n; }
      return new T.BufferAttribute(out, n);
    };
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', cat('position', 3));
    geo.setAttribute('normal', cat('normal', 3));
    if (parts.every((g) => g.attributes.uv)) geo.setAttribute('uv', cat('uv', 2));
    parts.forEach((g) => g.dispose());
    return new T.Mesh(geo, material);
  }
  const box = (w, h, d, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d)); m.position.set(x, y, z); return m; };

  // ---------- textures ----------
  // a cosy room seen through a window: wallpaper, a lamp, curtains tied back
  const roomTex = (() => {
    let tex = null;
    return () => {
      if (tex) return tex;
      const [c, g] = G.makeCanvas(128, 128);
      const grd = g.createLinearGradient(0, 0, 0, 128);
      grd.addColorStop(0, '#ffe9b0');
      grd.addColorStop(1, '#f7b96a');
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (let x = 8; x < 128; x += 22) for (let y = 10; y < 100; y += 22) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#d9824a';
      g.fillRect(0, 100, 128, 28); // the floor
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(64, 30); g.lineTo(50, 52); g.lineTo(78, 52); g.closePath(); g.fill(); // a lamp shade
      g.fillStyle = '#fff6c8';
      g.beginPath(); g.arc(64, 60, 14, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff6f91'; // curtains
      g.beginPath(); g.moveTo(0, 0); g.lineTo(30, 0); g.quadraticCurveTo(14, 60, 22, 128); g.lineTo(0, 128); g.fill();
      g.beginPath(); g.moveTo(128, 0); g.lineTo(98, 0); g.quadraticCurveTo(114, 60, 106, 128); g.lineTo(128, 128); g.fill();
      tex = G.toTexture(c);
      return tex;
    };
  })();
  // a roller shutter: chunky stripes, a handle at the bottom
  const shutterTex = (() => {
    let tex = null;
    return () => {
      if (tex) return tex;
      const [c, g] = G.makeCanvas(64, 128);
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 64, 128);
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let y = 0; y < 128; y += 16) g.fillRect(0, y + 11, 64, 5);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      for (let y = 0; y < 128; y += 16) g.fillRect(0, y + 2, 64, 3);
      g.fillStyle = 'rgba(20,18,31,0.55)';
      G.roundRect(g, 22, 112, 20, 9, 4);
      g.fill();
      tex = G.toTexture(c);
      return tex;
    };
  })();
  function stripeTex(a, b, n) {
    const [c, g] = G.makeCanvas(128, 64);
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * 128) / n, 0, 128 / n + 1, 64); }
    return G.toTexture(c);
  }
  function signTex(text, bg, fg) {
    const [c, g] = G.makeCanvas(512, 96);
    g.fillStyle = bg;
    G.roundRect(g, 4, 4, 504, 88, 26);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = '#14121f';
    g.stroke();
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 54;
    g.font = `${size}px ${G.FONT}`;
    while (g.measureText(text).width > 470 && size > 20) { size -= 2; g.font = `${size}px ${G.FONT}`; }
    g.fillText(text, 256, 52);
    return G.toTexture(c);
  }

  // ---------- the sky, the toy city behind, the street ----------
  A.backdrop = function (scene) {
    const g = new T.Group();
    scene.add(g);
    // the far toy city: blocks with window dots, three rows deep
    const cityMats = [];
    const winTex = (() => {
      const [c, x] = G.makeCanvas(64, 64);
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, 64, 64);
      x.fillStyle = 'rgba(255,255,255,0.0)';
      x.fillStyle = 'rgba(20,18,60,0.18)';
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) x.fillRect(8 + i * 32, 8 + j * 32, 16, 18);
      const t = G.toTexture(c);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      return t;
    })();
    const rnd = WC.levels.rng(77);
    const blocks = [[], [], []];
    for (let layer = 0; layer < 3; layer++) {
      const z = -26 - layer * 16;
      for (let x = -70; x < 70;) {
        const w = 4 + rnd() * 6, h = 8 + rnd() * (layer === 2 ? 44 : 30);
        const b = new T.Mesh(new T.BoxGeometry(w, h, 6));
        b.position.set(x + w / 2, h / 2 - 1, z);
        G.boxUV(b.geometry, w, h, 6, 2.2);
        blocks[layer].push(b);
        x += w + 0.6 + rnd() * 2;
      }
    }
    const city = blocks.map((bs, i) => {
      const m = new T.MeshStandardMaterial({ color: '#ffffff', map: winTex, roughness: 0.9 });
      cityMats.push(m);
      const mesh = merge(bs, m);
      g.add(mesh);
      return mesh;
    });
    // the ground and the street in front of the towers
    const ground = new T.Mesh(new T.PlaneGeometry(260, 120), mat('#7fd36a', { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, -40);
    g.add(ground);
    const road = new T.Mesh(new T.BoxGeometry(260, 0.1, 7), mat('#5d6275', { roughness: 0.9 }));
    road.position.set(0, -0.04, 6.5);
    g.add(road);
    const walk = new T.Mesh(new T.BoxGeometry(260, 0.2, 4), mat('#e9e3d8', { roughness: 0.9 }));
    walk.position.set(0, -0.1, 1.6);
    g.add(walk);
    const stripes = [];
    for (let x = -60; x < 60; x += 4) stripes.push(box(2, 0.02, 0.25, x, 0.02, 6.5));
    g.add(merge(stripes, mat('#ffffff')));
    // little round trees along the street
    const tops = [], trunks = [];
    for (let x = -46; x <= 46; x += 7.5) {
      if (Math.abs(x) < 16) continue;
      const tr = box(0.3, 1.2, 0.3, x, 0.6, 0.6);
      trunks.push(tr);
      const s = new T.Mesh(new T.SphereGeometry(1, 12, 10));
      s.position.set(x, 1.8, 0.6);
      tops.push(s);
    }
    g.add(merge(trunks, mat('#a86b3c')));
    g.add(merge(tops, mat('#4cc35a', { roughness: 0.8 })));
    // puffy clouds at all heights (the camera climbs a long way)
    const clouds = [];
    const cm = new T.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 1 });
    for (let i = 0; i < 16; i++) {
      const c = new T.Group();
      for (let k = 0; k < 4; k++) {
        const s = new T.Mesh(new T.SphereGeometry(1 + (k % 2) * 0.4, 10, 8), cm);
        s.position.set((k - 1.5) * 1.3, (k % 2) * 0.4, 0);
        c.add(s);
      }
      c.position.set(-60 + rnd() * 120, 14 + i * 3.4 + rnd() * 3, -64 - rnd() * 8);
      c.scale.setScalar(1.8 + rnd() * 0.8);
      c.userData.v = 0.4 + rnd() * 0.5;
      g.add(c);
      clouds.push(c);
    }
    // the night's stars, for the last building
    const starGeo = new T.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 220; i++) pts.push(-90 + rnd() * 180, 4 + rnd() * 70, -60 - rnd() * 10);
    starGeo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    const night = new T.Points(starGeo, new T.PointsMaterial({ color: '#fff6c0', size: 0.5, sizeAttenuation: true }));
    night.visible = false;
    g.add(night);
    const sun = new T.Mesh(new T.CircleGeometry(4, 32), new T.MeshBasicMaterial({ color: '#fff3a6' }));
    sun.position.set(-34, 40, -70);
    g.add(sun);
    return {
      group: g, clouds,
      setLook(id, scene2) {
        const L = LOOK[id];
        scene2.background = new T.Color(L.sky);
        if (scene2.fog) scene2.fog.color.set(L.sky);
        city.forEach((m, i) => m.material.color.set(L.city[i]));
        night.visible = id === 'star';
        sun.material.color.set(id === 'star' ? '#fdf6d0' : id === 'sunny' ? '#ffb347' : '#fff3a6');
        sun.scale.setScalar(id === 'star' ? 0.6 : 1);
      },
    };
  };

  // ---------- a toy skyscraper ----------
  A.tower = function (L) {
    const look = LOOK[L.id];
    const g = new T.Group();
    const W = L.cols * CW + 0.9, top = L.rows * FH;
    const wallMat = new T.MeshStandardMaterial({ color: look.wall, roughness: 0.75 });
    const wall = new T.Mesh(new T.BoxGeometry(W, top + 0.2, 4), wallMat);
    wall.position.set(0, top / 2 - 0.1, -2);
    g.add(wall);
    // pilasters between the columns and at the corners, ledges along every floor, the roof parapet
    const trim = [];
    for (let c = 0; c <= L.cols; c++) trim.push(box(0.18, top, 0.16, (c - L.cols / 2) * CW, top / 2, 0.06));
    for (let r = 1; r <= L.rows; r++) trim.push(box(W + 0.3, r === L.rows ? 0.5 : 0.16, 0.5, 0, r * FH - (r === L.rows ? -0.17 : 0.08), 0.2));
    g.add(merge(trim, mat(look.trim, { roughness: 0.6 })));
    // windows: frames, rooms behind them, flower boxes under some, a shutter for each (one instanced mesh)
    const frames = [], rooms = [], boxes = [], flowers = [];
    const slots = [];
    for (let r = 1; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        const x = (c - (L.cols - 1) / 2) * CW, y = r * FH + WIN_Y;
        frames.push(box(WIN_W + 0.16, 0.1, 0.14, x, y - 0.03, 0.03), box(WIN_W + 0.16, 0.1, 0.14, x, y + WIN_H + 0.03, 0.03));
        frames.push(box(0.1, WIN_H + 0.16, 0.14, x - WIN_W / 2 - 0.03, y + WIN_H / 2, 0.03), box(0.1, WIN_H + 0.16, 0.14, x + WIN_W / 2 + 0.03, y + WIN_H / 2, 0.03));
        frames.push(box(0.05, WIN_H, 0.03, x, y + WIN_H / 2, 0.03)); // the middle bar
        const room = new T.Mesh(new T.PlaneGeometry(WIN_W, WIN_H));
        room.position.set(x, y + WIN_H / 2, 0.012);
        rooms.push(room);
        if ((r * 7 + c * 3) % 5 === 0) {
          boxes.push(box(WIN_W * 0.8, 0.18, 0.26, x, y - 0.14, 0.2));
          for (let k = 0; k < 3; k++) { const s = new T.Mesh(new T.SphereGeometry(0.09, 8, 6)); s.position.set(x - 0.25 + k * 0.25, y - 0.02, 0.22); flowers.push(s); }
        }
        slots.push({ r, c, x, y });
      }
    }
    g.add(merge(frames, mat('#ffffff', { roughness: 0.5 })));
    g.add(merge(rooms, new T.MeshBasicMaterial({ map: roomTex() })));
    if (boxes.length) { g.add(merge(boxes, mat('#a8693a'))); g.add(merge(flowers, mat(look.id === 'star' ? '#ffe066' : '#ff5fa2'))); }
    const shutGeo = new T.BoxGeometry(WIN_W, 1, 0.06);
    shutGeo.translate(0, -0.5, 0); // hangs down from its top edge, so scaling y slides it shut
    const shutters = new T.InstancedMesh(shutGeo, new T.MeshStandardMaterial({ color: '#ffffff', map: shutterTex(), roughness: 0.6 }), slots.length);
    shutters.instanceMatrix.setUsage(T.DynamicDrawUsage);
    const m4 = new T.Matrix4(), col = new T.Color();
    slots.forEach((s, i) => {
      const kind = L.kinds[s.r][s.c];
      shutters.setColorAt(i, col.set(kind === 'shut' ? '#7a8aa8' : look.shutter));
      m4.makeScale(1, 0.001, 1).setPosition(s.x, s.y + WIN_H, 0.05);
      shutters.setMatrixAt(i, m4);
    });
    shutters.frustumCulled = false;
    g.add(shutters);
    // Zzz on the stay-shut windows: a sleepy resident is in there
    const zzz = [];
    const ztex = G.emojiTexture('💤');
    slots.forEach((s) => {
      if (L.kinds[s.r][s.c] !== 'shut') return;
      const sp = new T.Sprite(new T.SpriteMaterial({ map: ztex, transparent: true }));
      sp.scale.set(0.42, 0.42, 1);
      sp.position.set(s.x + 0.28, s.y + WIN_H - 0.2, 0.2);
      g.add(sp);
      zzz.push({ sp, s });
    });
    // the shop floor: a door, an awning, shop windows
    const shop = [];
    shop.push(box(1.0, 1.35, 0.1, 0, 0.67, 0.04));
    const awnTex = stripeTex('#ffffff', look.shutter, 10);
    const awning = new T.Mesh(new T.BoxGeometry(W - 0.2, 0.12, 0.9), new T.MeshStandardMaterial({ map: awnTex, roughness: 0.7 }));
    awning.position.set(0, 1.5, 0.42);
    awning.rotation.x = 0.28;
    g.add(awning);
    g.add(merge(shop, mat('#7a4a2a')));
    const glass = [];
    for (const sx of [-1, 1]) glass.push(box(1.9, 0.95, 0.06, sx * 2.1, 0.75, 0.03));
    g.add(merge(glass, new T.MeshStandardMaterial({ color: '#bfeaff', emissive: '#7fd0ff', emissiveIntensity: 0.25, roughness: 0.2 })));
    // the roof: a water tower, an antenna, the building's sign
    const roof = [];
    roof.push(box(1.4, 1.1, 1.4, -W / 2 + 1.2, top + 1.0, -1.6));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) roof.push(box(0.1, 0.5, 0.1, -W / 2 + 1.2 + sx * 0.5, top + 0.3, -1.6 + sz * 0.5));
    roof.push(box(0.12, 2.6, 0.12, W / 2 - 1, top + 1.3, -1.8));
    g.add(merge(roof, mat('#8c6a4a')));
    const ball = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), new T.MeshStandardMaterial({ color: '#ff3d3d', emissive: '#ff3d3d', emissiveIntensity: 0.6 }));
    ball.position.set(W / 2 - 1, top + 2.7, -1.8);
    g.add(ball);
    const sign = new T.Mesh(new T.PlaneGeometry(4.6, 0.86), new T.MeshBasicMaterial({ transparent: true }));
    sign.position.set(0, top + 1.2, -0.6);
    const drawSign = () => {
      if (sign.material.map) sign.material.map.dispose();
      sign.material.map = signTex(Kit.lang.t(L.name), '#ffd400', '#14121f');
      sign.material.needsUpdate = true;
    };
    drawSign(); // js/game.js redraws it when the language changes
    const posts = [box(0.12, 0.9, 0.12, -1.8, top + 0.45, -0.65), box(0.12, 0.9, 0.12, 1.8, top + 0.45, -0.65)];
    g.add(merge(posts, mat('#5a5a6a')));
    g.add(sign);
    // the highlight on the window he'd climb into: green when it's open, red when it's not
    const ring = new T.Group();
    const ringMat = new T.MeshBasicMaterial({ color: '#7dff5a', transparent: true, opacity: 0.9 });
    [[WIN_W + 0.36, 0.09, 0, -0.13], [WIN_W + 0.36, 0.09, 0, WIN_H + 0.13], [0.09, WIN_H + 0.34, -WIN_W / 2 - 0.13, WIN_H / 2], [0.09, WIN_H + 0.34, WIN_W / 2 + 0.13, WIN_H / 2]].forEach(([w, h, x, y]) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, 0.05), ringMat);
      m.position.set(x, y, 0.12);
      ring.add(m);
    });
    ring.visible = false;
    g.add(ring);
    // hands holding windows open while the brother helps
    const hands = [];
    const htex = G.emojiTexture('✋');
    for (let i = 0; i < 14; i++) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: htex, transparent: true }));
      sp.scale.set(0.34, 0.34, 1);
      sp.visible = false;
      g.add(sp);
      hands.push(sp);
    }
    return {
      group: g, L, W, top, ring, ringMat, hands, zzz, drawSign,
      // slide each shutter to its window's state (amt 1 = open: the shutter rolled up out of sight)
      setWindows(wins, held) {
        slots.forEach((s, i) => {
          const win = wins[s.r][s.c];
          const amt = win ? win.amt : 1;
          const h = Math.max(0.001, (1 - amt) * WIN_H);
          m4.makeScale(1, h, 1).setPosition(s.x, s.y + WIN_H, 0.05);
          shutters.setMatrixAt(i, m4);
        });
        shutters.instanceMatrix.needsUpdate = true;
        zzz.forEach((z) => (z.sp.visible = !held && wins[z.s.r][z.s.c].amt < 0.5));
      },
      winPos: (r, c) => [(c - (L.cols - 1) / 2) * CW, r * FH + WIN_Y],
    };
  };

  // ---------- the helicopter: a chunky toy with a rope ladder ----------
  A.heli = function (color) {
    const g = new T.Group();
    g.scale.setScalar(0.75);
    const body = new T.Mesh(new T.SphereGeometry(1, 18, 14), mat(color || '#ff3d7f', { roughness: 0.45 }));
    body.scale.set(1.5, 1, 1.05);
    g.add(body);
    const glass = new T.Mesh(new T.SphereGeometry(0.72, 16, 12), new T.MeshStandardMaterial({ color: '#bff3ff', transparent: true, opacity: 0.55, roughness: 0.1 }));
    glass.position.set(0.55, 0.25, 0.25);
    g.add(glass);
    const tail = [];
    tail.push(box(2.6, 0.32, 0.32, -2.4, 0.2, 0));
    tail.push(box(0.3, 1.0, 0.12, -3.6, 0.6, 0));
    g.add(merge(tail, mat(color || '#ff3d7f', { roughness: 0.45 })));
    const skids = [];
    for (const sz of [-1, 1]) {
      skids.push(box(2.6, 0.12, 0.12, 0, -1.2, sz * 0.7));
      skids.push(box(0.1, 0.4, 0.1, -0.6, -1.0, sz * 0.7), box(0.1, 0.4, 0.1, 0.6, -1.0, sz * 0.7));
    }
    g.add(merge(skids, mat('#3a3a4a')));
    const mast = box(0.18, 0.4, 0.18, 0, 1.1, 0);
    mast.material = mat('#3a3a4a');
    g.add(mast);
    const rotor = new T.Group();
    rotor.position.set(0, 1.32, 0);
    for (let i = 0; i < 2; i++) { const b = new T.Mesh(new T.BoxGeometry(5.2, 0.06, 0.3), mat('#ffd400')); b.rotation.y = (i * Math.PI) / 2; rotor.add(b); }
    g.add(rotor);
    const trot = new T.Group();
    trot.position.set(-3.6, 0.7, 0.12);
    for (let i = 0; i < 2; i++) { const b = new T.Mesh(new T.BoxGeometry(0.9, 0.12, 0.04), mat('#ffd400')); b.rotation.z = (i * Math.PI) / 2; trot.add(b); }
    g.add(trot);
    // a rope ladder hanging down for the climber
    const ladder = new T.Group();
    const rope = [];
    for (const sx of [-0.28, 0.28]) rope.push(box(0.05, 3.2, 0.05, sx, -1.6, 0));
    for (let i = 0; i < 8; i++) rope.push(box(0.6, 0.06, 0.08, 0, -0.25 - i * 0.4, 0));
    ladder.add(merge(rope, mat('#f2c27a')));
    ladder.position.set(0.2, -1.1, 0.3);
    g.add(ladder);
    g.userData = { rotor, trot, ladder };
    return g;
  };

  // ---------- the friendly residents: an animal leans out with a "!" ----------
  const RESIDENTS = ['🐰', '🐻', '🐱', '🐶', '🐷'];
  A.RESIDENTS = RESIDENTS;
  A.resident = function () {
    const g = new T.Group();
    const face = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture(RESIDENTS[0]), transparent: true }));
    face.scale.set(0.8, 0.8, 1);
    face.position.set(0, 0.5, 0.25);
    g.add(face);
    const bang = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture('❗'), transparent: true, depthTest: false }));
    bang.scale.set(0.5, 0.5, 1);
    bang.position.set(0.45, 1.05, 0.4);
    bang.renderOrder = 6;
    g.add(bang);
    const arms = new T.Mesh(new T.BoxGeometry(0.9, 0.16, 0.3), mat('#ffffff'));
    arms.position.set(0, 0.16, 0.3);
    g.add(arms);
    g.userData = { face, bang, arms, who: 0 };
    g.userData.setWho = (i) => { if (g.userData.who !== i) { g.userData.who = i; face.material.map = G.emojiTexture(RESIDENTS[i % RESIDENTS.length]); face.material.needsUpdate = true; } };
    return g;
  };

  // ---------- the soft things ----------
  A.item = function (kind) {
    const g = new T.Group();
    if (kind === 'pillow') {
      const m = new T.Mesh(new T.SphereGeometry(0.5, 14, 10), mat('#ffffff', { roughness: 0.9 }));
      m.scale.set(1, 0.42, 0.7);
      g.add(m);
      const pip = new T.Mesh(new T.TorusGeometry(0.43, 0.04, 6, 24), mat('#ff8fc4'));
      pip.rotation.x = Math.PI / 2;
      pip.scale.set(1.15, 0.8, 1);
      g.add(pip);
    } else if (kind === 'ball') {
      const tex = stripeTex('#ff4d4d', '#ffffff', 6);
      const tex2 = stripeTex('#3d8bff', '#ffd400', 6);
      const m = new T.Mesh(new T.SphereGeometry(0.36, 16, 12), new T.MeshStandardMaterial({ map: Math.random() < 0.5 ? tex : tex2, roughness: 0.5 }));
      g.add(m);
    } else {
      const yel = mat('#ffd60a', { roughness: 0.4 });
      const b = new T.Mesh(new T.SphereGeometry(0.3, 14, 10), yel);
      b.scale.set(1.25, 0.9, 1);
      g.add(b);
      const h = new T.Mesh(new T.SphereGeometry(0.2, 12, 10), yel);
      h.position.set(0.22, 0.28, 0);
      g.add(h);
      const beak = new T.Mesh(new T.BoxGeometry(0.16, 0.06, 0.12), mat('#ff8a1f'));
      beak.position.set(0.44, 0.25, 0);
      g.add(beak);
      for (const sz of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.035, 6, 6), mat('#14121f')); e.position.set(0.32, 0.34, sz * 0.12); g.add(e); }
    }
    return g;
  };
  // the warning shadow: a dark spot on the wall where it'll land, getting bigger as it comes
  A.shadow = function () {
    const m = new T.Mesh(new T.CircleGeometry(0.55, 24), new T.MeshBasicMaterial({ color: '#14121f', transparent: true, opacity: 0.35, depthWrite: false }));
    m.scale.set(1, 0.55, 1);
    m.renderOrder = 2;
    return m;
  };

  // ---------- confetti, dizzy stars, emoji sprites ----------
  A.confetti = function (scene, max) {
    max = max || 500;
    const geo = new T.PlaneGeometry(0.16, 0.1);
    const im = new T.InstancedMesh(geo, new T.MeshBasicMaterial({ side: T.DoubleSide }), max);
    im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    im.frustumCulled = false;
    scene.add(im);
    const ps = [];
    const col = new T.Color(), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(1, 1, 1), v = new T.Vector3();
    const COLS = ['#ff3d7f', '#ffd400', '#18d4ff', '#7dff5a', '#ff8a1f', '#c77dff', '#ffffff'];
    for (let i = 0; i < max; i++) { im.setColorAt(i, col.set(COLS[i % COLS.length])); m4.makeScale(0, 0, 0); im.setMatrixAt(i, m4); }
    let next = 0;
    return {
      burst(x, y, z, n, power, colors) {
        for (let i = 0; i < n; i++) {
          const k = next++ % max;
          const a = Math.random() * Math.PI * 2, sp = (0.4 + Math.random()) * (power || 4);
          ps[k] = { x, y, z: z || 0.5, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp + 1.5, vz: (Math.random() - 0.3) * 2, rx: Math.random() * 6, ry: Math.random() * 6, life: 1.6 + Math.random() * 1.2 };
          im.setColorAt(k, col.set(colors ? colors[i % colors.length] : COLS[k % COLS.length]));
        }
        im.instanceColor.needsUpdate = true;
      },
      rain(x0, x1, y, n) {
        for (let i = 0; i < n; i++) {
          const k = next++ % max;
          ps[k] = { x: x0 + Math.random() * (x1 - x0), y: y + Math.random() * 3, z: 0.6 + Math.random(), vx: (Math.random() - 0.5) * 1.5, vy: -1 - Math.random(), vz: 0, rx: Math.random() * 6, ry: Math.random() * 6, life: 4 + Math.random() * 2 };
          im.setColorAt(k, col.set(COLS[k % COLS.length]));
        }
        im.instanceColor.needsUpdate = true;
      },
      update(dt) {
        for (let k = 0; k < max; k++) {
          const p = ps[k];
          if (!p) continue;
          p.life -= dt;
          if (p.life <= 0) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); continue; }
          p.vy -= 6 * dt;
          p.vx *= 1 - 1.2 * dt;
          p.vy = Math.max(p.vy, -2.2);
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.rx += dt * 7; p.ry += dt * 5;
          q.setFromEuler(e.set(p.rx, p.ry, 0));
          s.setScalar(Math.min(1, p.life * 2));
          m4.compose(v.set(p.x, p.y, p.z), q, s);
          im.setMatrixAt(k, m4);
        }
        im.instanceMatrix.needsUpdate = true;
      },
      clear() { for (let k = 0; k < max; k++) if (ps[k]) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); } im.instanceMatrix.needsUpdate = true; },
    };
  };
  A.stars = function () {
    const g = new T.Group();
    const tex = G.emojiTexture('⭐');
    for (let i = 0; i < 5; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false }));
      s.scale.set(0.3, 0.3, 1);
      g.add(s);
    }
    g.userData.spin = (t) => g.children.forEach((s, i) => { const a = t * 5 + (i / 5) * Math.PI * 2; s.position.set(Math.cos(a) * 0.42, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.42); });
    return g;
  };
  A.emoji = function (e, size) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture(e), depthTest: false }));
    s.scale.set(size || 0.6, size || 0.6, 1);
    s.renderOrder = 5;
    return s;
  };
  A.cloud = function () {
    const c = new T.Group();
    for (let k = 0; k < 4; k++) {
      const m = new T.Mesh(new T.SphereGeometry(0.22 + (k % 2) * 0.06, 10, 8), new T.MeshStandardMaterial({ color: '#ffffff', emissive: '#dff4ff', emissiveIntensity: 0.4 }));
      m.position.set((k - 1.5) * 0.24, (k % 2) * 0.06, 0);
      c.add(m);
    }
    return c;
  };
})();

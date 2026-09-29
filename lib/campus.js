import * as THREE from "three";
import { createFSKTM, FSKTM } from "./models/fsktm.js";
import { CAMPUS_LANDMARKS, MAP_BOUNDS, mapToWorld } from "./campus-layout.js";
import { buildMappedCampus } from "./mapped-campus.js";
import { rectangleBoundary, containsPoint } from "./navigation.js";

export function initCampus() {
  const events = new AbortController();
  const listen = (target, name, handler, options = {}) =>
    target.addEventListener(name, handler, {
      ...options,
      signal: events.signal,
    });
  let disposed = false,
    animationId,
    panoTimeout,
    cleanupWebMCP = () => {};

  const $ = (id) => document.getElementById(id);
  const officialTour =
    "https://io.uthm.edu.my/more-info/uthm-virtual-tour?catid=17&id=112&view=article";
  const places = [
    {
      id: "library",
      name: "Perpustakaan Tunku Tun Aminah",
      short: "Tunku Tun Aminah Library",
      type: "LIBRARY & LEARNING",
      sub: "The heart of campus",
      x: -40,
      z: -20,
      h: 24,
      entry: [-40, 20],
      pano: "3474030af3b544208419413f707e6896",
      description:
        "Explore the distinctive curved library and its central courtyard. PTTA has served the Parit Raja campus from this building since 2010.",
      source: "https://ptta.uthm.edu.my/about-us/corporate-info/history.html",
    },
    {
      id: "fsktm",
      name: "FSKTM",
      short: "FSKTM",
      type: "COMPUTER SCIENCE & INFORMATION TECHNOLOGY",
      sub: "A closer look at the faculty",
      x: FSKTM.x,
      z: FSKTM.z,
      h: 36,
      entry: FSKTM.entry,
      camera: { distance: 132, pitch: 0.42, yaw: -0.56, height: 12 },
      pano: "350dd70abf1a47ccbe278d5ad0787a5d",
      panoView: { heading: -28.73, pitch: -15.7, field: 75 },
      panoLabel: "View aerial · 360°",
      panoDescription:
        "Find the Faculty of Computer Science and Information Technology hotspot on the right of UTHM’s academic loop. This is the official aerial panorama; a dedicated ground-level FSKTM panorama is not included in the published tour.",
      description:
        "An eight-level central tower, an angled SMC@FSKTM wing and a straight right wing. Walk to the entrance or compare with UTHM’s aerial view.",
      source: "https://fsktm.uthm.edu.my/",
    },
    {
      id: "hall",
      name: "Dewan Sultan Ibrahim",
      short: "Dewan Sultan Ibrahim",
      type: "CEREMONIES & GATHERINGS",
      sub: "Where milestones happen",
      x: -102,
      z: -64,
      h: 20,
      entry: [-102, -32],
      pano: "132a34fa5c9b40f386ad9e367832cfc7",
      description:
        "Visit Sultan Ibrahim Hall, the venue for UTHM’s convocation ceremonies at the main campus.",
      source: "https://convocation.uthm.edu.my/ms/istiadat/lokasi",
    },
    {
      id: "mosque",
      name: "Masjid Sultan Ibrahim",
      short: "Masjid Sultan Ibrahim",
      type: "FAITH & COMMUNITY",
      sub: "A familiar turquoise dome",
      x: -102,
      z: 64,
      h: 31,
      entry: [-102, 97],
      pano: "9d807724cbbd4e15a038c5690bd92efb",
      description:
        "Look around the mosque and its turquoise dome. The mosque was completed in 2011 and named Masjid Sultan Ibrahim in 2015.",
      source:
        "https://pi.uthm.edu.my/tentang-kami/sejarah-penubuhan-pusat-islam-dan-masjid-sultan-ibrahim/profail-masjid-sultan-ibrahim-uthm",
    },
    {
      id: "swimming",
      name: "Pusat Renang UTHM",
      short: "Swimming Centre",
      type: "SPORT & RECREATION",
      sub: "A different kind of blue",
      x: -6,
      z: 96,
      h: 9,
      entry: [-6, 127],
      pano: "a2ecc51703324443bb5b85d61d8f95e4",
      description:
        "Explore the swimming and diving facilities, part of the university’s sports facilities at Parit Raja.",
      source: "https://sukan.uthm.edu.my/index.php/facilities-and-services",
    },
    {
      id: "stadium",
      name: "Stadium UTHM",
      short: "Stadium UTHM",
      type: "SPORT & RECREATION",
      sub: "Room to find your pace",
      x: 44,
      z: 169,
      h: 9,
      entry: [23, 169],
      pano: "890ee00ae6ac4ef185a1d5434e1a1dc2",
      description:
        "Step into the stadium and running track. This is one of the campus sports venues documented by UTHM’s Sports Centre.",
      source: "https://sukan.uthm.edu.my/index.php/facilities-and-services",
    },
    {
      id: "aerial",
      name: "Parit Raja from above",
      short: "Campus from above",
      type: "A DIFFERENT PERSPECTIVE",
      sub: "See the bigger picture",
      x: 49,
      z: -117,
      h: 13,
      entry: [49, -78],
      pano: "05892c87db0e4280b428d72a4bb2f07e",
      description:
        "Take in the real campus from the air. Trace the academic buildings, green spaces and roads in UTHM’s aerial panorama.",
      source: officialTour,
    },
  ];
  const arrivalPixels = {
    hall: [805, 991],
    swimming: [1058, 1300],
    stadium: [1120, 1496],
  };
  for (const p of places) {
    const placement = CAMPUS_LANDMARKS[p.id];
    if (!placement) continue;
    [p.x, p.z] = placement.position;
    p.entry = mapToWorld(arrivalPixels[p.id] || placement.frontPixel);
    p.h *= placement.modelScale;
    p.layout = placement;
    if (p.id === "fsktm")
      p.camera = {
        distance: 64,
        pitch: 0.38,
        yaw: placement.yaw + 0.08,
        height: 6,
      };
  }
  const [boundMinX, boundMinZ] = mapToWorld([MAP_BOUNDS.minX, MAP_BOUNDS.minY]);
  const [boundMaxX, boundMaxZ] = mapToWorld([MAP_BOUNDS.maxX, MAP_BOUNDS.maxY]);
  let selected = null,
    mode = "overview",
    evening = false,
    tourIndex = 0,
    visits = new Set(),
    toastTimer;
  try {
    const saved = JSON.parse(
      localStorage.getItem("jelajah-uthm-visits") || "[]",
    );
    if (Array.isArray(saved))
      visits = new Set(saved.filter((x) => places.some((p) => p.id === x)));
  } catch {}
  const world = $("world");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (error) {
    $("loading").innerHTML =
      '<strong>Your browser could not open 3D.</strong><span>You can still explore the real campus tour.</span><button id="fallback-tour" class="primary-button">Open the 360° campus tour</button>';
    setTimeout(
      () =>
        ($("fallback-tour").onclick = () => {
          $("loading").hidden = true;
          openPanorama(0);
        }),
      0,
    );
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#c6dfeb");
  scene.fog = new THREE.Fog("#c6dfeb", 850, 1800);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 2300);
  const hemi = new THREE.HemisphereLight("#f4fbff", "#8a9672", 2.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff0cf", 2.8);
  sun.position.set(-160, 240, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -290;
  sun.shadow.camera.right = 290;
  sun.shadow.camera.top = 290;
  sun.shadow.camera.bottom = -290;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 700;
  sun.shadow.normalBias = 0.8;
  sun.shadow.bias = -0.0004;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#c2e7ff", 0.65);
  fill.position.set(150, 70, -180);
  scene.add(fill);
  const materials = new Map();
  function mat(color, extra = {}) {
    const key = color + JSON.stringify(extra);
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...extra }),
      );
    return materials.get(key);
  }
  const C = {
    grass: "#99b97d",
    grass2: "#b0c68c",
    cream: "#eeeee2",
    white: "#f9f8ef",
    concrete: "#d4d6ca",
    road: "#7e8b89",
    roof: "#788c87",
    glass: "#55979e",
    teal: "#239ca2",
    dark: "#344f55",
    bark: "#a68b64",
    leaf: "#608b59",
  };
  const collisions = [];
  const waterMeshes = [];
  function mesh(geo, color, parent = scene, extra) {
    const o = new THREE.Mesh(geo, mat(color, extra));
    parent.add(o);
    o.castShadow = true;
    o.receiveShadow = true;
    return o;
  }
  function box(x, y, z, w, h, d, color, parent = scene) {
    const o = mesh(new THREE.BoxGeometry(w, h, d), color, parent);
    o.position.set(x, y, z);
    return o;
  }
  function cyl(x, y, z, rt, rb, h, color, parent = scene, sides = 32) {
    const o = mesh(new THREE.CylinderGeometry(rt, rb, h, sides), color, parent);
    o.position.set(x, y, z);
    return o;
  }
  function sphere(x, y, z, r, color, parent = scene) {
    const o = mesh(new THREE.SphereGeometry(r, 20, 14), color, parent);
    o.position.set(x, y, z);
    return o;
  }
  function ring(x, y, z, inner, outer, color, parent = scene) {
    const o = mesh(new THREE.RingGeometry(inner, outer, 64), color, parent);
    o.rotation.x = -Math.PI / 2;
    o.position.set(x, y, z);
    o.castShadow = false;
    return o;
  }
  function line(points, color, width = 1, parent = scene) {
    const material = new THREE.LineBasicMaterial({ color, linewidth: width });
    const g = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(...p)),
    );
    const o = new THREE.Line(g, material);
    parent.add(o);
    return o;
  }
  function labelText(
    text,
    x,
    y,
    z,
    width,
    height,
    parent = scene,
    bg = "#213f4c",
    fg = "#fffdf0",
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = fg;
    ctx.font = "bold 58px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, 67);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }),
    );
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function collider(x, z, w, d, angle = 0) {
    collisions.push(rectangleBoundary(x, z, w, d, angle));
  }
  function placeModel(id, builder, oldX, oldZ) {
    const placement = CAMPUS_LANDMARKS[id];
    const previous = new Set(scene.children),
      start = collisions.length;
    builder();
    const group = new THREE.Group();
    group.name = id;
    for (const object of [...scene.children]) {
      if (previous.has(object)) continue;
      object.position.x -= oldX;
      object.position.z -= oldZ;
      group.add(object);
    }
    const [x, z] = placement.position,
      s = placement.modelScale,
      a = placement.yaw;
    group.position.set(x, 0, z);
    group.rotation.y = a;
    group.scale.setScalar(s);
    scene.add(group);
    const original = collisions.splice(start);
    for (const c of original) {
      const dx = (c.x - oldX) * s,
        dz = (c.z - oldZ) * s;
      collider(
        x + dx * Math.cos(a) + dz * Math.sin(a),
        z - dx * Math.sin(a) + dz * Math.cos(a),
        (c.hw - 1.05) * 2 * s,
        (c.hd - 1.05) * 2 * s,
        a + c.angle,
      );
    }
  }
  function library() {
    const x = -40,
      z = -20;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    cyl(0, 0.65, 0, 28, 29, 1.3, C.concrete, g, 64);
    cyl(0, 9, 0, 24, 24, 17, C.cream, g, 64);
    cyl(0, 10, 0, 24.12, 24.12, 14, C.glass, g, 64);
    for (let y = 4; y <= 18; y += 4) {
      cyl(0, y, 0, 25, 25, 0.9, C.white, g, 64);
    }
    cyl(0, 18.5, 0, 26, 26, 1.3, "#bdcac3", g, 64);
    cyl(0, 19.5, 0, 27, 27, 0.8, C.white, g, 64);
    cyl(0, 20, 0, 15, 17, 1.2, "#8a9d98", g, 64);
    for (let i = 0; i < 32; i++) {
      let a = (i * Math.PI) / 16;
      const pillar = box(
        Math.sin(a) * 24.3,
        9,
        Math.cos(a) * 24.3,
        0.65,
        17,
        0.65,
        C.white,
        g,
      );
      pillar.rotation.y = a;
    }
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const o = box(
        Math.sin(a) * 26.5,
        20,
        Math.cos(a) * 26.5,
        0.4,
        0.4,
        4,
        C.white,
        g,
      );
      o.rotation.y = a;
    }
    box(0, 3, 25, 14, 6, 4, C.dark, g);
    box(0, 6.5, 28, 17, 1, 7, C.cream, g);
    for (const t of [-7, 7]) box(t, 3, 30, 0.7, 6, 0.7, C.white, g);
    labelText("UTHM", 0, 14, 24.6, 13, 2.4, g);
    collider(x, z, 46, 46);
  }
  function hall() {
    const x = -102,
      z = -64,
      g = new THREE.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    box(0, 1, 0, 49, 2, 37, C.concrete, g);
    box(0, 8, 0, 43, 14, 30, "#e4d8bd", g);
    box(0, 11, -2, 38, 15, 23, "#ede9d8", g);
    const roof = mesh(new THREE.CylinderGeometry(1, 1, 1, 4), C.roof, g);
    roof.scale.set(34, 7, 25);
    roof.position.set(0, 19, -2);
    roof.rotation.y = Math.PI / 4;
    box(0, 7, 17, 49, 1.3, 9, C.white, g);
    for (let i = -20; i <= 20; i += 8) {
      box(i, 3.8, 18, 1, 7, 1, C.cream, g);
      box(i, 10, 15.1, 4, 5, 0.2, C.glass, g);
    }
    for (let i = 0; i < 4; i++)
      box(
        0,
        0.3 + i * 0.3,
        23 - i * 1.4,
        26,
        0.6 + i * 0.6,
        1.4,
        C.concrete,
        g,
      );
    labelText("DEWAN SULTAN IBRAHIM", 0, 7.5, 21.6, 28, 2.4, g);
    collider(x, z, 47, 38);
  }
  function mosque() {
    const x = -102,
      z = 64,
      g = new THREE.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    box(0, 1, 0, 46, 2, 42, C.concrete, g);
    box(0, 7.5, 0, 38, 13, 34, C.white, g);
    const roof = mesh(new THREE.CylinderGeometry(18, 29, 6, 4), C.teal, g);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.92;
    roof.position.set(0, 16, 0);
    cyl(0, 20, 0, 11.5, 12.5, 4, C.white, g);
    const dome = mesh(
      new THREE.SphereGeometry(12, 36, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      C.teal,
      g,
    );
    dome.position.set(0, 21, 0);
    dome.scale.y = 0.78;
    cyl(0, 31, 0, 0.18, 0.28, 4, "#d4b570", g, 10);
    for (let i = -16; i <= 16; i += 8) {
      box(i, 6, 17.08, 4.8, 8, 0.2, "#81a4a0", g);
      const arch = mesh(
        new THREE.CircleGeometry(2.4, 16, 0, Math.PI),
        C.glass,
        g,
      );
      arch.position.set(i, 10, 17.21);
      box(i, 6, -17.08, 4.8, 8, 0.2, C.glass, g);
    }
    for (let i = 0; i < 4; i++)
      box(0, 0.35 + i * 0.35, 24 - i * 1.7, 26, 0.7 + i * 0.7, 1.7, C.cream, g);
    cyl(23, 19, -15, 2, 2.5, 38, C.white, g);
    for (let y of [13, 22, 31]) {
      cyl(23, y, -15, 3.4, 2, 3, C.cream, g);
      cyl(23, y + 1.6, -15, 3.5, 3.5, 0.5, C.white, g);
    }
    cyl(23, 40, -15, 0, 2.3, 8, C.teal, g);
    collider(x, z, 47, 44);
  }
  function swimming() {
    const x = -6,
      z = 96,
      g = new THREE.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    box(0, 0.3, 0, 43, 0.6, 47, "#e7e6d7", g);
    box(-3, 0.65, 0, 22, 0.6, 36, "#d2edee", g);
    const water = box(-3, 0.99, 0, 20, 0.13, 34, "#49afc4", g);
    waterMeshes.push(water);
    for (let i = -10; i <= 4; i += 3)
      box(i, 1.07, 0, 0.16, 0.06, 32, "#faf6c0", g);
    box(15, 1, -7, 8, 1, 15, "#4fa7bc", g);
    for (let i = 0; i < 4; i++) {
      box(-19, 1 + i * 0.65, -2, 4, 0.7, 35, C.concrete, g);
    }
    box(-19, 6.5, -2, 9, 0.6, 38, C.teal, g);
    for (const k of [-16, 12]) box(-19, 3.5, k, 0.8, 6, 0.8, C.white, g);
    box(11, 3, 19, 14, 6, 7, C.cream, g);
    box(11, 6.2, 19, 15, 0.7, 9, C.teal, g);
    collider(x, z, 43, 45);
  }
  function stadium() {
    const x = 44,
      z = 169,
      g = new THREE.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    const oval = (r, w, color, y) => {
      const o = cyl(0, y, 0, r, r, 0.15, color, g, 80);
      o.scale.z = w;
      return o;
    };
    oval(28, 1.5, "#dca188", 0.25);
    oval(20, 1.65, "#7ea567", 0.38);
    for (let r = 21; r < 28; r += 1.35) {
      const o = ring(0, 0.45, 0, r, r + 0.15, "#f2d6c2", g);
      o.scale.y = 1.5;
    }
    box(0, 0.51, 0, 31, 0.04, 58, "#88b26e", g);
    for (let x of [-15, 15]) box(x, 0.56, 0, 0.2, 0.05, 56, "#e9ead0", g);
    for (let z of [-28, 0, 28]) box(0, 0.56, z, 30, 0.05, 0.2, "#e9ead0", g);
    ring(0, 0.56, 0, 6.4, 6.6, "#e9ead0", g);
    for (let z of [-29, 29]) {
      box(-5, 1.6, z, 0.25, 3, 0.25, C.white, g);
      box(5, 1.6, z, 0.25, 3, 0.25, C.white, g);
      box(0, 3, z, 10, 0.25, 0.25, C.white, g);
    }
    for (let i = 0; i < 5; i++)
      box(
        -34 - i * 1.5,
        0.75 + i * 0.7,
        0,
        1.6,
        1.5 + i * 1.4,
        57,
        C.concrete,
        g,
      );
    box(-38, 8.5, 0, 16, 1, 63, C.roof, g);
    for (const z of [-26, 0, 26]) box(-40, 4.2, z, 0.8, 8, 0.8, C.white, g);
    collider(x - 38, z, 15, 63);
  }
  const player = new THREE.Group();
  player.position.set(
    ...[mapToWorld([916, 1570])[0], 0, mapToWorld([916, 1570])[1]],
  );
  player.scale.setScalar(0.58);
  scene.add(player);
  const torso = box(0, 2.5, 0, 1.35, 1.8, 0.7, "#344f62", player);
  sphere(0, 4, 0, 0.6, "#d9b692", player);
  const hair = sphere(0, 4.3, -0.04, 0.56, "#364448", player);
  hair.scale.y = 0.65;
  const legL = box(-0.4, 1, 0, 0.43, 1.5, 0.48, "#eee6c9", player),
    legR = box(0.4, 1, 0, 0.43, 1.5, 0.48, "#eee6c9", player);
  box(-0.4, 0.2, 0.13, 0.52, 0.4, 0.85, "#fff8e5", player);
  box(0.4, 0.2, 0.13, 0.52, 0.4, 0.85, "#fff8e5", player);
  box(0, 2.6, -0.55, 1.1, 1.4, 0.55, "#e6ad4c", player);
  box(-0.95, 2.4, 0, 0.45, 1.7, 0.45, "#d9b692", player);
  box(0.95, 2.4, 0, 0.45, 1.7, 0.45, "#d9b692", player);
  ring(0, 0.15, 0, 2.2, 2.7, "#edba54", player);
  let playerTarget = null;
  const keys = new Set();
  let dragging = false,
    downX = 0,
    downY = 0,
    lastX = 0,
    lastY = 0,
    dragDistance = 0;
  let yaw = 0.6,
    pitch = 0.76,
    distance = 760,
    targetDistance = 760;
  const target = new THREE.Vector3(0, 0, 0),
    targetGoal = target.clone();
  let moving = false;
  function resize() {
    const w = innerWidth,
      h = innerHeight;
    camera.aspect = w / h;
    camera.setViewOffset(w, h, w > 760 ? -w * 0.105 : 0, 0, w, h);
    camera.updateProjectionMatrix();
    renderer?.setSize(w, h);
    renderer?.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  }
  function toast(text) {
    $("place-toast").textContent = text;
    $("place-toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => $("place-toast").classList.remove("visible"),
      2600,
    );
  }
  function saveVisit(p) {
    visits.add(p.id);
    try {
      localStorage.setItem("jelajah-uthm-visits", JSON.stringify([...visits]));
    } catch {}
    renderVisitCount();
  }
  function renderVisitCount() {
    $("visit-count").textContent = `${visits.size} / ${places.length}`;
    document.querySelectorAll(".place-row").forEach((el) => {
      el.querySelector(".place-arrow").textContent = visits.has(
        el.dataset.place,
      )
        ? "✓"
        : "↗";
    });
  }
  function selectPlace(id, focus = true) {
    const p = places.find((p) => p.id === id);
    if (!p) throw Error("Unknown campus landmark");
    selected = p;
    document.body.classList.toggle("inspecting-building", p.id === "fsktm");
    $("place-card").hidden = false;
    $("place-category").textContent = p.type;
    $("place-name").textContent = p.name;
    $("place-description").textContent = p.description;
    $("place-source").href = p.source;
    $("view-360").textContent = `${p.panoLabel || "Step inside · 360°"} ↗`;
    document
      .querySelectorAll("[data-place]")
      .forEach((el) =>
        el.classList.toggle("selected", el.dataset.place === id),
      );
    if (focus && mode === "overview") {
      targetGoal.set(p.x, p.camera?.height || 0, p.z);
      targetDistance = p.camera?.distance || 230;
      pitch = p.camera?.pitch || 0.68;
      if (p.camera) yaw = p.camera.yaw;
    }
    if (innerWidth <= 760 || p.id === "fsktm") collapsePlaces(true);
    return p;
  }
  function closeCard() {
    selected = null;
    document.body.classList.remove("inspecting-building");
    $("place-card").hidden = true;
    document
      .querySelectorAll("[data-place]")
      .forEach((el) => el.classList.remove("selected"));
  }
  function collapsePlaces(collapsed) {
    $("places-panel").classList.toggle("collapsed", collapsed);
    $("collapse-places").textContent = collapsed ? "+" : "−";
    $("collapse-places").setAttribute(
      "aria-label",
      collapsed ? "Expand places" : "Collapse places",
    );
  }
  function setMode(next) {
    if (!["overview", "walk"].includes(next))
      throw Error("Invalid exploration mode");
    mode = next;
    document.body.classList.toggle("walking", mode === "walk");
    $("walk-controls").hidden = mode !== "walk";
    $("overview-mode").classList.toggle("active", mode === "overview");
    $("walk-mode").classList.toggle("active", mode === "walk");
    $("overview-mode").setAttribute(
      "aria-pressed",
      String(mode === "overview"),
    );
    $("walk-mode").setAttribute("aria-pressed", String(mode === "walk"));
    $("controls-hint").innerHTML =
      mode === "walk"
        ? "W A S D / arrows to walk <span>·</span> Shift to run <span>·</span> Drag to turn"
        : "Drag to look around <span>·</span> Scroll to zoom <span>·</span> Select a place";
    playerTarget = null;
    keys.clear();
    if (next === "walk") {
      pitch = 0.45;
      targetDistance = 36;
      closeCard();
      toast("Welcome to campus. Let’s take a walk.");
      collapsePlaces(true);
    } else {
      pitch = 0.76;
      targetDistance = innerWidth <= 760 ? 940 : 760;
      targetGoal.set(0, 0, 2);
    }
    world.focus({ preventScroll: true });
  }
  function home() {
    closeCard();
    setMode("overview");
    yaw = 0.6;
  }
  function openPanorama(index) {
    if (!Number.isInteger(index) || index < 0 || index >= places.length)
      throw Error("Unknown tour stop");
    tourIndex = index;
    const p = places[index];
    saveVisit(p);
    keys.clear();
    playerTarget = null;
    const view = p.panoView || { field: 75, heading: 0, pitch: 0 };
    const url = `https://momento360.com/e/u/${p.pano}?field-of-view=${view.field}&heading=${view.heading}&pitch=${view.pitch}&utm_campaign=embed&utm_source=other`;
    const frame = $("pano-frame");
    $("panorama").hidden = false;
    for (const child of $("app").children)
      if (child.id !== "panorama") child.inert = true;
    $("pano-title").textContent = p.name;
    $("pano-description").textContent = p.panoDescription || p.description;
    $("tour-progress").textContent =
      `CAMPUS TOUR · ${String(index + 1).padStart(2, "0")} / ${String(places.length).padStart(2, "0")}`;
    $("open-pano").href = url;
    $("pano-loading").hidden = false;
    clearTimeout(panoTimeout);
    $("pano-loading").innerHTML =
      "Opening the real campus view…<br><small>You can also choose “Open full view”.</small>";
    frame.onload = () => {
      if (frame.getAttribute("src") === url) {
        clearTimeout(panoTimeout);
        $("pano-loading").hidden = true;
      }
    };
    frame.src = url;
    panoTimeout = setTimeout(() => {
      if (!$("panorama").hidden) {
        $("pano-loading").innerHTML =
          "Taking a little longer than usual.<br><small>Use “Open full view” to visit this 360° scene in its own tab.</small>";
      }
    }, 14000);
    $("prev-stop").disabled = index === 0;
    $("next-stop").textContent =
      index === places.length - 1 ? "Finish tour ✓" : "Next place →";
    $("back-3d").focus({ preventScroll: true });
  }
  function closePanorama() {
    const last = places[tourIndex];
    $("panorama").hidden = true;
    clearTimeout(panoTimeout);
    for (const child of $("app").children) child.inert = false;
    $("pano-frame").src = "about:blank";
    selectPlace(last.id);
    $("view-360").focus({ preventScroll: true });
  }
  function initUI() {
    $("places").replaceChildren();
    $("world-labels").replaceChildren();
    places.forEach((p, i) => {
      const row = document.createElement("button");
      row.className = "place-row";
      row.dataset.place = p.id;
      row.innerHTML = `<span class="place-number">${String(i + 1).padStart(2, "0")}</span><span class="place-text">${p.short}<small>${p.sub}</small></span><span class="place-arrow">↗</span>`;
      row.onclick = () => selectPlace(p.id);
      $("places").appendChild(row);
      const pin = document.createElement("button");
      pin.className = "landmark-label";
      pin.dataset.place = p.id;
      pin.setAttribute("aria-label", `Explore ${p.name}`);
      pin.innerHTML = `<span class="pin-num">${i + 1}</span><span>${p.short}</span>`;
      pin.onclick = () => selectPlace(p.id);
      $("world-labels").appendChild(pin);
      p.pin = pin;
      p.anchor = new THREE.Vector3(p.x, p.h + 5, p.z);
    });
    renderVisitCount();
    if (innerWidth <= 760) collapsePlaces(true);
    $("place-total").textContent = `${places.length} places. At your own pace.`;
    $("home").onclick = home;
    $("reset-view").onclick = home;
    $("overview-mode").onclick = () => setMode("overview");
    $("walk-mode").onclick = () => setMode("walk");
    $("close-card").onclick = closeCard;
    $("collapse-places").onclick = () =>
      collapsePlaces(!$("places-panel").classList.contains("collapsed"));
    $("view-360").onclick = () =>
      selected && openPanorama(places.indexOf(selected));
    $("tour-start").onclick = () => openPanorama(0);
    $("back-3d").onclick = closePanorama;
    $("prev-stop").onclick = () => tourIndex > 0 && openPanorama(tourIndex - 1);
    $("next-stop").onclick = () => {
      if (tourIndex < places.length - 1) openPanorama(tourIndex + 1);
      else {
        closePanorama();
        toast("Tour complete. Keep exploring at your own pace.");
      }
    };
    $("walk-here").onclick = () => {
      if (!selected) return;
      const p = selected;
      player.position.set(p.entry[0], 0, p.entry[1]);
      player.rotation.y = Math.atan2(
        p.x - player.position.x,
        p.z - player.position.z,
      );
      setMode("walk");
      toast(`You’re at ${p.short}.`);
      if (p.camera) yaw = p.camera.yaw;
    };
    $("zoom-in").onclick = () =>
      (targetDistance = Math.max(
        mode === "walk" ? 18 : selected?.id === "fsktm" ? 35 : 70,
        targetDistance * 0.82,
      ));
    $("zoom-out").onclick = () =>
      (targetDistance = Math.min(
        mode === "walk" ? 110 : 1200,
        targetDistance * 1.22,
      ));
    $("rotate-view").onclick = () => (yaw += Math.PI / 4);
    $("plan-view").onclick = () => {
      if (mode === "walk") setMode("overview");
      pitch = 1.34;
      yaw = 0;
      if (selected) {
        targetGoal.set(selected.x, 0, selected.z);
        targetDistance = selected.id === "fsktm" ? 80 : 180;
      }
    };
    $("light-toggle").onclick = () => {
      evening = !evening;
      sun.color.set(evening ? "#ffb673" : "#fff0cf");
      sun.intensity = evening ? 2.2 : 2.8;
      hemi.intensity = evening ? 1.7 : 2.1;
      scene.background.set(evening ? "#adbfce" : "#c6dfeb");
      scene.fog.color.copy(scene.background);
      $("light-toggle").textContent = evening ? "☾" : "☀";
      $("light-toggle").setAttribute(
        "aria-label",
        evening ? "Switch to daylight" : "Switch to evening light",
      );
    };
    $("help").onclick = () => {
      keys.clear();
      $("about-dialog").showModal();
    };
    $("close-about").onclick = () => $("about-dialog").close();
    $("about-dialog").onclick = (e) => {
      if (e.target === $("about-dialog")) {
        const r = e.target.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          e.target.close();
      }
    };
    document.querySelectorAll("[data-dir]").forEach((b) => {
      b.onpointerdown = (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        keys.add(b.dataset.dir);
      };
      b.onpointerup = b.onpointercancel = () => keys.delete(b.dataset.dir);
    });
  }
  function setupInput() {
    listen(world, "pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      downX = lastX = e.clientX;
      downY = lastY = e.clientY;
      dragDistance = 0;
      world.setPointerCapture(e.pointerId);
    });
    listen(world, "pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX,
        dy = e.clientY - lastY;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      yaw -= dx * 0.005;
      pitch = THREE.MathUtils.clamp(pitch + dy * 0.003, 0.18, 1.34);
      lastX = e.clientX;
      lastY = e.clientY;
    });
    listen(world, "pointerup", (e) => {
      dragging = false;
      if (dragDistance < 6 && mode === "walk") {
        const ray = new THREE.Raycaster();
        ray.setFromCamera(
          new THREE.Vector2(
            (e.clientX / innerWidth) * 2 - 1,
            (-e.clientY / innerHeight) * 2 + 1,
          ),
          camera,
        );
        const p = new THREE.Vector3();
        if (
          ray.ray.intersectPlane(
            new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
            p,
          ) &&
          p.x > boundMinX &&
          p.x < boundMaxX &&
          p.z > boundMinZ &&
          p.z < boundMaxZ
        ) {
          playerTarget = p;
          toast("Walking there…");
        }
      }
    });
    listen(world, "pointercancel", () => (dragging = false));
    listen(
      world,
      "wheel",
      (e) => {
        e.preventDefault();
        targetDistance = THREE.MathUtils.clamp(
          targetDistance * (1 + Math.sign(e.deltaY) * 0.075),
          mode === "walk" ? 18 : selected?.id === "fsktm" ? 35 : 70,
          mode === "walk" ? 110 : 1200,
        );
      },
      { passive: false },
    );
    listen(window, "keydown", (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const key = e.key.toLowerCase();
      if (key === "escape") {
        keys.clear();
        if (!$("panorama").hidden) closePanorama();
        else closeCard();
        return;
      }
      if (!$("panorama").hidden || $("about-dialog").open) return;
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)
      )
        e.preventDefault();
      if (key === "v" && !e.repeat)
        setMode(mode === "walk" ? "overview" : "walk");
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          "shift",
        ].includes(key)
      ) {
        keys.add(key);
        playerTarget = null;
      }
    });
    listen(window, "keyup", (e) => keys.delete(e.key.toLowerCase()));
    listen(window, "blur", () => {
      keys.clear();
      dragging = false;
    });
    listen(document, "visibilitychange", () => {
      keys.clear();
    });
    listen(window, "resize", resize);
  }
  function canMove(x, z) {
    return (
      x > boundMinX &&
      x < boundMaxX &&
      z > boundMinZ &&
      z < boundMaxZ &&
      !collisions.some((c) => containsPoint(c, x, z))
    );
  }
  const forward = new THREE.Vector3(),
    right = new THREE.Vector3(),
    delta = new THREE.Vector3();
  let nearby = null;
  function updatePlayer(dt, time) {
    moving = false;
    if (mode !== "walk" || !$("panorama").hidden || $("about-dialog").open)
      return;
    let vx = 0,
      vz = 0;
    if (keys.has("w") || keys.has("arrowup")) vz++;
    if (keys.has("s") || keys.has("arrowdown")) vz--;
    if (keys.has("a") || keys.has("arrowleft")) vx--;
    if (keys.has("d") || keys.has("arrowright")) vx++;
    forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    delta.copy(forward).multiplyScalar(vz).addScaledVector(right, vx);
    if (playerTarget) {
      delta.copy(playerTarget).sub(player.position);
      delta.y = 0;
      if (delta.length() < 1) {
        playerTarget = null;
        delta.set(0, 0, 0);
      }
    }
    if (delta.lengthSq() > 0) {
      delta.normalize().multiplyScalar(dt * (keys.has("shift") ? 26 : 13));
      const nx = player.position.x + delta.x,
        nz = player.position.z + delta.z;
      let progressed = false;
      if (canMove(nx, player.position.z)) {
        player.position.x = nx;
        progressed = true;
      }
      if (canMove(player.position.x, nz)) {
        player.position.z = nz;
        progressed = true;
      }
      if (!progressed && playerTarget) {
        playerTarget = null;
        toast("A building is in the way. Walk around it.");
      }
      moving = progressed;
      player.rotation.y = Math.atan2(delta.x, delta.z);
      torso.position.y = 2.5 + Math.sin(time * 14) * 0.09;
      legL.rotation.x = Math.sin(time * 14) * 0.48;
      legR.rotation.x = -legL.rotation.x;
    } else {
      legL.rotation.x = legR.rotation.x = 0;
    }
    const p = places.find(
      (p) =>
        Math.hypot(
          p.entry[0] - player.position.x,
          p.entry[1] - player.position.z,
        ) < 11,
    );
    if (p && nearby !== p.id) {
      nearby = p.id;
      selectPlace(p.id, false);
    } else if (!p && nearby) {
      nearby = null;
      closeCard();
    }
  }
  const labelPos = new THREE.Vector3();
  let last = performance.now();
  function animate(now) {
    if (disposed) return;
    animationId = requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!renderer || document.hidden) return;
    const t = now / 1000;
    updatePlayer(dt, t);
    if (mode === "walk")
      targetGoal.set(player.position.x, 3, player.position.z);
    const lerp = 1 - Math.exp(-dt * 5);
    target.lerp(targetGoal, lerp);
    distance = THREE.MathUtils.lerp(distance, targetDistance, lerp);
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      target.y + Math.sin(pitch) * distance,
      target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    $("compass-needle").style.transform =
      `rotate(${(-yaw * 180) / Math.PI}deg)`;
    for (const p of places) {
      labelPos.copy(p.anchor).project(camera);
      const x = (labelPos.x * 0.5 + 0.5) * innerWidth,
        y = (-labelPos.y * 0.5 + 0.5) * innerHeight;
      const show =
        labelPos.z < 1 &&
        labelPos.z > -1 &&
        x > 10 &&
        x < innerWidth - 10 &&
        y > 90 &&
        y < innerHeight - 110 &&
        (mode === "overview" || p.anchor.distanceTo(player.position) < 100);
      p.pin.style.display = show ? "flex" : "none";
      p.pin.style.left = x + "px";
      p.pin.style.top = y + "px";
      p.pin.style.opacity = mode === "walk" ? 0.9 : 1;
    }
    if ($("panorama").hidden) renderer.render(scene, camera);
  }
  initUI();
  if (renderer) {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    world.appendChild(renderer.domElement);
    placeModel("library", library, -40, -20);
    placeModel("hall", hall, -102, -64);
    placeModel("mosque", mosque, -102, 64);
    placeModel("swimming", swimming, -6, 96);
    placeModel("stadium", stadium, 44, 169);
    placeModel(
      "fsktm",
      () => {
        const model = createFSKTM({ material: mat });
        model.position.set(0, 0, 0);
        scene.add(model);
        for (const [x, z, w, d, a] of FSKTM.bounds)
          collider(x + 15, z, w, d, a);
      },
      0,
      0,
    );
    buildMappedCampus({ scene, material: mat, collisions });
    for (const p of places) {
      if (!canMove(...p.entry)) throw new Error(`Unsafe tour entry: ${p.id}`);
    }
    setupInput();
    resize();
    if (innerWidth <= 760) distance = targetDistance = 940;
    animationId = requestAnimationFrame(animate);
    setTimeout(() => {
      $("loading").style.opacity = "0";
      setTimeout(() => ($("loading").hidden = true), 420);
    }, 500);
  }

  // The agent interface invokes the same navigation used by the visible controls.
  if (document.modelContext?.registerTool) {
    const lifecycle = new AbortController();
    cleanupWebMCP = () => lifecycle.abort();
    const register = (t) => {
      try {
        Promise.resolve(
          document.modelContext.registerTool(t, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: "read_campus_tour",
      description:
        "Read available UTHM campus stops and the current tour view.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => ({
        view: $("panorama").hidden ? mode : "panorama",
        selected: selected?.id || null,
        visited: [...visits],
        places: places.map(({ id, name }) => ({ id, name })),
      }),
    });
    register({
      name: "navigate_campus_landmark",
      description:
        "Select a campus landmark in 3D or open its real UTHM 360-degree panorama. Changes only the current tour view.",
      inputSchema: {
        type: "object",
        properties: {
          landmark: { type: "string", enum: places.map((p) => p.id) },
          view: { type: "string", enum: ["3d", "panorama"] },
        },
        required: ["landmark", "view"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        if (
          !input ||
          typeof input !== "object" ||
          !places.some((p) => p.id === input.landmark) ||
          !["3d", "panorama"].includes(input.view)
        )
          throw Error("Choose a listed landmark and view.");
        if (input.view === "panorama")
          openPanorama(places.findIndex((p) => p.id === input.landmark));
        else {
          if (!$("panorama").hidden) closePanorama();
          setMode("overview");
          selectPlace(input.landmark);
        }
        return { landmark: input.landmark, view: input.view };
      },
    });
    listen(window, "pagehide", () => lifecycle.abort(), { once: true });
  }

  return () => {
    disposed = true;
    cancelAnimationFrame(animationId);
    events.abort();
    cleanupWebMCP();
    clearTimeout(toastTimer);
    clearTimeout(panoTimeout);
    scene.traverse((object) => {
      object.geometry?.dispose();
    });
    const allMaterials = new Set(materials.values());
    scene.traverse((object) => {
      if (object.material)
        for (const m of [].concat(object.material)) allMaterials.add(m);
    });
    for (const material of allMaterials) {
      material.map?.dispose();
      material.dispose();
    }
    document.body.classList.remove("walking", "inspecting-building");
    renderer?.dispose();
    renderer?.domElement.remove();
    $("world-labels")?.replaceChildren();
    $("places")?.replaceChildren();
  };
}

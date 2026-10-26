import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Visual reconstruction: see README references. Units and hidden elevations
// are interpretive, not surveyed. Local +Z is the signed entrance elevation.
export const FSKTM = {
  x: 71,
  z: -61,
  entry: [56, -32],
  bounds: [
    [-15, 0, 12, 25, 0], // central tower
    [10, 4, 38, 18, 0], // straight right wing
    [-41, 15, 43, 17, (35 * Math.PI) / 180], // angled left wing (directory plans)
  ],
};

export function createFSKTM({ material }) {
  const root = new THREE.Group();
  root.name = "FSKTM — seven-floor tower and three-floor wings";
  root.position.set(FSKTM.x, 0, FSKTM.z);
  // Counts include the ground floor. The owner's correction supersedes the
  // earlier interpretation of the photographed directory numbering.
  const towerFloors = 7, wingFloors = 3;
  const towerRoofY = 30.85, wingRoofY = 13.15;
  const towerCenters = [1.7, ...Array.from({ length: towerFloors - 1 }, (_, i) => 6.3 + i * 3.75)];
  const wingCenters = Array.from({ length: wingFloors }, (_, i) => 2.2 + i * 4.05);
  root.userData.floorCounts = { tower: towerFloors, leftWing: wingFloors, rightWing: wingFloors };
  root.userData.floorCenters = { tower: towerCenters, leftWing: wingCenters, rightWing: [...wingCenters] };
  root.userData.roofHeights = { tower: towerRoofY, wings: wingRoofY };
  const batches = new Map();
  let transform = new THREE.Matrix4();
  const colors = {
    wall: "#e5e7e4",
    trim: "#f2f2e9",
    grey: "#969c9a",
    roof: "#8e999a",
    glass: "#254d4c",
    frame: "#3b4c4b",
    panel: "#304458",
    solarGrid: "#8998a3",
    asphalt: "#7e8786",
    seal: "#263b3c",
    glassLight: "#436a66",
    silver: "#bcc8c3",
  };
  function add(geometry, color) {
    geometry.applyMatrix4(transform);
    if (!batches.has(color)) batches.set(color, []);
    batches.get(color).push(geometry);
  }
  function box(x, y, z, w, h, d, color, rotation = 0) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometry.rotateY(rotation);
    geometry.translate(x, y, z);
    add(geometry, color);
  }
  function softBox(x, y, z, w, h, d, color, rotation = 0, radius = 0.04) {
    const geometry = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 4, h / 4, d / 4));
    geometry.rotateY(rotation);
    geometry.translate(x, y, z);
    add(geometry, color);
  }
  function pipe(x, y, z, radius, height, color) {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 24);
    geometry.translate(x, y, z);
    add(geometry, color);
  }
  function roundedPrism(x, y, z, w, d, h, radius, color) {
    const s = new THREE.Shape();
    const a = -w / 2,
      b = -d / 2,
      r = radius;
    s.moveTo(a + r, b);
    s.lineTo(-a - r, b);
    s.quadraticCurveTo(-a, b, -a, b + r);
    s.lineTo(-a, -b - r);
    s.quadraticCurveTo(-a, -b, -a - r, -b);
    s.lineTo(a + r, -b);
    s.quadraticCurveTo(a, -b, a, -b - r);
    s.lineTo(a, b + r);
    s.quadraticCurveTo(a, b, a + r, b);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: h,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: Math.min(0.055, h / 4),
      bevelThickness: Math.min(0.045, h / 4),
      steps: 1,
      curveSegments: 24,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(x, y, z);
    add(g, color);
  }
  function windowBay(x, y, z, w = 1.45, rotation = 0) {
    // Local front-facing bay, including its projecting sun shade and mullions.
    const c = Math.cos(rotation),
      s = Math.sin(rotation);
    function piece(dx, dy, dz, pw, ph, pd, color) {
      box(
        x + dx * c + dz * s,
        y + dy,
        z - dx * s + dz * c,
        pw,
        ph,
        pd,
        color,
        rotation,
      );
    }
    piece(0, 0, 0, w + 0.28, 2.18, 0.17, colors.trim);
    piece(0, 0, 0.105, w + 0.06, 1.99, 0.08, colors.seal);
    piece(-w / 4 - 0.015, 0, 0.154, w / 2 - 0.06, 1.87, 0.035, colors.glass);
    piece(w / 4 + 0.015, 0, 0.154, w / 2 - 0.06, 1.87, 0.035, colors.glassLight);
    piece(0, 0, 0.19, 0.055, 1.96, 0.08, colors.frame);
    piece(0, 0.43, 0.19, w, 0.055, 0.08, colors.frame);
    piece(0, -1.04, 0.23, w + 0.35, 0.11, 0.47, colors.grey);
    piece(0, -1.12, 0.36, w + 0.27, 0.045, 0.07, colors.trim);
    for (const dx of [-w / 2, w / 2]) piece(dx, 0, 0.18, 0.045, 1.96, 0.07, colors.frame);
    const hood = new RoundedBoxGeometry(w + 0.48, 0.14, 0.88, 2, 0.035);
    hood.rotateY(rotation); hood.translate(x + 0.32 * s, y + 1.19, z + 0.32 * c); add(hood, colors.grey);
    piece(0, 1.10, 0.68, w + 0.4, 0.05, 0.06, colors.trim);
    for (const dx of [-w / 2, w / 2])
      piece(dx, 1.05, 0.17, 0.09, 0.3, 0.57, colors.frame);
  }
  function wing(x, z, w, d, side = false) {
    box(x, wingRoofY / 2, z, w, wingRoofY, d, colors.wall);
    box(x, 1.7, z + d / 2 + 0.03, w - 0.8, 3.1, 0.1, "#d4d2b2");
    for (const face of [-1, 1]) {
      for (let px = -w / 2 + 2; px < w / 2 - 0.7; px += 3.15) {
        const greyBay = Math.round((px + w / 2 - 2) / 3.15) % 4 === 2;
        if (greyBay)
          box(
            x + px,
            wingRoofY / 2,
            z + face * (d / 2 + 0.03),
            2.8,
            wingRoofY - 0.2,
            0.1,
            colors.grey,
          );
        for (let floor = 0; floor < wingFloors; floor++)
          windowBay(
            x + px,
            2.2 + floor * 4.05,
            z + face * (d / 2 + 0.12),
            floor === wingFloors - 1 ? 1.9 : 1.15,
            face === 1 ? 0 : Math.PI,
          );
      }
      for (let floor = 1; floor < wingFloors; floor++)
        box(
          x,
          floor * 4.05 + 0.1,
          z + face * (d / 2 + 0.12),
          w,
          0.24,
          0.21,
          colors.trim,
        );
    }
    if (side)
      for (const face of [-1, 1]) {
        for (let pz = -d / 2 + 2; pz < d / 2 - 1; pz += 3.6)
          for (let floor = 0; floor < wingFloors; floor++)
            windowBay(
              x + face * (w / 2 + 0.12),
              2.2 + floor * 4.05,
              z + pz,
              1.4,
              (face * Math.PI) / 2,
            );
      }
    roundedPrism(x, wingRoofY, z, w + 3, d + 3, 0.8, 1.2, colors.trim);
    roundedPrism(x, wingRoofY + 0.75, z, w + 3.1, d + 3.1, 0.28, 1.2, colors.roof);
    for (let px = x - w / 2; px <= x + w / 2; px += 1.1) {
      for (const side of [-1, 1])
        box(
          px,
          wingRoofY + 0.45,
          z + side * (d / 2 + 1.53),
          0.05,
          0.65,
          0.07,
          colors.grey,
        );
    }
    // Profiled metal fascia, gutters and downpipes give the three-level wings
    // depth at walking distance while preserving their photographed outline.
    for (const face of [-1, 1]) {
      box(x, wingRoofY + 0.88, z + face * (d / 2 + 1.59), w + 1.8, 0.16, 0.14, colors.silver);
      for (const dx of [-w / 2 + 0.45, w / 2 - 0.45]) {
        pipe(x + dx, wingRoofY / 2, z + face * (d / 2 + 0.28), 0.085, wingRoofY, colors.grey);
        for (let y = 1; y < wingRoofY; y += 3.1)
          box(x + dx, y, z + face * (d / 2 + 0.22), 0.25, 0.1, 0.22, colors.silver);
      }
    }
    for (let dx = -w / 2 + 0.5; dx < w / 2; dx += 0.65)
      box(x + dx, wingRoofY + 1.045, z, 0.045, 0.035, d + 1.6, colors.silver);
  }

  // Distinct tall slab, with the rounded entrance end seen in UTHM's photos.
  roundedPrism(-15, 0.3, 0, 12, 25, towerRoofY - 0.3, 2.2, colors.wall);
  box(-15, 16.1, 12.51, 1.3, 19.5, 0.09, colors.grey);
  for (const side of [-1, 1]) {
    box(-15 + side * 6.02, 16.8, -1.4, 0.1, 25.7, 7.2, colors.grey);
    for (const z of [-9.2, -6.2, 3.7, 6.6, 9.2])
      for (let floor = 0; floor < towerFloors - 1; floor++)
        windowBay(
          -15 + side * 6.09,
          6.3 + floor * 3.75,
          z,
          1.45,
          (side * Math.PI) / 2,
        );
    for (let floor = 0; floor < towerFloors - 1; floor++)
      box(
        -15 + side * 6.09,
        6.5 + floor * 3.75,
        -1.6,
        0.16,
        0.48,
        1,
        colors.frame,
      );
  }
  for (let floor = 0; floor < towerFloors - 1; floor++) {
    for (const x of [-17.7, -12.3])
      windowBay(x, 6.3 + floor * 3.75, 12.55, 2.3);
  }
  // Fine panel joints follow the white cladding; they do not add floor bands.
  for (const side of [-1, 1]) {
    for (const z of [-10.6, -7.7, -4.7, 1.8, 5.15, 7.95, 10.6])
      box(-15 + side * 6.035, 17, z, 0.025, 23, 0.025, "#cbd0ca");
    for (let y = 5.05; y < 27; y += 3.75)
      box(-15 + side * 6.04, y, 0, 0.025, 0.025, 20.8, "#cbd0ca");
    for (const z of [-8.4, 7.7])
      windowBay(-15 + side * 6.1, 1.8, z, 1.45, side * Math.PI / 2);
  }
  // Horizontal louvres around the tower base, broken by the glazed entrance.
  roundedPrism(-15, 3, 0, 12.2, 25.2, 2.5, 2.3, colors.grey);
  for (let y = 3.1; y < 5.5; y += 0.19)
    roundedPrism(-15, y, 0, 12.3, 25.3, 0.07, 2.3, colors.trim);
  box(-15, 1.7, 12.64, 5.1, 3.1, 0.15, colors.glass);
  box(-15, 1.7, 12.76, 0.15, 3.1, 0.12, colors.trim);
  for (const x of [-17.48, -12.52]) box(x, 1.7, 12.79, 0.12, 3.2, 0.13, colors.silver);
  box(-15, 3.27, 12.8, 5.15, 0.12, 0.13, colors.silver);
  for (const x of [-15.25, -14.75]) box(x, 1.65, 12.86, 0.045, 0.62, 0.08, colors.silver);
  for (const x of [-18.4, -11.6])
    box(x, 1.7, 14.5, 0.32, 3.4, 0.32, colors.trim);
  roundedPrism(-15, 3.5, 13.5, 8.9, 5.8, 0.25, 1.6, colors.roof);
  for (const x of [-18.3, -15, -11.7]) softBox(x, 3.39, 15, 0.42, 0.04, 0.42, "#e5e1b8");
  for (let i = 0; i < 3; i++)
    box(-15, 0.12 + i * 0.12, 15.4 - i * 0.7, 8.6, 0.24, 2.2, colors.trim);

  // A shallow swept roof: a rounded plan and slightly crowned upper surface.
  roundedPrism(-15, towerRoofY, 0, 15.4, 28.5, 0.72, 3, colors.trim);
  const roof = new THREE.ExtrudeGeometry(
    (() => {
      const s = new THREE.Shape();
      s.moveTo(-7.7, 0);
      s.lineTo(7.7, 0);
      s.lineTo(7.7, 0.28);
      s.quadraticCurveTo(0, 1.5, -7.7, 0.28);
      s.closePath();
      return s;
    })(),
    { depth: 25.4, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.06, bevelThickness: 0.06, curveSegments: 32 },
  );
  roof.translate(-15, towerRoofY + 0.7, -12.7);
  add(roof, colors.roof);
  // Thin raised seams trace the crowned metal roof rather than a flat slab.
  for (let z = -12; z < 12.5; z += 0.68) {
    const points = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      points.push(new THREE.Vector3(-22.7 + 15.4 * t, towerRoofY + 1 + 2.44 * t * (1 - t), z));
    }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.022, 6, false), colors.silver);
  }
  for (const [text, y, w, h] of [
    ["UTHM", towerRoofY - 1.3, 5.3, 1.35],
    ["F S K T M", towerRoofY - 3.3, 8.2, 1.7],
  ]) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.font = "bold 100px Georgia, serif";
    const size = Math.min(100, (470 / ctx.measureText(text).width) * 100);
    ctx.font = `bold ${size}px Georgia, serif`;
    ctx.fillStyle = "#243c57";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 69);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    sign.position.set(-15, y, 12.59);
    root.add(sign);
  }

  wing(10, 4, 38, 18, true);
  // The canted left wing remains in the same place. Three floors total,
  // including ground, follow the owner's corrected building information.
  // Rotate the whole wing (including facade details), not just its roof.
  transform.makeRotationY((35 * Math.PI) / 180);
  transform.setPosition(-41, 0, 15);
  wing(0, 0, 43, 17, true);
  // SMC frontage has a broad louvred bay and recessed corridor bands.
  box(13.5, 7.3, 8.64, 6.5, 10.5, 0.3, colors.wall);
  box(13.5, 6.8, 8.84, 5.4, 8.1, 0.15, colors.grey);
  for (let y = 3; y < 10.9; y += 0.23)
    box(13.5, y, 8.96, 5.45, 0.09, 0.12, colors.trim);
  for (let floor = 0; floor < wingFloors; floor++) {
    box(-4.5, 2.2 + floor * 4.05, 8.72, 26, 1.85, 0.18, colors.glass);
    for (let x = -16.5; x < 8; x += 3.15)
      box(x, 2.2 + floor * 4.05, 8.86, 0.13, 1.85, 0.14, colors.trim);
    box(-4.5, 2.65 + floor * 4.05, 8.88, 26, 0.06, 0.12, colors.frame);
    box(-4.5, 3.7 + floor * 4.05, 9.1, 27.3, 0.45, 1.05, colors.trim);
  }
  for (const x of [-19, -9.5, 0, 9])
    box(x, wingRoofY / 2, 9.18, 0.6, wingRoofY, 0.75, colors.trim);
  const smcCanvas = document.createElement("canvas");
  smcCanvas.width = 1024;
  smcCanvas.height = 128;
  const smcCtx = smcCanvas.getContext("2d");
  smcCtx.font = "bold 94px Arial, sans-serif";
  smcCtx.textAlign = "left";
  smcCtx.textBaseline = "middle";
  let textX = (1024 - smcCtx.measureText("SMC @ FSKTM").width) / 2;
  for (const [part, color] of [
    ["SMC ", "#12569b"],
    ["@", "#bf3347"],
    [" FSKTM", "#12569b"],
  ]) {
    smcCtx.fillStyle = color;
    smcCtx.fillText(part, textX, 66);
    textX += smcCtx.measureText(part).width;
  }
  const smcTexture = new THREE.CanvasTexture(smcCanvas);
  smcTexture.colorSpace = THREE.SRGBColorSpace;
  const smcSign = new THREE.Mesh(
    new THREE.PlaneGeometry(8.6, 1.55),
    new THREE.MeshBasicMaterial({
      map: smcTexture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  smcSign.position.set(13.5, wingRoofY - 1.45, 9.07);
  smcSign.applyMatrix4(transform);
  root.add(smcSign);
  transform.identity();
  // Short link from each wing meets the tower at the entrance hall.
  box(-23.5, 5.78, 5.5, 8, 11.55, 9, colors.wall);
  softBox(-23.5, 11.85, 5.5, 9, 0.55, 10, colors.roof);

  // Panel arrays are visible in the university's page-79 aerial photograph.
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 12; col++) {
      const x = -4.2 + col * 2.7,
        z = -2.5 + row * 4.05;
      box(x, wingRoofY + 1.14, z, 2.4, 0.17, 3.8, colors.silver);
      box(x, wingRoofY + 1.25, z, 2.27, 0.13, 3.67, colors.panel);
      for (let cell = 1; cell < 4; cell++)
        box(
          x,
          wingRoofY + 1.33,
          z - 1.84 + cell * 0.92,
          2.26,
          0.015,
          0.024,
          colors.solarGrid,
        );
      box(x, wingRoofY + 1.33, z, 0.024, 0.015, 3.67, colors.solarGrid);
    }
  }
  for (const z of [-1, 6]) {
    softBox(26.2, wingRoofY + 1.55, z, 2.4, 1.05, 3, colors.grey);
    for (let y = wingRoofY + 1.2; y < wingRoofY + 2; y += 0.14)
      box(27.43, y, z, 0.04, 0.055, 2.6, colors.frame);
    for (const dz of [-0.8, 0.8]) pipe(26.2, wingRoofY + 2.13, z + dz, 0.35, 0.12, colors.frame);
  }

  // Small parking court and blue shelter; layout and car positions illustrative.
  box(1, 0.1, 22, 53, 0.2, 19, colors.asphalt);
  box(9, 0.23, 12.3, 29, 0.23, 2.2, "#cbd0c6");
  box(-15, 0.18, 17.2, 10, 0.24, 4.6, "#d5d7cb");
  for (let x = -19.8; x < -10; x += 0.8)
    for (let z = 15.4; z < 19.4; z += 0.8)
      box(x, 0.31, z, 0.765, 0.018, 0.765, (Math.round(x * 10) + Math.round(z * 10)) % 3 ? "#d5d7cb" : "#c2c8bd");
  box(-15, 0.27, 19.6, 9.7, 0.08, 0.2, colors.frame);
  for (let x = -19.7; x <= -10.3; x += 0.2)
    box(x, 0.318, 19.6, 0.05, 0.025, 0.22, colors.silver);
  for (const x of [-19.6, -10.4]) {
    pipe(x, 0.71, 19.1, 0.105, 1.05, colors.frame);
    pipe(x, 1.15, 19.1, 0.115, 0.1, colors.silver);
  }
  for (let i = 0; i < 10; i++) {
    const x = -21 + i * 4.8;
    box(x, 0.23, 23, 0.13, 0.025, 5.4, "#e5e6d6");
  }
  box(5, 3.6, 18, 15, 0.25, 6.5, "#6293af");
  for (let x = -2; x < 13; x += 7)
    for (const z of [15.2, 20.8]) box(x, 1.8, z, 0.16, 3.6, 0.16, colors.grey);
  for (const [x, z, color] of [
    [0, 18, "#e2e5e3"],
    [5, 18, "#334653"],
    [10, 18, "#d2d4ca"],
    [22, 23, "#bac7c6"],
    [-22, 24, "#626e76"],
  ]) {
    softBox(x, 0.85, z, 2.3, 1.05, 4.2, color, 0, 0.2);
    softBox(x, 1.56, z - 0.1, 1.96, 0.55, 2.1, colors.glass, 0, 0.13);
    box(x, 1.88, z - 0.1, 1.87, 0.08, 1.8, color);
    for (const side of [-1, 1]) {
      box(x + side * 0.72, 0.92, z + 2.12, 0.42, 0.17, 0.035, "#b95550");
      box(x + side * 0.72, 0.92, z - 2.12, 0.42, 0.17, 0.035, "#e0e2cc");
    }
    for (const sx of [-1.18, 1.18])
      for (const sz of [-1.3, 1.3]) {
        const tire = new THREE.CylinderGeometry(0.37, 0.37, 0.2, 24);
        tire.rotateZ(Math.PI / 2); tire.translate(x + sx, 0.53, z + sz); add(tire, "#334044");
        const hub = new THREE.CylinderGeometry(0.22, 0.22, 0.215, 20);
        hub.rotateZ(Math.PI / 2); hub.translate(x + sx, 0.53, z + sz); add(hub, colors.silver);
      }
  }
  for (const x of [-8, 17, 26]) {
    box(x, 0.5, 12, 2.3, 0.7, 2.3, "#c4c8b9");
    const trunk = new THREE.CylinderGeometry(0.17, 0.26, 6.2, 24);
    trunk.translate(x, 3.6, 12);
    add(trunk, "#8f8971");
    for (let i = 0; i < 11; i++) {
      const frond = new THREE.SphereGeometry(1, 20, 10);
      frond.scale(0.47, 0.18, 2.2);
      frond.rotateX(-0.18);
      frond.translate(0, 0, 1.65);
      frond.rotateY((i * Math.PI * 2) / 11);
      frond.translate(x, 6.5, 12);
      add(frond, "#5d7c57");
    }
  }

  // Batch static geometry by material, keeping detailed windows inexpensive.
  for (const [color, geometries] of batches) {
    const expanded = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(expanded);
    if (!merged) throw new Error("Could not assemble FSKTM geometry");
    const glass = [colors.glass, colors.glassLight].includes(color);
    const metal = [colors.frame, colors.silver, colors.panel, colors.solarGrid].includes(color);
    const mesh = new THREE.Mesh(merged, material(color, glass
      ? { roughness: 0.2, metalness: 0.32 }
      : metal ? { roughness: 0.4, metalness: 0.58 } : {}));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    for (const g of expanded) if (!geometries.includes(g)) g.dispose();
    for (const g of geometries) g.dispose();
  }
  // Keep the public model origin at the central tower for map alignment.
  for (const child of root.children) child.position.x += 15;
  root.userData.triangles = root.children.reduce((total, child) => total + (child.geometry?.index?.count ?? child.geometry?.getAttribute("position")?.count ?? 0) / 3, 0);
  return root;
}

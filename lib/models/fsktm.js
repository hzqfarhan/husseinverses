import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

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
  root.name = "FSKTM — reference-led exterior";
  root.position.set(FSKTM.x, 0, FSKTM.z);
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
      bevelEnabled: false,
      curveSegments: 8,
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
    piece(0, 0, 0, w + 0.22, 2.12, 0.16, colors.trim);
    piece(0, 0, 0.1, w, 1.91, 0.08, colors.glass);
    piece(0, 0, 0.16, 0.07, 1.91, 0.08, colors.frame);
    piece(0, 0.43, 0.16, w, 0.06, 0.08, colors.frame);
    piece(0, 1.19, 0.32, w + 0.48, 0.14, 0.88, colors.grey);
    for (const dx of [-w / 2, w / 2])
      piece(dx, 1.05, 0.17, 0.09, 0.3, 0.57, colors.frame);
  }
  function wing(x, z, w, d, side = false) {
    box(x, 8.6, z, w, 17.2, d, colors.wall);
    box(x, 1.7, z + d / 2 + 0.03, w - 0.8, 3.1, 0.1, "#d4d2b2");
    for (const face of [-1, 1]) {
      for (let px = -w / 2 + 2; px < w / 2 - 0.7; px += 3.15) {
        const greyBay = Math.round((px + w / 2 - 2) / 3.15) % 4 === 2;
        if (greyBay)
          box(
            x + px,
            8.6,
            z + face * (d / 2 + 0.03),
            2.8,
            17,
            0.1,
            colors.grey,
          );
        for (let floor = 0; floor < 4; floor++)
          windowBay(
            x + px,
            2.2 + floor * 4.05,
            z + face * (d / 2 + 0.12),
            floor === 3 ? 1.9 : 1.15,
            face === 1 ? 0 : Math.PI,
          );
      }
      for (let floor = 1; floor < 4; floor++)
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
          for (let floor = 0; floor < 4; floor++)
            windowBay(
              x + face * (w / 2 + 0.12),
              2.2 + floor * 4.05,
              z + pz,
              1.4,
              (face * Math.PI) / 2,
            );
      }
    roundedPrism(x, 17.2, z, w + 3, d + 3, 0.8, 1.2, colors.trim);
    roundedPrism(x, 17.95, z, w + 3.1, d + 3.1, 0.28, 1.2, colors.roof);
    for (let px = x - w / 2; px <= x + w / 2; px += 1.1) {
      for (const side of [-1, 1])
        box(
          px,
          17.65,
          z + side * (d / 2 + 1.53),
          0.05,
          0.65,
          0.07,
          colors.grey,
        );
    }
  }

  // Distinct tall slab, with the rounded entrance end seen in UTHM's photos.
  roundedPrism(-15, 0.3, 0, 12, 25, 34.3, 2.2, colors.wall);
  box(-15, 18, 12.51, 1.3, 23, 0.09, colors.grey);
  for (const side of [-1, 1]) {
    box(-15 + side * 6.02, 19, -1.4, 0.1, 29.5, 7.2, colors.grey);
    for (const z of [-9.2, -6.2, 3.7, 6.6, 9.2])
      for (let floor = 0; floor < 7; floor++)
        windowBay(
          -15 + side * 6.09,
          6.3 + floor * 3.75,
          z,
          1.45,
          (side * Math.PI) / 2,
        );
    for (let floor = 0; floor < 7; floor++)
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
  for (let floor = 0; floor < 7; floor++) {
    for (const x of [-17.7, -12.3])
      windowBay(x, 6.3 + floor * 3.75, 12.55, 2.3);
  }
  // Horizontal louvres around the tower base, broken by the glazed entrance.
  roundedPrism(-15, 3, 0, 12.2, 25.2, 2.5, 2.3, colors.grey);
  for (let y = 3.1; y < 5.5; y += 0.19)
    roundedPrism(-15, y, 0, 12.3, 25.3, 0.07, 2.3, colors.trim);
  box(-15, 1.7, 12.64, 5.1, 3.1, 0.15, colors.glass);
  box(-15, 1.7, 12.76, 0.15, 3.1, 0.12, colors.trim);
  for (const x of [-18.4, -11.6])
    box(x, 1.7, 14.5, 0.32, 3.4, 0.32, colors.trim);
  roundedPrism(-15, 3.5, 13.5, 8.9, 5.8, 0.25, 1.6, colors.roof);
  for (let i = 0; i < 3; i++)
    box(-15, 0.12 + i * 0.12, 15.4 - i * 0.7, 8.6, 0.24, 2.2, colors.trim);

  // A shallow swept roof: a rounded plan and slightly crowned upper surface.
  roundedPrism(-15, 34.6, 0, 15.4, 28.5, 0.72, 3, colors.trim);
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
    { depth: 25.4, bevelEnabled: false, curveSegments: 14 },
  );
  roof.translate(-15, 35.3, -12.7);
  add(roof, colors.roof);
  for (const [text, y, w, h] of [
    ["UTHM", 33.3, 5.3, 1.35],
    ["F S K T M", 31.3, 8.2, 1.7],
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
  // The directory's ground-to-third-floor plans show a canted left wing.
  // Rotate the whole wing (including facade details), not just its roof.
  transform.makeRotationY((35 * Math.PI) / 180);
  transform.setPosition(-41, 0, 15);
  wing(0, 0, 43, 17, true);
  // SMC frontage has a broad louvred bay and recessed corridor bands.
  box(13.5, 9.5, 8.64, 6.5, 13.4, 0.3, colors.wall);
  box(13.5, 8.9, 8.84, 5.4, 10.8, 0.15, colors.grey);
  for (let y = 3.7; y < 14.3; y += 0.23)
    box(13.5, y, 8.96, 5.45, 0.09, 0.12, colors.trim);
  for (let floor = 0; floor < 4; floor++) {
    box(-4.5, 2.2 + floor * 4.05, 8.72, 26, 1.85, 0.18, colors.glass);
    for (let x = -16.5; x < 8; x += 3.15)
      box(x, 2.2 + floor * 4.05, 8.86, 0.13, 1.85, 0.14, colors.trim);
    box(-4.5, 3.7 + floor * 4.05, 9.1, 27.3, 0.45, 1.05, colors.trim);
  }
  for (const x of [-19, -9.5, 0, 9])
    box(x, 8.7, 9.18, 0.6, 17.4, 0.75, colors.trim);
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
  smcSign.position.set(13.5, 15.7, 9.07);
  smcSign.applyMatrix4(transform);
  root.add(smcSign);
  transform.identity();
  // Short link from each wing meets the tower at the entrance hall.
  box(-23.5, 7.8, 5.5, 8, 15.6, 9, colors.wall);
  box(-23.5, 15.9, 5.5, 9, 0.55, 10, colors.roof);

  // Panel arrays are visible in the university's page-79 aerial photograph.
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 12; col++) {
      const x = -4.2 + col * 2.7,
        z = -2.5 + row * 4.05;
      box(x, 18.34, z, 2.27, 0.13, 3.67, colors.panel);
      for (let cell = 1; cell < 4; cell++)
        box(
          x,
          18.42,
          z - 1.84 + cell * 0.92,
          2.26,
          0.015,
          0.024,
          colors.solarGrid,
        );
      box(x, 18.42, z, 0.024, 0.015, 3.67, colors.solarGrid);
    }
  }

  // Small parking court and blue shelter; layout and car positions illustrative.
  box(1, 0.1, 22, 53, 0.2, 19, colors.asphalt);
  box(9, 0.23, 12.3, 29, 0.23, 2.2, "#cbd0c6");
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
    box(x, 0.85, z, 2.3, 1.05, 4.2, color);
    box(x, 1.56, z - 0.1, 1.96, 0.55, 2.1, colors.glass);
    for (const sx of [-1.18, 1.18])
      for (const sz of [-1.3, 1.3])
        box(x + sx, 0.53, z + sz, 0.2, 0.7, 0.72, "#334044");
  }
  for (const x of [-8, 17, 26]) {
    box(x, 0.5, 12, 2.3, 0.7, 2.3, "#c4c8b9");
    const trunk = new THREE.CylinderGeometry(0.17, 0.26, 6.2, 7);
    trunk.translate(x, 3.6, 12);
    add(trunk, "#8f8971");
    for (let i = 0; i < 7; i++) {
      const frond = new THREE.SphereGeometry(1, 7, 4);
      frond.scale(0.47, 0.18, 2.2);
      frond.rotateX(-0.18);
      frond.translate(0, 0, 1.65);
      frond.rotateY((i * Math.PI * 2) / 7);
      frond.translate(x, 6.5, 12);
      add(frond, "#5d7c57");
    }
  }

  // Batch static geometry by material, keeping detailed windows inexpensive.
  for (const [color, geometries] of batches) {
    const expanded = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(expanded);
    if (!merged) throw new Error("Could not assemble FSKTM geometry");
    const mesh = new THREE.Mesh(merged, material(color));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    for (const g of expanded) if (!geometries.includes(g)) g.dispose();
    for (const g of geometries) g.dispose();
  }
  // Keep the public model origin at the central tower for map alignment.
  for (const child of root.children) child.position.x += 15;
  return root;
}

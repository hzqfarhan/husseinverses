import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  BUILDING_FOOTPRINTS,
  CAMPUS_ROADS,
  CAMPUS_PONDS,
  MAP_BOUNDS,
  MAP_SCALE,
  mapToWorld,
} from "./campus-layout.js";
import { polygonBoundary } from "./navigation.js";

export function buildMappedCampus({ scene, material, collisions }) {
  const previous = new Set(scene.children);
  function mesh(geometry, color) {
    const o = new THREE.Mesh(geometry, material(color));
    o.castShadow = true;
    o.receiveShadow = true;
    scene.add(o);
    return o;
  }
  function box(x, y, z, w, h, d, color, angle = 0) {
    const o = mesh(new THREE.BoxGeometry(w, h, d), color);
    o.position.set(x, y, z);
    o.rotation.y = angle;
    return o;
  }
  function shape(points, holes = []) {
    const s = new THREE.Shape();
    points.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
    s.closePath();
    for (const ring of holes) {
      const hole = new THREE.Path();
      ring.forEach(([x, z], i) =>
        i ? hole.lineTo(x, -z) : hole.moveTo(x, -z),
      );
      hole.closePath();
      s.holes.push(hole);
    }
    return s;
  }
  function surface(points, color, y, holes = []) {
    const geometry = new THREE.ShapeGeometry(shape(points, holes));
    geometry.rotateX(-Math.PI / 2);
    const o = mesh(geometry, color);
    o.position.y = y;
    o.castShadow = false;
    return o;
  }
  const [minX, minZ] = mapToWorld([MAP_BOUNDS.minX, MAP_BOUNDS.minY]);
  const [maxX, maxZ] = mapToWorld([MAP_BOUNDS.maxX, MAP_BOUNDS.maxY]);
  const cx = (minX + maxX) / 2,
    cz = (minZ + maxZ) / 2;
  box(cx, -4.4, cz, maxX - minX + 28, 8, maxZ - minZ + 28, "#95af79");
  box(cx, -10, cz, 2200, 3, 2200, "#c4dce1");
  const roadSegments = [];
  for (const road of CAMPUS_ROADS) {
    const points = road.pixels.map(mapToWorld),
      width = road.widthPixels * MAP_SCALE;
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1],
        [bx, bz] = points[i];
      const len = Math.hypot(bx - ax, bz - az),
        angle = Math.atan2(bx - ax, bz - az);
      box(
        (ax + bx) / 2,
        -0.13,
        (az + bz) / 2,
        width + 1.4,
        0.24,
        len + 0.6,
        "#cbd0bb",
        angle,
      );
      box(
        (ax + bx) / 2,
        0.02,
        (az + bz) / 2,
        width,
        0.1,
        len + 0.7,
        "#7d8885",
        angle,
      );
      if (width > 4)
        for (let d = 2; d < len - 1; d += 6)
          box(
            ax + ((bx - ax) * d) / len,
            0.08,
            az + ((bz - az) * d) / len,
            0.13,
            0.018,
            2.4,
            "#e4e3ce",
            angle,
          );
      roadSegments.push([ax, az, bx, bz, width]);
    }
  }
  for (const pond of CAMPUS_PONDS) {
    const points = pond.pixels.map(mapToWorld);
    surface(points, "#72b3b8", 0.12);
    collisions.push(polygonBoundary(points, 0.5));
  }
  for (const footprint of BUILDING_FOOTPRINTS) {
    if (footprint.excludeLandmark) continue;
    const points = footprint.pixels.map(mapToWorld),
      height = footprint.height;
    const holes = footprint.holes.map((hole) => hole.map(mapToWorld));
    const geometry = new THREE.ExtrudeGeometry(shape(points, holes), {
      depth: height,
      bevelEnabled: false,
    });
    geometry.rotateX(-Math.PI / 2);
    const building = mesh(geometry, "#e4e6d9");
    building.name = footprint.id;
    surface(points, "#92a09a", height + 0.02, holes);
    collisions.push(polygonBoundary(points, 0.9, holes));
    // Sparse facade detail follows the traced edge directions, never a new grid.
    const area = points.reduce((a, p, i) => {
      const q = points[(i + 1) % points.length];
      return a + p[0] * q[1] - q[0] * p[1];
    }, 0);
    for (let i = 0; i < points.length; i++) {
      const [ax, az] = points[i],
        [bx, bz] = points[(i + 1) % points.length];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 3) continue;
      const angle = -Math.atan2(bz - az, bx - ax),
        sign = area > 0 ? -1 : 1;
      const nx = (-(bz - az) / len) * sign,
        nz = ((bx - ax) / len) * sign;
      for (let y = 2; y < height - 1; y += 3.2) {
        const pane = mesh(
          new THREE.PlaneGeometry(Math.max(0.5, len - 1.2), 0.9),
          "#5b8585",
        );
        pane.material = material("#5b8585", { side: THREE.DoubleSide });
        pane.rotation.y = angle;
        pane.position.set(
          (ax + bx) / 2 + nx * 0.035,
          y,
          (az + bz) / 2 + nz * 0.035,
        );
      }
    }
  }
  // Deterministic planting avoids every traced building, pond and road corridor.
  let seed = 447;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const positions = [];
  for (let i = 0; i < 750; i++) {
    const x = minX + random() * (maxX - minX),
      z = minZ + random() * (maxZ - minZ);
    if (
      collisions.some(
        (c) =>
          x > c.minX - 3 && x < c.maxX + 3 && z > c.minZ - 3 && z < c.maxZ + 3,
      )
    )
      continue;
    if (
      roadSegments.some(([ax, az, bx, bz, w]) => {
        const dx = bx - ax,
          dz = bz - az,
          l = dx * dx + dz * dz;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l));
        return Math.hypot(x - ax - t * dx, z - az - t * dz) < w / 2 + 3;
      })
    )
      continue;
    // The broad western grounds remain open, as in the campus map.
    if (x < -130 && z < -45) continue;
    positions.push([x, z, random()]);
  }
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.35, 4, 6),
    material("#958468"),
    positions.length,
  );
  const leaves = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(2.4, 1),
    material("#658959"),
    positions.length,
  );
  const dummy = new THREE.Object3D();
  positions.forEach(([x, z, s], i) => {
    dummy.position.set(x, 2, z);
    dummy.scale.setScalar(0.7 + s * 0.4);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 4.8;
    dummy.scale.set(0.8 + s * 0.4, 1 + s * 0.3, 0.8 + s * 0.4);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
  });
  trunks.castShadow = leaves.castShadow = true;
  scene.add(trunks, leaves);
  const batches = new Map();
  for (const o of [...scene.children]) {
    if (previous.has(o) || !o.isMesh || o.isInstancedMesh) continue;
    const key = o.material.uuid + o.castShadow;
    if (!batches.has(key))
      batches.set(key, {
        material: o.material,
        shadow: o.castShadow,
        parts: [],
      });
    o.updateMatrix();
    const g = (
      o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    ).applyMatrix4(o.matrix);
    batches.get(key).parts.push(g);
    scene.remove(o);
    o.geometry.dispose();
  }
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.parts);
    const object = new THREE.Mesh(geometry, batch.material);
    object.castShadow = batch.shadow;
    object.receiveShadow = true;
    scene.add(object);
    batch.parts.forEach((g) => g.dispose());
  }
  return { minX, maxX, minZ, maxZ };
}

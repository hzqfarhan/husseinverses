import * as THREE from "three";
import { createBusStop } from "./models/bus-stop.js";
import { transformBoundary } from "./navigation.js";

export const BUS_SHELTER_SCALE = .75;

// Shelter geometry, metal materials and all four sign textures are shared by
// every stop. Only placement and small solid walking boundaries are repeated.
export function buildCampusTransit({ scene, material, collisions, stops = [] }) {
  const root = new THREE.Group(); root.name = "UTHM campus bus shelters";
  const metadata = { stopCount: 0, collisionParts: 0, collisionPartsPerStop: 0, sharedModelMeshes: 0, sharedModelTriangles: 0, busBays: 0 };
  if (!stops.length) { root.userData.transit = metadata; scene.add(root); return { root, metadata }; }
  const template = createBusStop({ material, name: "Hentian Bas UTHM", code: "BAS" });
  metadata.collisionPartsPerStop = template.boundaries.length;
  metadata.sharedModelMeshes = template.root.userData.meshes;
  metadata.sharedModelTriangles = template.root.userData.triangles;
  const markMatrices = [], matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
  const position = new THREE.Vector3(), scale = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  function mark(x, z, width, depth, yaw) {
    rotation.setFromAxisAngle(yAxis, yaw);
    matrix.compose(position.set(x, .09, z), rotation, scale.set(width, .018, depth));
    markMatrices.push(matrix.clone());
  }
  for (const stop of stops) {
    if (!Array.isArray(stop.position) || stop.position.length !== 2 || !stop.position.every(Number.isFinite) || !Number.isFinite(stop.yaw))
      throw new Error(`Invalid bus shelter placement: ${stop.id || stop.name || "unnamed"}`);
    const shelter = template.root.clone(true);
    shelter.name = `Hentian Bas · ${stop.name || stop.id}`;
    shelter.position.set(stop.position[0], 0, stop.position[1]);
    shelter.rotation.y = stop.yaw; shelter.scale.set(BUS_SHELTER_SCALE, 1, BUS_SHELTER_SCALE);
    shelter.userData.stopId = stop.id; shelter.userData.name = stop.name; shelter.userData.code = stop.code || "BAS";
    root.add(shelter);
    const placement = { position: stop.position, yaw: stop.yaw, modelScale: BUS_SHELTER_SCALE };
    collisions.push(...template.boundaries.map(boundary => transformBoundary(boundary, placement)));
    metadata.stopCount++; metadata.collisionParts += template.boundaries.length;

    // KATSANA data keeps the shelter beside the road. The bay sits on that same
    // side of the carriageway; its short bars run parallel to the road tangent.
    if (!Array.isArray(stop.roadPoint) || stop.roadPoint.length !== 2 || !stop.roadPoint.every(Number.isFinite) || !Number.isFinite(stop.roadWidth) || stop.roadWidth <= .5) continue;
    const width = Math.min(2.2, stop.roadWidth * .42), length = 8.5;
    const frontX = Math.sin(stop.yaw), frontZ = Math.cos(stop.yaw);
    const offset = stop.roadWidth / 2 - width / 2 - .15;
    const x = stop.roadPoint[0] - frontX * offset, z = stop.roadPoint[1] - frontZ * offset;
    const c = Math.cos(stop.yaw), s = Math.sin(stop.yaw);
    const at = (dx, dz, w, d) => mark(x + dx * c + dz * s, z - dx * s + dz * c, w, d, stop.yaw);
    for (let d = -length / 2 + .42; d < length / 2; d += 1.25)
      for (const side of [-1, 1]) at(d, side * width / 2, .75, .075);
    for (let d = -width / 2 + .28; d < width / 2; d += .65)
      for (const side of [-1, 1]) at(side * length / 2, d, .075, .4);
    shelter.userData.busBay = { position: [x, z], width, length, yaw: stop.yaw };
    metadata.busBays++;
  }
  if (markMatrices.length) {
    const marks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material("#d5bd6b", { roughness: .98, transparent: true, opacity: .76 }), markMatrices.length);
    marks.name = "Subtle dashed bus bay markings";
    markMatrices.forEach((value, i) => marks.setMatrixAt(i, value));
    marks.receiveShadow = true; root.add(marks);
  }
  root.userData.transit = metadata; scene.add(root); return { root, metadata };
}

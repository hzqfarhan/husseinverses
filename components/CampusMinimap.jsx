"use client";

import { useEffect, useRef } from "react";
import { BUILDING_FOOTPRINTS, CAMPUS_LANDMARKS, CAMPUS_PONDS, CAMPUS_ROADS, MAP_SCALE, mapToWorld } from "../lib/campus-layout.js";
import { CAMPUS_OUTLINE } from "../lib/campus-boundary.js";
import { getLandmarkPlanShapes } from "../lib/site-layout.js";
import { getPondOutline } from "../lib/water-boundaries.js";
import { facultyForFootprint } from "../lib/faculty-data.js";
import { BUS_STOPS } from "../lib/bus-stops.js";

const SIZE = 1536, TAU = Math.PI * 2;
const finitePoint = (point) => point && Number.isFinite(point.x) && Number.isFinite(point.z);
function path(context, points, close = true) {
  context.beginPath(); points.forEach(([x, z], index) => index ? context.lineTo(x, z) : context.moveTo(x, z));
  if (close) context.closePath();
}

// One original diagram, cached once. Every moving frame only crops/rotates this
// image and draws two markers; the campus geometry is not rebuilt per frame.
function createMapCache() {
  const minX = Math.min(...CAMPUS_OUTLINE.map((point) => point[0]));
  const maxX = Math.max(...CAMPUS_OUTLINE.map((point) => point[0]));
  const minZ = Math.min(...CAMPUS_OUTLINE.map((point) => point[1]));
  const maxZ = Math.max(...CAMPUS_OUTLINE.map((point) => point[1]));
  const center = [(minX + maxX) / 2, (minZ + maxZ) / 2];
  const worldSize = Math.max(maxX - minX, maxZ - minZ) + 36;
  const left = center[0] - worldSize / 2, top = center[1] - worldSize / 2;
  const overviewRadius = Math.max(...CAMPUS_OUTLINE.map(([x, z]) => Math.hypot(x - center[0], z - center[1]))) + 18;
  const image = document.createElement("canvas"); image.width = image.height = SIZE;
  const context = image.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#cedcd8"; context.fillRect(0, 0, SIZE, SIZE);
  const pixelsPerWorld = SIZE / worldSize;
  context.scale(pixelsPerWorld, pixelsPerWorld); context.translate(-left, -top);
  path(context, CAMPUS_OUTLINE); context.fillStyle = "#dce4cc"; context.fill();
  context.strokeStyle = "#a3b29a"; context.lineWidth = .8; context.stroke();
  for (const road of CAMPUS_ROADS) {
    path(context, road.pixels.map(mapToWorld), false);
    context.lineCap = "round"; context.lineJoin = "round";
    context.strokeStyle = "#b2b6a5"; context.lineWidth = road.widthPixels * MAP_SCALE + 1.4; context.stroke();
    context.strokeStyle = "#f5f2e5"; context.lineWidth = road.widthPixels * MAP_SCALE; context.stroke();
  }
  for (const pond of CAMPUS_PONDS) {
    path(context, getPondOutline(pond)); context.fillStyle = "#8fbaba"; context.fill();
    context.strokeStyle = "#79a5a4"; context.lineWidth = .6; context.stroke();
  }
  for (const footprint of BUILDING_FOOTPRINTS) {
    if (footprint.excludeLandmark) continue;
    path(context, footprint.pixels.map(mapToWorld));
    for (const hole of footprint.holes) {
      const points = hole.map(mapToWorld); context.moveTo(...points[0]); points.slice(1).forEach((point) => context.lineTo(...point)); context.closePath();
    }
    context.fillStyle = facultyForFootprint(footprint) ? "#718c87" : "#a3afa0";
    context.fill("evenodd"); context.strokeStyle = "#829283"; context.lineWidth = .45; context.stroke();
  }
  for (const shape of getLandmarkPlanShapes()) {
    path(context, shape.points);
    for (const hole of shape.holes) { context.moveTo(...hole[0]); hole.slice(1).forEach((point) => context.lineTo(...point)); context.closePath(); }
    context.fillStyle = shape.kind === "roof" ? "#7c9790" : shape.kind === "sports" ? "#9bb887" : "#cdd5bb";
    context.fill("evenodd"); context.strokeStyle = "#8d9d87"; context.lineWidth = .4; context.stroke();
  }
  for (const stop of BUS_STOPS) {
    context.beginPath(); context.arc(...stop.position, 1.15, 0, TAU); context.fillStyle = "#537e86"; context.fill();
  }
  return { image, left, top, worldSize, center, overviewRadius };
}

export default function CampusMinimap() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current, context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const cache = createMapCache(); if (!cache) return;
    let frame = 0, lastFrame = -Infinity, dirty = true, disposed = false;
    let state = { x: CAMPUS_LANDMARKS.library.position[0], z: CAMPUS_LANDMARKS.library.position[1], heading: 0, yaw: 0, mode: "overview", destination: null };
    const receive = (event) => {
      const next = event.detail;
      if (!finitePoint(next)) return;
      state = {
        x: next.x, z: next.z,
        heading: Number.isFinite(next.heading) ? next.heading : state.heading,
        yaw: Number.isFinite(next.yaw) ? next.yaw : state.yaw,
        mode: next.mode === "walk" ? "walk" : "overview",
        destination: finitePoint(next.destination) ? { x: next.destination.x, z: next.destination.z } : null,
      };
      dirty = true;
    };
    const resize = () => { dirty = true; };
    function draw() {
      const cssSize = Math.max(1, canvas.getBoundingClientRect().width), ratio = Math.min(window.devicePixelRatio || 1, 2);
      const target = Math.round(cssSize * ratio);
      if (canvas.width !== target || canvas.height !== target) canvas.width = canvas.height = target;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, cssSize, cssSize);
      const center = cssSize / 2, radius = center - 2, walking = state.mode === "walk";
      const origin = walking ? [state.x, state.z] : cache.center;
      const rotation = walking ? state.yaw : 0, worldRadius = walking ? 70 : cache.overviewRadius;
      const zoom = radius / worldRadius;
      context.save(); context.beginPath(); context.arc(center, center, radius, 0, TAU); context.clip();
      context.fillStyle = "#cedcd8"; context.fillRect(0, 0, cssSize, cssSize);
      context.translate(center, center); context.rotate(rotation); context.scale(zoom, zoom);
      context.drawImage(cache.image, cache.left - origin[0], cache.top - origin[1], cache.worldSize, cache.worldSize);
      context.restore();

      const screen = (x, z) => {
        const dx = x - origin[0], dz = z - origin[1];
        return [center + (dx * Math.cos(rotation) - dz * Math.sin(rotation)) * zoom,
          center + (dx * Math.sin(rotation) + dz * Math.cos(rotation)) * zoom];
      };
      // Heading is the character's +Z forward direction. The downward-pointing
      // local triangle therefore rotates by -heading, after map rotation.
      const player = screen(state.x, state.z), playerAngle = rotation - state.heading;
      context.save(); context.translate(...player); context.rotate(playerAngle);
      context.shadowColor = "#133c4655"; context.shadowBlur = 4;
      context.beginPath(); context.moveTo(0, 7); context.lineTo(-4.7, -4.5); context.lineTo(0, -2); context.lineTo(4.7, -4.5); context.closePath();
      context.fillStyle = "#fffdf3"; context.strokeStyle = "#294e5a"; context.lineWidth = 1.5; context.fill(); context.stroke(); context.restore();
      if (state.destination) {
        let [x, z] = screen(state.destination.x, state.destination.z);
        const dx = x - center, dz = z - center, distance = Math.hypot(dx, dz), limit = radius - 10;
        const atEdge = distance > limit;
        if (atEdge) { x = center + dx / distance * limit; z = center + dz / distance * limit; }
        context.save(); context.translate(x, z); context.rotate(atEdge ? Math.atan2(dz, dx) + Math.PI / 2 : Math.PI / 4);
        context.fillStyle = "#dba44c"; context.strokeStyle = "#fff9e9"; context.lineWidth = 1.6;
        context.beginPath();
        if (atEdge) { context.moveTo(0, -5); context.lineTo(4, 4); context.lineTo(-4, 4); }
        else context.rect(-3.5, -3.5, 7, 7);
        context.closePath(); context.fill(); context.stroke(); context.restore();
      }
      context.strokeStyle = "#fffdf385"; context.lineWidth = 1;
      context.beginPath(); context.arc(center, center, radius - .5, 0, TAU); context.stroke();
      for (let i = 0; i < 16; i++) {
        const angle = i * TAU / 16, long = i % 4 === 0 ? 4 : 2;
        context.beginPath(); context.moveTo(center + Math.sin(angle) * (radius - 1), center + Math.cos(angle) * (radius - 1));
        context.lineTo(center + Math.sin(angle) * (radius - long), center + Math.cos(angle) * (radius - long)); context.stroke();
      }
    }
    function animate(now) {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      if (!dirty || document.hidden || now - lastFrame < 60 || !canvas.getClientRects().length) return;
      lastFrame = now; dirty = false; draw();
    }
    window.addEventListener("husseinverse:map-position", receive);
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener("husseinverse:map-position", receive); window.removeEventListener("resize", resize);
      cache.image.width = cache.image.height = 0;
    };
  }, []);

  return <button className="campus-radar" aria-label="Open the full campus map. Small map shows your position and destination." title="Open campus map" onClick={() => window.dispatchEvent(new CustomEvent("husseinverse:open-plan"))}>
    <span className="campus-radar-face"><canvas ref={canvasRef} aria-hidden="true"/></span>
    <span className="campus-radar-caption"><i aria-hidden="true"/>MAP<span aria-hidden="true">↗</span></span>
  </button>;
}

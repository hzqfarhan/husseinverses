"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BUILDING_FOOTPRINTS, CAMPUS_LANDMARKS, CAMPUS_PONDS, CAMPUS_ROADS, MAP_BOUNDS, MAP_ORIGIN, MAP_SCALE } from "../lib/campus-layout.js";
import { FACULTIES, facultyForFootprint } from "../lib/faculty-data.js";
import { getLandmarkPlanShapes } from "../lib/site-layout.js";
import { getPondOutline } from "../lib/water-boundaries.js";
import { CAMPUS_OUTLINE_PIXELS } from "../lib/campus-boundary.js";

const STORAGE_KEY = "husseinverse-campus-fixes-v1";
const EMPTY_STOPS = [];
const COLORS = ["#e65353", "#e9ad28", "#2e99b2", "#9364c6"];
const TOOLS = [{ id: "pan", icon: "↔", label: "Move" }, { id: "highlight", icon: "✎", label: "Highlight" }, { id: "rectangle", icon: "▭", label: "Box" }, { id: "circle", icon: "◯", label: "Circle" }, { id: "note", icon: "T", label: "Note" }];
const LANDMARK_NAMES = { library: "PTTA Library", hall: "Dewan Sultan Ibrahim", mosque: "Masjid Sultan Ibrahim", swimming: "Swimming centre", stadium: "Stadium UTHM", fsktm: "FSKTM" };
const worldToPixel = ([x, z]) => [x / MAP_SCALE + MAP_ORIGIN[0], z / MAP_SCALE + MAP_ORIGIN[1]];
const annotationName = (mark, index) => mark.type === "note" ? mark.text : `${mark.type === "rectangle" ? "Box" : mark.type === "circle" ? "Circle" : "Highlight"} ${String(index + 1).padStart(2, "0")}`;
const pointIsValid = (point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite);

function path(ctx, points) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
}

function noteLayout(ctx, text) {
  ctx.font = "600 25px Arial, sans-serif";
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > 450 && line) { lines.push(line); line = word; }
      else line = candidate;
    }
    lines.push(line);
  }
  return { lines, width: Math.min(450, Math.max(90, ...lines.map((line) => ctx.measureText(line).width))) + 24, height: lines.length * 32 + 24 };
}

function drawMap(ctx, view, width, height, busStops, items, draft = null, selected = null, uiScale = 1, trees = []) {
  const { scale, x, y } = view;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#e1edf0"; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  path(ctx,CAMPUS_OUTLINE_PIXELS);ctx.fillStyle="#edf1e4";
  ctx.shadowColor="#456b7130";ctx.shadowBlur=14/scale;ctx.shadowOffsetY=5/scale;ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle="#99b1a0";ctx.lineWidth=1.2/scale;ctx.stroke();
  ctx.save();ctx.clip();
  ctx.strokeStyle = "#e0e6d9"; ctx.lineWidth = .7 / scale;
  for (let gx = 0; gx < 2600; gx += 100) { ctx.beginPath(); ctx.moveTo(gx, 200); ctx.lineTo(gx, 1900); ctx.stroke(); }
  for (let gy = 200; gy < 1900; gy += 100) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(2600, gy); ctx.stroke(); }
  ctx.restore();
  for (const road of CAMPUS_ROADS) {
    ctx.beginPath(); road.pixels.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#d4d8ce"; ctx.lineWidth = road.widthPixels + 7; ctx.stroke();
    ctx.strokeStyle = "#8f9c99"; ctx.lineWidth = road.widthPixels; ctx.stroke();
    if (road.widthPixels > 12) { ctx.strokeStyle = "#e9e9db"; ctx.lineWidth = 1; ctx.setLineDash([7, 9]); ctx.stroke(); ctx.setLineDash([]); }
  }
  for (const pond of CAMPUS_PONDS) { path(ctx, getPondOutline(pond).map(worldToPixel)); ctx.fillStyle = "#a5d1d1"; ctx.fill(); ctx.strokeStyle = "#78b2b7"; ctx.lineWidth = 1.3; ctx.stroke(); }
  for (const footprint of BUILDING_FOOTPRINTS) {
    if (footprint.excludeLandmark) continue;
    const faculty = facultyForFootprint(footprint), landmark = footprint.excludeLandmark;
    path(ctx, footprint.pixels);
    for (const hole of footprint.holes) { ctx.moveTo(...hole[0]); hole.slice(1).forEach((point) => ctx.lineTo(...point)); ctx.closePath(); }
    ctx.fillStyle = faculty ? faculty.accent + "77" : landmark ? "#e3bd73" : "#c7cec8";
    ctx.strokeStyle = faculty ? faculty.accent : landmark ? "#a47c3c" : "#8e9e97";
    ctx.lineWidth = 1.2 / Math.sqrt(scale); ctx.fill("evenodd"); ctx.stroke();
  }
  // Share the actual detailed-model envelopes with the 3D scene and planting.
  for (const shape of getLandmarkPlanShapes()) {
    path(ctx, shape.points.map(worldToPixel));
    for (const hole of shape.holes) { const ring=hole.map(worldToPixel); ctx.moveTo(...ring[0]); ring.slice(1).forEach(point=>ctx.lineTo(...point));ctx.closePath(); }
    ctx.fillStyle=shape.kind==="roof"?(shape.landmarkId==="fsktm"?"#86b5ba":"#dfbf7c"):shape.kind==="sports"?"#acc3a0":"#dfe1d4";
    ctx.strokeStyle=shape.kind==="roof"?"#a68c56":"#c5ccbf";ctx.lineWidth=.9/Math.sqrt(scale);ctx.fill("evenodd");ctx.stroke();
  }
  for (const tree of trees) {
    const [px,py]=worldToPixel([tree.x,tree.z]),r=tree.radius/MAP_SCALE;
    ctx.fillStyle=tree.species==="pink-flowering"?"#e9a9bd99":"#86a57b99";ctx.strokeStyle=tree.species==="pink-flowering"?"#c47c9980":"#60825d80";ctx.lineWidth=.5/scale;
    ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  // Keep labels at a readable screen size. Resolve nearby labels in screen
  // space so the academic buildings do not become a pile of overlapping names.
  const occupied = [];
  const label = (text, px, py, color) => {
    const fontSize = 12 * uiScale / scale, padding = 7 * uiScale / scale, h = 25 * uiScale / scale;
    ctx.font = `600 ${fontSize}px Arial, sans-serif`;
    const w = ctx.measureText(text).width + padding * 2;
    const left=(10-x)/scale, right=(width-10-x)/scale, topEdge=(10-y)/scale, bottomEdge=(height-10-y)/scale;
    if(px<left-10/scale||px>right+10/scale||py<topEdge-10/scale||py>bottomEdge+10/scale)return;
    ctx.fillStyle=color;ctx.beginPath();ctx.arc(px,py,3.2/scale,0,Math.PI*2);ctx.fill();
    const gap=8*uiScale/scale, shift=31*uiScale/scale;
    const candidates=[
      [-w/2,-h-gap],[-w/2,gap],[-w-gap,-h/2],[gap,-h/2],
      [-w/2,-h-gap-shift],[-w/2,gap+shift],
      [-w-gap,-h-gap],[gap,-h-gap],[-w-gap,gap],[gap,gap],
    ].map(([dx,dy])=>({x:Math.max(left,Math.min(right-w,px+dx)),y:Math.max(topEdge,Math.min(bottomEdge-h,py+dy))}));
    const chosen=candidates.find((p)=>!occupied.some((r)=>p.x<r.x+r.w+3/scale&&p.x+w+3/scale>r.x&&p.y<r.y+r.h+3/scale&&p.y+h+3/scale>r.y));
    // Distant offscreen leaders are less useful than a clean map. Retain its
    // colored point when the current zoom leaves no nearby room for the name.
    if(!chosen)return;
    const lx=chosen.x,ly=chosen.y;
    occupied.push({ x: lx, y: ly, w, h });
    ctx.strokeStyle = color; ctx.lineWidth = 1 / scale; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(Math.max(lx,Math.min(lx+w,px)),Math.max(ly,Math.min(ly+h,py))); ctx.stroke();
    ctx.fillStyle = "#fffdf7"; ctx.strokeStyle = color + "80";
    ctx.beginPath(); ctx.roundRect(lx, ly, w, h, 5 / scale); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, lx+w/2, ly + h / 2);
  };
  for (const faculty of FACULTIES) label(faculty.short, ...faculty.pixel, faculty.accent);
  for (const [id, landmark] of Object.entries(CAMPUS_LANDMARKS)) {
    const shortNames={hall:"Dewan SI",mosque:"Masjid SI",swimming:"Swimming",stadium:"Stadium"};
    if (LANDMARK_NAMES[id]) label(scale<.58?(shortNames[id]||LANDMARK_NAMES[id]):LANDMARK_NAMES[id], ...landmark.pixel, id === "fsktm" ? "#2b7587" : "#7f653b");
  }
  for (const stop of busStops) {
    if (!pointIsValid(stop.position)) continue;
    const [px, py] = worldToPixel(stop.position), r = 5.5 * uiScale / scale;
    ctx.fillStyle = "#fffdf7"; ctx.strokeStyle = "#2c7291"; ctx.lineWidth = 1.6 / scale;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#2c7291"; ctx.font = `bold ${7 * uiScale / scale}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("B", px, py + .2 / scale);
    if (scale > .95 && uiScale === 1) {
      ctx.font = `${10 / scale}px Arial`; ctx.textAlign = "left";
      ctx.fillStyle = "#fffdf7"; const w = ctx.measureText(stop.name).width + 8 / scale;
      ctx.fillRect(px + r + 2 / scale, py - 7 / scale, w, 14 / scale);
      ctx.fillStyle = "#2c5970"; ctx.fillText(stop.name, px + r + 5 / scale, py);
    }
  }
  for (const mark of [...items, ...(draft ? [draft] : [])]) drawMark(ctx, mark, scale, mark.id === selected);
  ctx.restore();
}

function drawMark(ctx, mark, scale, selected) {
  ctx.save(); ctx.strokeStyle = mark.color; ctx.fillStyle = mark.color;
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 4;
  if (mark.type === "highlight") {
    const points = mark.points;
    if (!points.length) { ctx.restore(); return; }
    ctx.globalAlpha = .38; ctx.lineWidth = 22;
    ctx.beginPath(); ctx.moveTo(...points[0]); points.slice(1).forEach((p) => ctx.lineTo(...p));
    if (points.length === 1) ctx.lineTo(points[0][0] + .1, points[0][1]);
    ctx.stroke();
  } else if (mark.type === "rectangle" || mark.type === "circle") {
    const [a, b] = mark.points, x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]);
    ctx.beginPath();
    if (mark.type === "circle") ctx.ellipse(x + w / 2, y + h / 2, Math.max(.1, w / 2), Math.max(.1, h / 2), 0, 0, Math.PI * 2);
    else ctx.rect(x, y, w, h);
    ctx.globalAlpha = .12; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
  } else if (mark.type === "note") {
    const padding = 12, lineHeight = 32;
    ctx.textAlign = "left";
    const { lines, width: w, height: h } = noteLayout(ctx, mark.text);
    ctx.beginPath(); ctx.roundRect(mark.x, mark.y, w, h, 8); ctx.fillStyle = "#fffdf7"; ctx.fill(); ctx.stroke();
    ctx.fillStyle = mark.color; ctx.textBaseline = "top";
    lines.forEach((line, i) => ctx.fillText(line, mark.x + padding, mark.y + padding + i * lineHeight, w - padding * 2));
  }
  if (selected) {
    const points = mark.points || [[mark.x, mark.y]];
    ctx.globalAlpha = 1; ctx.fillStyle = "#213f4c"; ctx.strokeStyle = "#fffdf7"; ctx.lineWidth = 1.5 / scale;
    for (const point of [points[0], points.at(-1)]) { ctx.beginPath(); ctx.arc(...point, 4 / scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
  ctx.restore();
}

function validMark(mark) {
  if (!mark || !["highlight", "rectangle", "circle", "note"].includes(mark.type) || !COLORS.includes(mark.color)) return false;
  if (mark.type === "note") return Number.isFinite(mark.x) && Number.isFinite(mark.y) && typeof mark.text === "string" && mark.text.length > 0 && mark.text.length <= 500;
  return Array.isArray(mark.points) && mark.points.length > 0 && mark.points.length <= 10000 && mark.points.every(pointIsValid) && (mark.type === "highlight" || mark.points.length === 2);
}

export default function CampusPlan2D({ busStops = EMPTY_STOPS }) {
  const [trees, setTrees] = useState([]), [showTrees, setShowTrees] = useState(true);
  const [open, setOpen] = useState(false), [tool, setTool] = useState("highlight"), [color, setColor] = useState(COLORS[0]);
  const [history, setHistory] = useState({ past: [], present: [], future: [] }), [draft, setDraft] = useState(null), [note, setNote] = useState("");
  const [view, setView] = useState({ scale: .5, x: 0, y: 0 }), [size, setSize] = useState({ width: 1, height: 1 });
  const [selected, setSelected] = useState(null), [status, setStatus] = useState("Saved on this device"), [clearConfirm, setClearConfirm] = useState(false);
  const [exportFile, setExportFile] = useState(null), [exporting, setExporting] = useState(false);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef(null), areaRef = useRef(null), modalRef = useRef(null), openerRef = useRef(null);
  const gestureRef = useRef(null), viewRef = useRef(view), draftRef = useRef(null), pointersRef = useRef(new Map());
  const historyRef = useRef(history), fitRef = useRef(.5);
  historyRef.current = history; viewRef.current = view;
  const updateDraft = (value) => { draftRef.current = value; setDraft(value); };
  const commit = useCallback((items) => {
    setHistory((h) => ({ past: [...h.past, h.present].slice(-60), present: items, future: [] }));
    setClearConfirm(false);
  }, []);
  const undo = useCallback(() => setHistory((h) => h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1), future: [h.present, ...h.future] } : h), []);
  const redo = useCallback(() => setHistory((h) => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h), []);
  const fit = useCallback(() => {
    const rect = areaRef.current?.getBoundingClientRect(); if (!rect?.width || !rect.height) return;
    const scale = Math.min((rect.width - 70) / (MAP_BOUNDS.maxX - MAP_BOUNDS.minX), (rect.height - 80) / (MAP_BOUNDS.maxY - MAP_BOUNDS.minY));
    fitRef.current = Math.max(.08, scale);
    setView({ scale: fitRef.current, x: rect.width / 2 - (MAP_BOUNDS.minX + MAP_BOUNDS.maxX) / 2 * scale, y: rect.height / 2 - (MAP_BOUNDS.minY + MAP_BOUNDS.maxY) / 2 * scale });
  }, []);
  const close = useCallback(() => { setOpen(false); updateDraft(null); gestureRef.current = null; pointersRef.current.clear(); requestAnimationFrame(() => openerRef.current?.focus()); }, []);

  useEffect(() => {
    const receive = (event) => { if (Array.isArray(event.detail?.trees)) setTrees(event.detail.trees); };
    window.addEventListener("husseinverse:scene-layout", receive);
    return () => window.removeEventListener("husseinverse:scene-layout", receive);
  }, []);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(stored?.annotations)) setHistory({ past: [], present: stored.annotations.filter(validMark).slice(0, 2000), future: [] });
    } catch { setStatus("Start a new set of marks"); }
    setReady(true);
    const show = () => setOpen(true); window.addEventListener("husseinverse:open-plan", show);
    return () => window.removeEventListener("husseinverse:open-plan", show);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, annotations: history.present })); setStatus("Saved on this device"); }
    catch { setStatus("Use Export to keep your marks; device storage is full"); }
  }, [history.present, ready]);
  useEffect(() => {
    if (!exportFile) return;
    const timer = setTimeout(() => setExportFile(null), 10 * 60 * 1000);
    return () => { clearTimeout(timer); URL.revokeObjectURL(exportFile.url); };
  }, [exportFile]);
  useEffect(() => {
    if (!open) return;
    const area = areaRef.current, observer = new ResizeObserver(() => {
      const rect = area.getBoundingClientRect(); setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(area); fit();
    const focus = requestAnimationFrame(() => modalRef.current?.querySelector("button")?.focus());
    window.dispatchEvent(new CustomEvent("husseinverse:plan-visibility", { detail: true }));
    return () => { observer.disconnect(); cancelAnimationFrame(focus); window.dispatchEvent(new CustomEvent("husseinverse:plan-visibility", { detail: false })); };
  }, [open, fit]);
  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const canvas = canvasRef.current, dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.width * dpr); canvas.height = Math.round(size.height * dpr);
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMap(ctx, view, size.width, size.height, busStops, history.present, draft, selected, 1, showTrees ? trees : []);
  }, [open, size, view, busStops, history.present, draft, selected, trees, showTrees]);
  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const wheel = (event) => {
      event.preventDefault(); event.stopPropagation();
      const rect = canvas.getBoundingClientRect(), sx = event.clientX - rect.left, sy = event.clientY - rect.top;
      setView((v) => {
        const scale = Math.min(5, Math.max(fitRef.current * .4, v.scale * Math.exp(-event.deltaY * .0014)));
        return { scale, x: sx - (sx - v.x) * scale / v.scale, y: sy - (sy - v.y) * scale / v.scale };
      });
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  }, [open]);

  const screenPoint = (event) => { const rect = canvasRef.current.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top]; };
  const mapPoint = ([x, y], v = viewRef.current) => [(x - v.x) / v.scale, (y - v.y) / v.scale];
  const begin = (event) => {
    event.preventDefault(); event.stopPropagation();
    const screen = screenPoint(event); pointersRef.current.set(event.pointerId, screen); event.currentTarget.setPointerCapture(event.pointerId);
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()], middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      gestureRef.current = { kind: "pinch", distance: Math.hypot(a[0] - b[0], a[1] - b[1]), middle, view: viewRef.current }; updateDraft(null); return;
    }
    const point = mapPoint(screen);
    if (tool === "pan" || event.button === 1 || event.button === 2) { gestureRef.current = { kind: "pan", screen, view: viewRef.current }; return; }
    if (tool === "note") {
      if (!note.trim()) { setStatus("Write your note above, then tap its position on the map"); return; }
      const mark = { id: crypto.randomUUID(), type: "note", color, x: point[0], y: point[1], text: note.trim().slice(0, 500) };
      commit([...historyRef.current.present, mark]); setSelected(mark.id); setNote(""); return;
    }
    gestureRef.current = { kind: "draw" };
    updateDraft({ id: crypto.randomUUID(), type: tool, color, points: tool === "highlight" ? [point] : [point, point] });
  };
  const move = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const screen = screenPoint(event); pointersRef.current.set(event.pointerId, screen);
    const gesture = gestureRef.current; if (!gesture) return;
    if (gesture.kind === "pinch" && pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()], middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const scale = Math.min(5, Math.max(fitRef.current * .4, gesture.view.scale * Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(1, gesture.distance)));
      const point = mapPoint(gesture.middle, gesture.view);
      setView({ scale, x: middle[0] - point[0] * scale, y: middle[1] - point[1] * scale }); return;
    }
    if (gesture.kind === "pan") { setView({ ...gesture.view, x: gesture.view.x + screen[0] - gesture.screen[0], y: gesture.view.y + screen[1] - gesture.screen[1] }); return; }
    if (gesture.kind === "draw" && draftRef.current) {
      const mark = draftRef.current, point = mapPoint(screen);
      if (mark.type === "highlight") {
        const last = mark.points.at(-1); if (Math.hypot(point[0] - last[0], point[1] - last[1]) < 2 / viewRef.current.scale || mark.points.length >= 10000) return;
        updateDraft({ ...mark, points: [...mark.points, point] });
      } else updateDraft({ ...mark, points: [mark.points[0], point] });
    }
  };
  const end = (event) => {
    if (gestureRef.current?.kind === "draw" && draftRef.current) { commit([...historyRef.current.present, draftRef.current]); setSelected(draftRef.current.id); updateDraft(null); }
    pointersRef.current.delete(event.pointerId); gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const zoom = (factor) => setView((v) => {
    const scale = Math.min(5, Math.max(fitRef.current * .4, v.scale * factor));
    return { scale, x: size.width / 2 - (size.width / 2 - v.x) * scale / v.scale, y: size.height / 2 - (size.height / 2 - v.y) * scale / v.scale };
  });
  const download = (url, filename) => {
    const a = document.createElement("a"); a.href = url; a.download = filename;
    a.style.display = "none"; document.body.appendChild(a); a.click(); a.remove();
  };
  const exportPNG = () => {
    if (exporting) return;
    setExporting(true); setStatus("Preparing your PNG…");
    const canvas = document.createElement("canvas"); canvas.width = 2600; canvas.height = 1900;
    const ctx = canvas.getContext("2d"), points = history.present.flatMap((mark) => {
      if (mark.points) return mark.points;
      const { width, height } = noteLayout(ctx, mark.text);
      return [[mark.x, mark.y], [mark.x + width, mark.y + height]];
    });
    const minX = Math.min(MAP_BOUNDS.minX, ...points.map((p) => p[0])) - 80, maxX = Math.max(MAP_BOUNDS.maxX, ...points.map((p) => p[0])) + 80;
    const minY = Math.min(MAP_BOUNDS.minY, ...points.map((p) => p[1])) - 80, maxY = Math.max(MAP_BOUNDS.maxY, ...points.map((p) => p[1])) + 80;
    const scale = Math.min(2480 / (maxX - minX), 1620 / (maxY - minY));
    drawMap(ctx, { scale, x: 1300 - (minX + maxX) / 2 * scale, y: 950 - (minY + maxY) / 2 * scale }, 2600, 1900, busStops, history.present, null, null, 1.75, showTrees ? trees : []);
    ctx.fillStyle = "#fffdf7"; ctx.fillRect(0, 0, 2600, 112); ctx.fillRect(0, 1830, 2600, 70);
    ctx.fillStyle = "#213f4c"; ctx.font = "bold 38px Arial"; ctx.textAlign = "left"; ctx.fillText("HUSSEINVERSE · CAMPUS FIX MAP", 55, 68);
    ctx.font = "24px Arial"; ctx.textAlign = "right"; ctx.fillText(`${history.present.length} marks · ${new Date().toLocaleDateString("en-GB")}`, 2545, 66);
    ctx.font = "22px Arial"; ctx.textAlign = "left"; ctx.fillText("UTHM Parit Raja · Schematic campus footprints · Annotations for visual corrections", 55, 1872);
    canvas.toBlob((blob) => {
      setExporting(false);
      if (!blob) { setStatus("The PNG could not be prepared. Please try Export PNG again."); return; }
      const url = URL.createObjectURL(blob), filename = `husseinverse-fix-map-${new Date().toISOString().slice(0, 10)}.png`;
      setExportFile({ url, filename });
      setStatus("PNG ready — use Download PNG to save it");
      download(url, filename);
    }, "image/png");
  };
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ version: 1, campus: "UTHM Parit Raja", coordinates: "campus-layout source pixels", annotations: history.present }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); download(url, "husseinverse-campus-fixes.json"); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Editable annotation file exported");
  };
  const focusMark = (mark) => {
    setSelected(mark.id); const point = mark.points ? mark.points[Math.floor(mark.points.length / 2)] : [mark.x, mark.y];
    setView((v) => ({ scale: v.scale, x: size.width / 2 - point[0] * v.scale, y: size.height / 2 - point[1] * v.scale }));
  };
  const keyDown = (event) => {
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (!event.target.matches("input,textarea") && (event.ctrlKey || event.metaKey)) {
      if (event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if (event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
    }
    if (event.key === "Tab") {
      const controls = [...modalRef.current.querySelectorAll("button:not(:disabled),a[href],input,textarea,[tabindex='0']")].filter((element) => element.offsetParent !== null);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };

  return <>
    <button id="open-campus-plan" ref={openerRef} className="plan2d-open" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}><span aria-hidden="true">▧</span><span>2D map <small>Mark fixes</small></span></button>
    {open && <section id="campus-plan-overlay" className="plan2d-overlay" role="dialog" aria-modal="true" aria-labelledby="plan2d-title" ref={modalRef} onKeyDown={keyDown} onPointerDown={(event) => event.stopPropagation()} onKeyUp={(event) => event.stopPropagation()}>
      <header className="plan2d-header">
        <div className="plan2d-heading"><span className="plan2d-eyebrow">HUSSEINVERSE · UTHM PARIT RAJA</span><h2 id="plan2d-title">Point out what needs fixing.</h2><p>Highlight an area, draw a box, or leave a note on the campus map.</p></div>
        <div className="plan2d-head-actions"><button className="plan2d-export" onClick={exportPNG} disabled={exporting}>{exporting ? "Preparing…" : "Export PNG"} <span aria-hidden="true">↗</span></button><button className="plan2d-close" onClick={close} aria-label="Close 2D map and return to 3D">×</button></div>
      </header>
      <div className="plan2d-toolbar" role="toolbar" aria-label="Map annotation tools">
        <div className="plan2d-tool-group">{TOOLS.map((item) => <button key={item.id} onClick={() => { setTool(item.id); updateDraft(null); }} className={tool === item.id ? "active" : ""} aria-pressed={tool === item.id} title={item.id === "pan" ? "Drag to move the map" : item.label}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</div>
        <div className="plan2d-colors" role="group" aria-label="Annotation color">{COLORS.map((value, i) => <button key={value} className={color === value ? "active" : ""} style={{ "--mark-color": value }} onClick={() => setColor(value)} aria-label={`${["Red", "Gold", "Blue", "Purple"][i]} annotation color`} aria-pressed={color === value}/>)}</div>
        <div className="plan2d-history"><button onClick={undo} disabled={!history.past.length} title="Undo (Ctrl+Z)" aria-label="Undo annotation">↶</button><button onClick={redo} disabled={!history.future.length} title="Redo (Ctrl+Shift+Z)" aria-label="Redo annotation">↷</button><button onClick={() => setClearConfirm(true)} disabled={!history.present.length}>Clear</button></div>
        {tool === "note" && <label className="plan2d-note-input"><span>Note</span><input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="e.g. This wing needs one less floor" aria-label="Note text to place on the map"/><small>Then tap the map to place it.</small></label>}
        {clearConfirm && <div className="plan2d-clear-confirm" role="alertdialog" aria-label="Clear all annotations"><span>Clear all {history.present.length} marks?</span><button onClick={() => { commit([]); setSelected(null); }}>Clear marks</button><button onClick={() => setClearConfirm(false)}>Cancel</button></div>}
      </div>
      <div className="plan2d-body">
        <div ref={areaRef} className={`plan2d-map-area tool-${tool}`}>
          <canvas ref={canvasRef} aria-label="UTHM campus map. Choose an annotation tool and drag to mark an area. Use Move to pan, or scroll to zoom." tabIndex={0} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { updateDraft(null); gestureRef.current = null; pointersRef.current.clear(); }} onContextMenu={(event) => event.preventDefault()}/>
          <div className="plan2d-map-key"><span><i className="key-faculty"/>Faculty</span><span><i className="key-landmark"/>Landmark</span><span><i className="key-bus"/>Bus stop</span><label className="plan2d-tree-toggle"><input type="checkbox" checked={showTrees} onChange={event=>setShowTrees(event.target.checked)}/> Trees</label></div>
          <div className="plan2d-map-controls" role="group" aria-label="2D map view controls"><button onClick={() => zoom(1.3)} aria-label="Zoom in on 2D map">+</button><button onClick={() => zoom(1 / 1.3)} aria-label="Zoom out on 2D map">−</button><button onClick={fit}>Fit map</button></div>
          <span className="plan2d-map-caption">Schematic footprints · Scroll or pinch to zoom</span>
        </div>
        <aside className="plan2d-sidebar" aria-label="Saved map annotations">
          <div className="plan2d-list-heading"><h3>Your fix list</h3><span>{history.present.length}</span></div>
          {history.present.length === 0 ? <div className="plan2d-empty"><span aria-hidden="true">✎</span><strong>Start with one area.</strong><p>Draw over a building or add a short note. Your marks stay saved here.</p></div> : <ol className="plan2d-mark-list">{history.present.map((mark, index) => <li key={mark.id} className={selected === mark.id ? "selected" : ""}><button className="plan2d-focus-mark" onClick={() => focusMark(mark)}><i style={{ background: mark.color }}/><span><b>{annotationName(mark, index)}</b><small>{mark.type === "note" ? "Text note" : "Marked area"}</small></span></button><button className="plan2d-delete-mark" aria-label={`Delete ${annotationName(mark, index)}`} onClick={() => { commit(history.present.filter((item) => item.id !== mark.id)); if (selected === mark.id) setSelected(null); }}>×</button></li>)}</ol>}
          <div className="plan2d-sidebar-foot"><p>Export the map and share it in the chat when you want a correction.</p><button onClick={exportJSON}>Save editable marks <span aria-hidden="true">↓</span></button></div>
        </aside>
      </div>
      <footer className="plan2d-footer"><span role="status" aria-live="polite"><i/>{status}{exportFile && <a className="plan2d-download" href={exportFile.url} download={exportFile.filename}>Download PNG ↓</a>}</span><span>{history.present.length} {history.present.length === 1 ? "mark" : "marks"} · <kbd>Esc</kbd> back to 3D</span></footer>
    </section>}
  </>;
}

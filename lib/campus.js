import * as THREE from "three";
import { createFSKTM, FSKTM } from "./models/fsktm.js";
import { CAMPUS_LANDMARKS, MAP_BOUNDS, mapToWorld } from "./campus-layout.js";
import { buildMappedCampus } from "./mapped-campus.js";
import { rectangleBoundary, containsPoint, transformBoundary } from "./navigation.js";
import { createLandmark } from "./models/landmarks.js";
import { FACULTIES } from "./faculty-data.js";
import { BUS_STOPS, KATSANA_URL } from "./bus-stops.js";
import { buildCampusTransit } from "./campus-transit.js";
import { getLandmarkPlantingExclusions, getEntryCorridors } from "./site-layout.js";
import { applyFoliageTextures } from "./foliage-textures.js";

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
    updateEnvironment = () => {},
    disposeEnvironment = () => {},
    disposeFoliageTextures = () => {},
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
      h: 33,
      faculty: true,
      entry: FSKTM.entry,
      camera: { distance: 132, pitch: 0.42, yaw: -0.56, height: 12 },
      pano: "350dd70abf1a47ccbe278d5ad0787a5d",
      panoView: { heading: -28.73, pitch: -15.7, field: 75 },
      panoLabel: "View aerial · 360°",
      panoDescription:
        "Find the Faculty of Computer Science and Information Technology hotspot on the right of UTHM’s academic loop. This is the official aerial panorama; a dedicated ground-level FSKTM panorama is not included in the published tour.",
      description:
        "A seven-floor central tower with three-floor lower wings, including the angled SMC@FSKTM wing. Explore the detailed entrance, façades and roofline.",
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
  for (const faculty of FACULTIES) places.splice(places.length - 1, 0, {
    ...faculty, x: faculty.position[0], z: faculty.position[1], h: faculty.modelHeight,
    type: "FACULTY · " + faculty.short, faculty: true,
    sub: faculty.name.replace("Faculty of ", ""),
    camera: { distance: 105, pitch: 0.48, yaw: 0.24, height: 5 },
    pano: "350dd70abf1a47ccbe278d5ad0787a5d", panoLabel: "View aerial · 360°",
    panoDescription: "UTHM’s campus aerial panorama. Use the aerial hotspots to explore the faculty area; this is a shared campus view.",
  });
  const tourPlaces = [...places];
  for (const stop of BUS_STOPS) places.push({
    ...stop, busStop: true, name: `${stop.name} bus stop`,
    x: stop.position[0], z: stop.position[1], type: "CAMPUS SHUTTLE · BUS STOP",
    sub: `Shuttle pickup · ${stop.routeNames.length} ${stop.routeNames.length === 1 ? "route" : "routes"}`,
    description: `Shuttle pickup at ${stop.name}. Routes: ${stop.routeNames.join(", ")}. Open the live bus map for current shuttle locations.`,
    camera: { distance: 28, pitch: 0.32, yaw: stop.yaw, height: 1.6 },
    actionLabel: "Live bus map",
  });
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
  const hemi = new THREE.HemisphereLight("#edf6ff", "#6c8058", 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff0cf", 3.05);
  sun.position.set(-160, 240, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -290;
  sun.shadow.camera.right = 290;
  sun.shadow.camera.top = 290;
  sun.shadow.camera.bottom = -290;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 700;
  sun.shadow.normalBias = 0.08;
  sun.shadow.bias = -0.0004;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#c2e7ff", 0.38);
  fill.position.set(150, 70, -180);
  scene.add(fill);
  const materials = new Map();
  function mat(color, extra = {}) {
    const key = color + JSON.stringify(extra);
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness: 0.76, ...extra }),
      );
    return materials.get(key);
  }
  const collisions = [];
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
  function addDetailedLandmark(id) {
    const placement = CAMPUS_LANDMARKS[id];
    const { root, boundaries } = createLandmark(id, { material: mat });
    root.position.set(placement.position[0], 0, placement.position[1]);
    root.rotation.y = placement.yaw;
    root.scale.setScalar(placement.modelScale);
    scene.add(root);
    collisions.push(...boundaries.map((boundary) => transformBoundary(boundary, placement)));
    const place = places.find((p) => p.id === id);
    place.h = new THREE.Box3().setFromObject(root).max.y;
    place.anchor?.set(place.x, place.h + 3, place.z);
    place.camera = { distance: id === "stadium" ? 140 : 105,
      pitch: 0.48, yaw: placement.yaw + 0.12, height: place.h * 0.3 };
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
    document.body.classList.toggle("inspecting-building", p.id !== "aerial");
    $("place-card").hidden = false;
    $("place-category").textContent = p.type;
    $("place-name").textContent = p.name;
    $("place-description").textContent = p.description;
    $("place-source").href = p.source;
    $("view-360").textContent = `${p.actionLabel || p.panoLabel || "Step inside · 360°"} ↗`;
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
    if (innerWidth <= 760 || p.id !== "aerial") collapsePlaces(true);
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
    if (!Number.isInteger(index) || index < 0 || index >= tourPlaces.length)
      throw Error("Unknown tour stop");
    tourIndex = index;
    const p = tourPlaces[index];
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
      `CAMPUS TOUR · ${String(index + 1).padStart(2, "0")} / ${String(tourPlaces.length).padStart(2, "0")}`;
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
      index === tourPlaces.length - 1 ? "Finish tour ✓" : "Next place →";
    $("back-3d").focus({ preventScroll: true });
  }
  function closePanorama() {
    const last = tourPlaces[tourIndex];
    $("panorama").hidden = true;
    clearTimeout(panoTimeout);
    for (const child of $("app").children) child.inert = false;
    $("pano-frame").src = "about:blank";
    selectPlace(last.id);
    $("view-360").focus({ preventScroll: true });
  }
  let placeFilter = "all";
  function filterPlaces() {
    const query = $("place-search").value.trim().toLowerCase();
    let visible = 0;
    for (const p of places) {
      const show = (placeFilter !== "faculties" || p.faculty) && (placeFilter !== "landmarks" || (!p.faculty && !p.busStop)) && (placeFilter !== "bus-stops" || p.busStop) && `${p.name} ${p.short}`.toLowerCase().includes(query);
      p.row.hidden = !show;
      if (show) visible++;
    }
    $("places-empty").hidden = visible > 0;
  }
  function initUI() {
    $("places").replaceChildren();
    $("world-labels").replaceChildren();
    places.forEach((p, i) => {
      const row = document.createElement("button");
      row.className = "place-row";
      row.dataset.place = p.id;
      p.row = row;
      row.innerHTML = `<span class="place-number">${p.busStop ? "▣" : String(i + 1).padStart(2, "0")}</span><span class="place-text">${p.short}<small>${p.sub}</small></span><span class="place-arrow">↗</span>`;
      row.onclick = () => selectPlace(p.id);
      $("places").appendChild(row);
      const pin = document.createElement("button");
      pin.className = "landmark-label";
      pin.dataset.place = p.id;
      pin.setAttribute("aria-label", `Explore ${p.name}`);
      const pinName = { library: "PTTA", hall: "Dewan Sultan Ibrahim", mosque: "Masjid", swimming: "Swimming", stadium: "Stadium", aerial: "Campus aerial" }[p.id] || p.short;
      if (p.busStop) pin.classList.add("bus-stop-label");
      pin.innerHTML = `<span class="pin-num">${p.busStop ? "▣" : i + 1}</span><span>${pinName}</span>`;
      pin.onclick = () => selectPlace(p.id);
      $("world-labels").appendChild(pin);
      p.pin = pin;
      p.labelWidth = pin.getBoundingClientRect().width;
      p.anchor = new THREE.Vector3(p.x, p.h + (p.busStop ? 1.3 : 5), p.z);
    });
    $("place-search").oninput = filterPlaces;
    for (const button of document.querySelectorAll("[data-place-filter]")) button.onclick = () => {
      placeFilter = button.dataset.placeFilter;
      for (const item of document.querySelectorAll("[data-place-filter]"))
        item.setAttribute("aria-pressed", String(item === button));
      filterPlaces();
    };
    renderVisitCount();
    if (innerWidth <= 760) collapsePlaces(true);
    $("place-total").textContent = `6 faculties · ${BUS_STOPS.length} shuttle stops`;
    $("home").onclick = home;
    $("reset-view").onclick = home;
    $("overview-mode").onclick = () => setMode("overview");
    $("walk-mode").onclick = () => setMode("walk");
    $("close-card").onclick = closeCard;
    $("collapse-places").onclick = () =>
      collapsePlaces(!$("places-panel").classList.contains("collapsed"));
    $("view-360").onclick = () => {
      if (!selected) return;
      if (selected.busStop) window.open(KATSANA_URL, "_blank", "noopener,noreferrer");
      else openPanorama(tourPlaces.indexOf(selected));
    };
    $("tour-start").onclick = () => openPanorama(0);
    $("back-3d").onclick = closePanorama;
    $("prev-stop").onclick = () => tourIndex > 0 && openPanorama(tourIndex - 1);
    $("next-stop").onclick = () => {
      if (tourIndex < tourPlaces.length - 1) openPanorama(tourIndex + 1);
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
        mode === "walk" ? 18 : selected?.busStop ? 12 : selected?.id === "fsktm" ? 35 : 70,
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
        targetDistance = selected.busStop ? 34 : selected.id === "fsktm" ? 80 : 180;
      }
    };
    $("light-toggle").onclick = () => {
      evening = !evening;
      sun.color.set(evening ? "#ffb673" : "#fff0cf");
      sun.intensity = evening ? 2.2 : 3.05;
      hemi.intensity = evening ? 1.05 : 1.35;
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
          mode === "walk" ? 18 : selected?.busStop ? 12 : selected?.id === "fsktm" ? 35 : 70,
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
      if ($("campus-plan-overlay")) return;
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
    if (mode !== "walk" || !$("panorama").hidden || $("about-dialog").open || $("campus-plan-overlay"))
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
    const nearbyPlaces = places.map((place) => ({place, distance: Math.hypot(place.entry[0] - player.position.x, place.entry[1] - player.position.z)})).filter(({distance}) => distance < 11);
    nearbyPlaces.sort((a, b) => a.distance - b.distance);
    const p = nearbyPlaces[0]?.place;
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
    updateEnvironment(t);
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
    const occupiedLabels = [];
    const labelOrder = selected ? [selected, ...places.filter((p) => p !== selected)] : places;
    for (const p of labelOrder) {
      labelPos.copy(p.anchor).project(camera);
      const x = (labelPos.x * 0.5 + 0.5) * innerWidth,
        y = (-labelPos.y * 0.5 + 0.5) * innerHeight;
      let show =
        labelPos.z < 1 &&
        labelPos.z > -1 &&
        x > 10 &&
        x < innerWidth - 10 &&
        y > 90 &&
        y < innerHeight - 110 &&
        (mode === "overview" || p.anchor.distanceTo(player.position) < 100) &&
        (p === selected || (p.busStop ? placeFilter === "bus-stops" || mode === "walk" : placeFilter !== "bus-stops"));
      const width = p.labelWidth || 110, height = 38;
      const rect = { left: x - width / 2 - 4, right: x + width / 2 + 4, top: y - height - 5, bottom: y + 5 };
      if (show && occupiedLabels.some((r) => rect.left < r.right && rect.right > r.left && rect.top < r.bottom && rect.bottom > r.top)) show = false;
      if (show) occupiedLabels.push(rect);
      p.pin.style.display = show ? "flex" : "none";
      p.pin.style.left = x + "px";
      p.pin.style.top = y + "px";
      p.pin.style.opacity = mode === "walk" ? 0.9 : 1;
    }
    if ($("panorama").hidden && !$("campus-plan-overlay")) renderer.render(scene, camera);
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
    for (const id of ["library", "hall", "mosque", "swimming", "stadium"]) addDetailedLandmark(id);
    const fsktmPlacement = CAMPUS_LANDMARKS.fsktm;
    const fsktm = createFSKTM({ material: mat });
    fsktm.position.set(...[fsktmPlacement.position[0], 0, fsktmPlacement.position[1]]);
    fsktm.rotation.y = fsktmPlacement.yaw;
    fsktm.scale.setScalar(fsktmPlacement.modelScale);
    scene.add(fsktm);
    // createFSKTM centers its public origin on the tower; bounds use the
    // pre-centered design coordinates and need the same 15-unit correction.
    for (const [x, z, width, depth, angle] of FSKTM.bounds)
      collisions.push(transformBoundary(rectangleBoundary(x + 15, z, width, depth, angle), fsktmPlacement));
    const plantingExclusions = [...getLandmarkPlantingExclusions(), ...getEntryCorridors(), ...BUS_STOPS.map((stop) => rectangleBoundary(
      stop.position[0], stop.position[1], 10.3, 3.4, stop.yaw, 1,
    ))];
    const campus = buildMappedCampus({ scene, material: mat, collisions, plantingExclusions });
    window.dispatchEvent(new CustomEvent("husseinverse:scene-layout", {detail:{trees:campus.planting}}));
    updateEnvironment = campus.updateEnvironment || updateEnvironment;
    disposeEnvironment = campus.disposeEnvironment || disposeEnvironment;
    disposeFoliageTextures = applyFoliageTextures(scene,{isDisposed:()=>disposed});
    buildCampusTransit({ scene, material: mat, collisions, stops: BUS_STOPS });
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
        if (input.view === "panorama") {
          const index = tourPlaces.findIndex((p) => p.id === input.landmark);
          if (index < 0) throw Error("Bus stops support the 3D view. Use their Live bus map button for shuttle tracking.");
          openPanorama(index);
        }
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
    disposeEnvironment();
    disposeFoliageTextures();
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

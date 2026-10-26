# Husseinverse

A Next.js campus explorer for **Universiti Tun Hussein Onn Malaysia, Parit Raja**. The first version combines an original walkable Three.js campus with links and embeds for UTHM's real 360° photography.

## Run locally

Requires Node.js 20.9 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4173. For a production build:

```sh
npm run build
npm start
```

The Next.js App Router project uses `output: 'export'`. Its production output is `out/`; it can be served by a static host. The project is also compatible with a normal Next.js deployment on Vercel. No API keys or database are required.

## Included

- Twenty-nine selectable places: twelve campus destinations and seventeen shuttle stops. The campus destinations include six Parit Raja faculties: FSKTM, FPTP, FPTV, FKAAB, FKEE and the FKMP laboratory complex. Filter by faculty, landmark or bus stop, or search by name.
- FSKTM corrected to **seven total tower floors** (ground + six) and **three total floors per lower wing** (ground + two), preserving the angled left SMC@FSKTM wing and straight right wing.
- A 2D campus canvas for highlighting fixes: freehand highlights, boxes, circles, notes, undo/redo, browser-local saving and PNG/editable-mark export.
- Original world-space grass and asphalt textures, animated aqua ponds with shallow-water gradients and sandy margins, plus sparse grass tufts.
- Seventeen UTHM Katsana stop markers, reference-inspired leaf-roof shelters, open waiting areas and a direct live-tracker link.
- Campus building outlines, positions and orientations traced from the official map, with major roads and ponds. An overhead camera control makes footprints easy to inspect.
- Orbiting campus view, smooth camera transitions, zoom, daylight/evening lighting, and selectable landmark markers.
- Third-person walking using WASD, arrow keys or on-screen controls. Shift runs; V changes view. Drag turns the camera.
- Building collision boundaries and checked arrival points.
- Real 360° tour navigation using the exact panorama identifiers published by UTHM's International Office.
- Browser-local visit progress, responsive controls, keyboard focus, and modal help.
- Optional feature-detected WebMCP navigation tools that share the visible interface's actions.

## Accuracy and current limits

This is an **independent prototype, not an official UTHM service or a surveyed digital twin**. The layout uses 190 footprint components traced from the January 2023 official campus map; these are map components, not a verified count of separate buildings. Detailed landmark models replace their corresponding traced shapes. All 178 remaining footprint components retain their map outlines, angles and courtyards, with modeled window frames, reveals, mullions, sunshades, floor bands, entrances, parapets, and roof services. Faculty blocks use distinct architectural treatments. Heights and concealed elevations are estimated. Major roads and ponds follow the schematic map; landscaping is illustrative. The map is not a current survey and has no verified north bearing. The compass indicates camera rotation. Building interiors and concealed elevations are not reconstructed.

The real panorama media remain hosted by Momento360 and are credited to UTHM's published tour. The top-level library panorama was visually verified. Embedded panoramas did not render inside the development app's in-app browser, so every tour stop includes **Open full view** as a direct alternative and a delayed-loading message. External media availability depends on that provider and the visitor's browser. This implementation does not download or rehost the panorama files.

The 29-place scene, FSKTM floor counts, faculty selection, overhead view, walking arrivals and production build were checked. Every arrival position is validated against collision bounds during initialization. Run `npm test` for checks covering rotated wings, concave footprints and open courtyards. Phone-specific styles are included, but the available browser's viewport override did not take effect, so phone rendering needs a real-device check.

## FSKTM reference and refinement

The original model in `lib/models/fsktm.js` follows the supplied `public/assets/reffsktm/directory` floor plans and `public/assets/reffsktm` photographs. The owner has corrected the earlier interpretation of the directory: the tower has seven total floors and each lower wing has three total floors, including ground. That correction takes precedence over the earlier directory reading. The right wing continues straight across the tower junction; the left wing turns forward by approximately 35 degrees. That angle is estimated from the photographed plans, not a measured survey. These newer references take precedence over the campus map's simplified block P outline.

The two wings have different facades. The left uses long corridor window bands, piers, a tall louvred panel and blue SMC@FSKTM lettering with a red @. The right uses grouped window bays, contrasting vertical panels and rooftop solar arrays. The tower includes rounded front corners, green window columns, projecting shades and a recessed entrance. Roof overhangs, parking and a shaded forecourt complete the exterior. Dimensions, concealed connections, rear elevations and landscaping remain approximate.

The supplied photographs were also compared with the UTHM-authored front photograph and the aerial photograph on page 79 of _Discovery Awaits: Unveiling UTHM_. The references document different views and dates; they do not establish every detail of the building's current condition.

FSKTM's photographic tour reference is UTHM's second campus aerial panorama, `350dd70abf1a47ccbe278d5ad0787a5d`. Its FSKTM hotspot was visually confirmed during reference review. The button is labeled **View aerial · 360°** because this is an aerial campus reference, not a dedicated ground-level FSKTM panorama.

## Detailed campus upgrade

The detailed models are connected to the live explorer: PTTA has an open annular courtyard, the mosque has smooth domes and minaret balconies, DSI has modeled glazed elevations and roof details, and the sports buildings have structural, seating and equipment detail. FSKTM has 205,526 triangles with rounded edges, recessed glazing, roof ribs, gutters, solar arrays and entrance detail.

Repeated mapped-campus details use instanced geometry; landmark details are merged by material. The complete campus, including the shared shelter model instances, renders roughly 4.50 million triangles while keeping the number of render objects bounded. Faculty identities J (FPTP), K (FPTV), M (FKAAB), P (FSKTM), QA/QB (FKEE), G1 (FKEE labs) and G2 (FKMP labs) were read from the official map legend. These are exterior interpretations rather than fully surveyed replicas. The five added faculty stops use the shared campus aerial panorama, clearly labeled as an aerial view.

Run `npm test` for geometry, FSKTM floor-count, courtyard and arrival-boundary checks. `npm run build` validates the static export.

## Terrain, transit and 2D corrections

Grass, road aggregate, cracks, pond gradients and animated ripple streaks are original procedural artwork. [Pendekar's public screenshots](https://pendekar.io/) informed the fine-grain grass and aqua-water direction; no game code, imagery or textures were copied. All surface detail follows world coordinates, including rotated road instances, and all custom textures are disposed with the scene.

[UTHM Katsana](https://uthm.katsana.com/) supplies the 17 unique main-campus checkpoint names, GPS coordinates and route memberships. Repeated visits to a checkpoint share one shelter. The schematic is rotated and nonuniform, so road placements are approximations matched by landmark identity and route order rather than asserted surveyed positions. Off-campus Kampus Bandar, KK Perwira, KK Taman Universiti and the separate Pagoh campus are excluded. The current source has no stop named FSKTM; none was invented.

The shared shelter is an original interpretation of the silver leaf-shaped roof, banded columns, benches and ramp rails visible in [Google Maps Street View at Bus Stop UTHM Parit Raja](https://www.google.com/maps/place/Bus+Stop+UTHM+Parit+Raja/@1.8531064,103.0882499,17z/) (July 2025 imagery). This is a design reference, not confirmation that every checkpoint has an identical shelter. Waiting areas remain walkable, with collisions limited to columns and furniture. The live tracking button opens Katsana; no simulated live bus positions are shown.

Use **2D map · Mark fixes** to annotate the plan, add text notes and export a PNG to share in a future correction request. Marks are saved on this browser and device. The map is the same schematic coordinate system as the 3D scene; the FSKTM plan uses its corrected wing geometry. Exported editable marks preserve those coordinates.

## Placement and landscape refinement

The placement audit checks projected vertices of the actual detailed geometry against neighboring footprints and water. It identified and corrected the oversized mosque and misaligned swimming centre; the hall, library and stadium retain their checked placement. The mosque crescent was fitted separately from its main hall, and four generic trace fragments already represented by the detailed mosque/FSKTM were linked to their landmark models to prevent duplicate buildings. FSKTM retains its approved seven-floor tower and three-floor wings.

Planting follows deliberate avenue rows and small groves rather than random scatter. The complete canopy clears building roofs, courtyards, entrance corridors, sports grounds, ponds, bus shelters and road furniture. The current composition contains 202 trees, including 153 pink flowering trees, 8,874 individual fallen petals and 192 gently drifting petals. Crowns use asymmetric branch-led lobes, broken leaf edges and subtle individual wind motion; original bitmap detail preserves the modeled warm and cool leaf variation. These are design placements, not a surveyed tree inventory. Foliage and blossom albedo textures were generated as original project assets; the built-in generation prompts are saved in `public/assets/textures/prompts.json`.

All ten pond outlines use the same rounded, gently undulating rings for the water, banks, lawn cutouts, collision boundaries and 2D plan. They retain more than 99% of the original traced area while removing hard corners. Curbs stop at junctions and entrances; lamps avoid shelters, buildings, water and each other. The 2D plan now draws the detailed landmark envelopes and the same planted tree coordinates, with a Trees toggle.

The production export and all 68 geometry, gameplay and placement checks pass. The latest revision was checked using a generated placement plan and automated model tests. Google Maps satellite inspection and live visual QA remain unverified: browser tools still report disabled, and desktop inspection stopped when the current Chrome URL could not be verified.

The campus now uses a shared irregular cutout with a southwestern recess and softened outer corners in both 3D and the 2D correction map. Its lawn, layered side wall, planting limit and walking limit follow the same outline. All source-map buildings, roads, ponds, landmark envelopes and stops fit inside it. The cutout is an illustrated presentation boundary, not a surveyed property boundary.

Road corrections separate the arrival carriageways around the median, place the F2 access on its eastern side, take the academic road around QA/QB, and follow the residential access bends. The false road through the lower administration blocks was removed; the actual eastern approach remains. Stadium grandstands were narrowed to their source-map envelope so the western access road can retain its traced alignment. The full paved widths now clear traced building bodies, detailed landmark roof envelopes and the final wavy pond outlines. Curbs, lamps, planting and bus positions follow the revised road data. Bus-stop side proposals are kept separate from official Katsana records until the affected stop is identified.

All twelve mapped faculty components now use reference-informed architecture: purple screened FPTP wings and tower, blue FPTV panels, pale olive and white FKAAB elevations, yellow FKEE bays, and red pitched G1/G2 workshop roofs around open courts. QA has seven floor rows following the explicit UTHM count. FPTP/FKAAB towers are fitted wholly inside their traced footprints; other dimensions and concealed elevations remain exterior estimates. Shared materials keep their repeated facade and roof detail batched.

## Campus adventure and touch controls

The explorer now has an original articulated student character with a varsity jacket, campus card, backpack, facial detail, attached trainers and smooth walking, running and idle animation. The compact navigation cards, controls and adventure journal share the campus palette. Phone and iPad walking use a proportional thumbstick; a second thumb can turn the camera on the scene. Releasing the stick, changing view, opening a dialog or leaving the app stops movement.

Six missions cover a first walk, all six faculties, campus icons, three different shuttle shelters, two real panorama openings and an evening sports walk. Completing missions unlocks six original in-game badges and earns XP. Walking time advances only while the character changes position; selecting places in overview earns no arrival credit. Progress is saved on the current browser using `husseinverse-adventure-v1`, separately from older tour visits and map annotations. The journal includes objective guidance, destination markers, keyboard focus handling and a confirmed progress reset.

The circular map at the top right uses the same campus outline, roads, buildings and curved ponds as the scene. In walking mode it follows the student, rotates with the camera and shows the current mission destination. Clicking it opens the full 2D correction map. Its cached drawing avoids rebuilding campus geometry every frame. The map does not assert a surveyed north bearing.

Wide views now ease exposure and specular highlights rather than washing the campus in pale glare. Haze starts behind the campus as the camera moves farther away, and distant water ripples fade below pixel size. A physical plaque reading **developed by seladevs.my** is fitted to the thick southern ground wall.

The production build and 68 checks pass. The page, mission interface, touch controls and minimap are present in the local preview at `http://127.0.0.1:4173/`. Live browser interaction remains unverified because browser access reports disabled; the character was also checked in generated front/back geometry previews.

## Project structure

- `app/`: Next.js App Router page, metadata and global styles.
- `components/CampusPlan2D.jsx`: campus annotation canvas and local mark saving.
- `components/CampusMissions.jsx` and `lib/game-progress.js`: adventure journal, tasks, saved progress and badges.
- `components/CampusJoystick.jsx`: proportional touch movement for phones and tablets.
- `components/CampusMinimap.jsx`: circular cached map, player heading and mission destination.
- `lib/models/character.js`: articulated student model and animation.
- `lib/view-lighting.js`: distance-aware lighting, haze and highlight control.
- `lib/ground-credit.js`: the development credit attached to the ground wall.
- `lib/site-layout.js`: shared detailed-model footprints and clearances.
- `lib/planting.js`: deliberate tree placement, pink blossoms and petal effects.
- `lib/water-boundaries.js`: rounded, gently wavy pond outlines.
- `lib/road-layout.js`: junction-aware curbs and lamp clearances.
- `lib/campus-boundary.js`: shared softened campus cutout and land limits.
- `lib/placement-audit.js`: full-width road checks against buildings and natural water outlines.
- `lib/environment-materials.js`: original terrain and animated pond shaders.
- `lib/bus-stops.js`: sourced Katsana markers and approximate road placements.
- `lib/models/bus-stop.js` and `lib/campus-transit.js`: shared shelter geometry and campus placement.
- `components/CampusExplorer.jsx`: React interface and client-only scene lifecycle.
- `lib/campus.js`: Three.js scene, landmark data, controls, tour state and navigation tools.
- `lib/faculty-data.js`: map-linked faculty identities, architecture palettes and navigation positions.
- `lib/models/landmarks.js`: detailed library, mosque, hall, pool and stadium geometry.
- `lib/models/faculties.js`: distinct faculty facades, towers, pitched courtyard roofs and roof services.
- `lib/models/fsktm.js`: original FSKTM exterior reconstructed from the supplied plans and photographs.
- `lib/campus-layout.js`: source-map coordinates, footprint traces, roads, ponds and landmark placements.
- `lib/mapped-campus.js`: rendering of the traced campus surroundings.
- `lib/navigation.js`: rotated and polygonal collision boundaries, including courtyards.
- `public/assets/reffsktm/` and its `directory/` subfolder: user-supplied reference images, preserved unchanged.
- `public/icon.svg`: project icon.
- `scripts/serve.mjs`: local server for the built static export.
- `.openai/hosting.json`: optional private Sites deployment identity; no credentials.

Three.js is loaded from the pinned npm dependency, not a remote script. React and Next.js own the page and client lifecycle. The scene is imported after mounting and disposes its renderer and listeners on unmount.

## What the references use

[Messenger's developer interview](https://www.commarts.com/webpicks/messenger) identifies Blender and Houdini for modeling, Three.js for the frontend, and custom controls, shaders, camera and networking. [Jalan KL](https://kl.jalanmalaysia.com/) describes original Blender models and a single-player world; its public renderer bundle also identifies Three.js.

There is no verified evidence that either reference used Blender MCP. MCP can automate Blender asset creation; it is not the runtime that runs these games in a browser. No Blender MCP connection was available during this build. No source code or models were copied from either reference.

## Path to a faithful campus reconstruction

1. Obtain an up-to-date campus plan and authorized ground-level photographs for each elevation of the priority buildings. The 2023 map is a useful reference, not a current survey.
2. Build original Blender models of PTTA, the mosque, DSI and the main entrance from those references. Match footprints and proportions before adding facade detail.
3. Export optimized GLB assets, with lightweight collision meshes and distance-based detail. Replace the corresponding procedural landmark functions without changing the tour interface.
4. Check walkable routes against campus paths and validate scale and landmarks with UTHM students or staff.
5. For a seamless realistic tour, obtain permission and source files for UTHM's panoramas or produce original 360° captures. That allows a first-party panorama viewer without relying on an external iframe.

## Factual and visual sources

- [UTHM International Office — Iconic Buildings & Facilities and embedded 360° scenes](https://io.uthm.edu.my/more-info/uthm-virtual-tour?catid=17&id=112&view=article)
- [International Student Guide, January 2023 — campus map on PDF page 4](https://io.uthm.edu.my/images/Guideline%20Book/091122-a-guide-book-for-international-student-io.pdf#page=4)
- [PTTA library history](https://ptta.uthm.edu.my/about-us/corporate-info/history.html)
- [Dewan Sultan Ibrahim — convocation location](https://convocation.uthm.edu.my/ms/istiadat/lokasi)
- [Masjid Sultan Ibrahim profile](https://pi.uthm.edu.my/tentang-kami/sejarah-penubuhan-pusat-islam-dan-masjid-sultan-ibrahim/profail-masjid-sultan-ibrahim-uthm)
- [UTHM Sports Centre facilities](https://sukan.uthm.edu.my/index.php/facilities-and-services)
- [Official mosque photograph used as modeling reference](https://pi.uthm.edu.my/images/Masjid/Masjid%20view%20sebelah%20kanan.jpg)
- [Official library photograph used as modeling reference](https://io.uthm.edu.my/media/yootheme/cache/f1/ptta%20banner-f1ef9fc6.png)
- [UTHM second campus aerial panorama — FSKTM hotspot visually confirmed](https://momento360.com/e/u/350dd70abf1a47ccbe278d5ad0787a5d?field-of-view=75&heading=-28.73&pitch=-15.7&utm_campaign=embed&utm_source=other)
- [Discovery Awaits: Unveiling UTHM — FSKTM aerial photograph, page 79](https://korporat.uthm.edu.my/images/penerbitan/Discovery%20Awaits%20Unveiling%20UTHM.pdf#page=79)
- [Wikimedia Commons: UTHM FSKTM.jpg — front photograph authored by UTHM, dated 28 November 2011](https://commons.wikimedia.org/wiki/File:UTHM_FSKTM.jpg). The file page credits UTHM Photo Gallery and specifies [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/); used as a visual modeling reference.

Original code and original scene geometry are included in this repository. External panoramas, linked university materials, fonts and npm packages retain their respective owners' rights and licenses. Their availability online does not transfer ownership to this project.

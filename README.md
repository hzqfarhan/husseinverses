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

- Seven destinations: PTTA library, Dewan Sultan Ibrahim, Masjid Sultan Ibrahim, FSKTM (Faculty of Computer Science and Information Technology), swimming centre, stadium, and an aerial campus view.
- Rebuilt FSKTM with an eight-level central tower, four-level wings, the angled left SMC@FSKTM wing, and the straight right wing.
- Campus building outlines, positions and orientations traced from the official map, with major roads and ponds. An overhead camera control makes footprints easy to inspect.
- Orbiting campus view, smooth camera transitions, zoom, daylight/evening lighting, and selectable landmark markers.
- Third-person walking using WASD, arrow keys or on-screen controls. Shift runs; V changes view. Drag turns the camera.
- Building collision boundaries and checked arrival points.
- Real 360° tour navigation using the exact panorama identifiers published by UTHM's International Office.
- Browser-local visit progress, responsive controls, keyboard focus, and modal help.
- Optional feature-detected WebMCP navigation tools that share the visible interface's actions.

## Accuracy and current limits

This is an **independent prototype, not an official UTHM service or a surveyed digital twin**. The layout uses 190 footprint components traced from the January 2023 official campus map; these are map components, not a verified count of separate buildings. Detailed landmark models replace their corresponding traced shapes. Other buildings retain the map's outlines and angles but use estimated heights and simplified facades. Major roads and ponds follow the schematic map; landscaping is illustrative. The map is not a current survey and has no verified north bearing. The compass indicates camera rotation. Building interiors and concealed elevations are not reconstructed.

The real panorama media remain hosted by Momento360 and are credited to UTHM's published tour. The top-level library panorama was visually verified. Embedded panoramas did not render inside the development app's in-app browser, so every tour stop includes **Open full view** as a direct alternative and a delayed-loading message. External media availability depends on that provider and the visitor's browser. This implementation does not download or rehost the panorama files.

The seven-destination scene, FSKTM selection, overhead view, walking arrival and production build were checked. Every arrival position is validated against collision bounds during initialization. Run `npm test` for checks covering rotated wings, concave footprints and open courtyards. Phone-specific styles are included, but the available browser's viewport override did not take effect, so phone rendering needs a real-device check.

## FSKTM reference and refinement

The original model in `lib/models/fsktm.js` follows the supplied `public/assets/directory` floor plans and `public/assets/reffsktm` photographs. The directory shows Ground through Seventh in the central tower and Ground through Third in both wings. The right wing continues straight across the tower junction; the left wing turns forward by approximately 35 degrees. That angle is estimated from the photographed plans, not a measured survey. These newer references take precedence over the campus map's simplified block P outline.

The two wings have different facades. The left uses long corridor window bands, piers, a tall louvred panel and blue SMC@FSKTM lettering with a red @. The right uses grouped window bays, contrasting vertical panels and rooftop solar arrays. The tower includes rounded front corners, green window columns, projecting shades and a recessed entrance. Roof overhangs, parking and a shaded forecourt complete the exterior. Dimensions, concealed connections, rear elevations and landscaping remain approximate.

The supplied photographs were also compared with the UTHM-authored front photograph and the aerial photograph on page 79 of _Discovery Awaits: Unveiling UTHM_. The references document different views and dates; they do not establish every detail of the building's current condition.

FSKTM's photographic tour reference is UTHM's second campus aerial panorama, `350dd70abf1a47ccbe278d5ad0787a5d`. Its FSKTM hotspot was visually confirmed during reference review. The button is labeled **View aerial · 360°** because this is an aerial campus reference, not a dedicated ground-level FSKTM panorama.

## Project structure

- `app/`: Next.js App Router page, metadata and global styles.
- `components/CampusExplorer.jsx`: React interface and client-only scene lifecycle.
- `lib/campus.js`: Three.js scene, landmark data, controls, tour state and navigation tools.
- `lib/models/fsktm.js`: original FSKTM exterior reconstructed from the supplied plans and photographs.
- `lib/campus-layout.js`: source-map coordinates, footprint traces, roads, ponds and landmark placements.
- `lib/mapped-campus.js`: rendering of the traced campus surroundings.
- `lib/navigation.js`: rotated and polygonal collision boundaries, including courtyards.
- `public/assets/directory/` and `public/assets/reffsktm/`: user-supplied reference images, preserved unchanged.
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

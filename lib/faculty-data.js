import { mapToWorld } from "./campus-layout.js";

// Block identities were read visually from the published campus-map legend.
// Facade treatments and heights are exterior interpretations, not survey data.
export const FACULTIES = [
  {
    id: "fptp", short: "FPTP", name: "Faculty of Technology Management and Business",
    sourceCodes: ["J"], primaryFootprint: "map-019", modelHeight: 27, pixel: [1048.3, 667.8], entryPixel: [1077, 713],
    source: "https://fptp.uthm.edu.my/", accent: "#786789",
    description: "Explore the technology management and business faculty, with its purple tower, screened glazing, shaded teaching wings and an open roof frame.",
    architecture: "purple-screened-academic",
    references: [
      { url: "https://amo.uthm.edu.my/images/Gambar%20Website/6-01.png", supports: "Purple tower, horizontal facade screen, three-storey teaching wings and white open roof frame; photograph visually inspected." },
      { url: "https://ftmb.uthm.edu.my/index.php/fptpprogramme/fptppostgraduate", supports: "Faculty entrance photograph and identity." },
    ],
    style: { wall: "#e4e2df", trim: "#f1eee6", accent: "#786789", glass: "#344d62", roof: "#85868b", fins: "horizontal" },
  },
  {
    id: "fptv", short: "FPTV", name: "Faculty of Technical and Vocational Education",
    sourceCodes: ["K"], primaryFootprint: "map-005", modelHeight: 23, pixel: [1152, 550], entryPixel: [1189, 605],
    source: "https://fptv.uthm.edu.my/", accent: "#527ca0",
    description: "Visit the technical and vocational education faculty: blue vertical panels, projecting sunshades and connected academic wings.",
    style: { wall: "#e5e8e7", trim: "#f6f5ed", accent: "#527ca0", glass: "#315663", roof: "#8c979a", fins: "vertical" },
    architecture: "blue-panel-academic",
    references: [{ url: "https://fptv.uthm.edu.my/images/gmbr_fakulti.jpg", supports: "Six visible floor rows, blue panel stacks, grey spandrels, individual metal sunshades and open rooftop canopy; photograph visually inspected." }],
  },
  {
    id: "fkaab", short: "FKAAB", name: "Faculty of Civil Engineering and Built Environment",
    sourceCodes: ["M"], primaryFootprint: "map-006", modelHeight: 31, pixel: [1252.1, 517.3], entryPixel: [1308, 603],
    source: "https://fkaab.uthm.edu.my/", accent: "#8d9f64",
    description: "Discover the civil engineering and built environment faculty, with white walls, pale green entrance panels, shaded glazing and its long academic footprint.",
    style: { wall: "#e9ece4", trim: "#f5f3e8", accent: "#8d9f64", glass: "#435b54", roof: "#92998f", fins: "horizontal" },
    architecture: "olive-shaded-academic",
    references: [
      { url: "https://io.uthm.edu.my/images/Faculty/FKAAB.jpg", supports: "White and pale green entrance lobby, broad projecting canopy, upper louvres and olive tower panels; photograph visually inspected." },
      { url: "https://architecture.uthm.edu.my/", supports: "Current faculty name and historical FKAAS building photograph." },
    ],
  },
  {
    id: "fkee", short: "FKEE", name: "Faculty of Electrical and Electronic Engineering",
    sourceCodes: ["QA", "QB", "G1", "F1"], primaryFootprint: "map-022", modelHeight: 13, pixel: [1395.1, 715.4], entryPixel: [1405, 747],
    source: "https://fkee.uthm.edu.my/", accent: "#cfb45b",
    description: "Explore electrical and electronic engineering at blocks QA and QB, and the G1 laboratory complex across the campus.",
    style: { wall: "#e5e7e2", trim: "#f1f0e7", accent: "#cfb45b", glass: "#345957", roof: "#85948e", fins: "horizontal" },
    architecture: "yellow-laboratory-academic",
    references: [
      { url: "https://fkee.uthm.edu.my/images/2025/AboutUs25/IMG_5342.jpg", supports: "Yellow stair tower, alternating yellow and grey facade bays, green glazing and bowed metal roof; photograph visually inspected." },
      { url: "https://fkee.uthm.edu.my/images/2025/AboutUs25/IMG_6005.jpg", supports: "Low teaching wings, corrugated fascias and service louvres; photograph visually inspected." },
      { url: "https://news.uthm.edu.my/ms/2025/03/projek-sulung-ubah-suai-bilik-kuliah-fkee-beri-suasana-pdp-lebih-kondusif/", supports: "QA has seven floors and 217 rooms; QB has 22 rooms. QA teaching rooms are shared by FKEE, FKMP and FPTP." },
    ],
  },
  {
    id: "fkmp", short: "FKMP", name: "Faculty of Mechanical and Manufacturing Engineering",
    sourceCodes: ["G2"], primaryFootprint: "map-044", modelHeight: 14, pixel: [1642.4, 927.8], entryPixel: [1642, 1000],
    source: "https://fkmp.uthm.edu.my/", accent: "#aa7966",
    description: "Visit the G2 mechanical and manufacturing laboratory complex, with its open central courtyard, workshop glazing and shaded façades.",
    style: { wall: "#e1e3de", trim: "#f2f0e6", accent: "#aa7966", glass: "#3b5f62", roof: "#8b9896", fins: "horizontal" },
    architecture: "pitched-roof-workshop",
    references: [
      { url: "https://link.springer.com/article/10.1007/s42452-024-06007-9", supports: "UTHM-authored 2024 rooftop PV study, Figure 5 satellite plan: G2 and G1 retain red pitched wing roofs and open central courts; figure visually inspected." },
      { url: "https://periodical.uthm.edu.my/index.php/rpmme/article/view/20878", supports: "Block G2 is a mechanical and manufacturing faculty facility." },
      { url: "https://ppp.uthm.edu.my/images/Galeri/fakulti/IMG-20231107-WA0080.jpg", supports: "Older faculty office has brick-red roofs and pale green piers; visually inspected. This is a separate office elevation, not proof of the G2 facade." },
    ],
  },
].map((faculty) => ({ ...faculty, position: mapToWorld(faculty.pixel), entry: mapToWorld(faculty.entryPixel),
  accuracy: "Reference-informed original exterior. Footprints follow the source campus map; unsurveyed dimensions, concealed elevations and service placements remain approximate.",
}));

export function facultyForFootprint(footprint) {
  return FACULTIES.find((faculty) => faculty.sourceCodes.includes(footprint.sourceCode));
}

/** Modeling choices remain explicit rather than implying surveyed dimensions. */
export function facultyBuildingProfile(footprint) {
  const faculty = facultyForFootprint(footprint);
  if (!faculty) return null;
  let height = footprint.height, floors = Math.max(1, Math.round(height / 3.65));
  if (footprint.id === "map-005") { height = 22.2; floors = 6; }
  else if (footprint.sourceCode === "M") { height = 18.5; floors = 3; }
  else if (footprint.sourceCode === "J") { height = 14.8; floors = 3; }
  else if (footprint.sourceCode === "QA") { height = 11.9; floors = 7; }
  else if (footprint.sourceCode === "QB") floors = 3;
  const pitched = ["G1", "G2", "F1"].includes(footprint.sourceCode);
  return { faculty, style: faculty.style, height, floors, floorHeight: height / floors,
    tower: footprint.sourceCode === "J" ? { x:-20.3,z:-116.16,width:6.5,depth:11,height:25.9,floors:7 }
      : footprint.sourceCode === "M" ? { x:47.78,z:-157.46,width:10,depth:11,height:29.6,floors:8 } : null,
    roofType: pitched ? "red-hipped-wings" : faculty.id === "fptp" || faculty.id === "fptv" ? "screened-flat" : "shallow-metal",
    floorCountEvidence: footprint.sourceCode === "QA" ? "Official UTHM article explicitly states seven floors."
      : footprint.id === "map-005" ? "Six floor rows visible in official FPTV photograph."
      : footprint.sourceCode === "J" ? "Three wing floor rows visible in official FPTP photograph; central tower is separate."
      : "Estimated exterior modeling count; not independently surveyed.",
  };
}

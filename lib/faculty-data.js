import { mapToWorld } from "./campus-layout.js";

// Block identities were read visually from the published campus-map legend.
// Facade treatments and heights are exterior interpretations, not survey data.
export const FACULTIES = [
  {
    id: "fptp", short: "FPTP", name: "Faculty of Technology Management and Business",
    sourceCodes: ["J"], primaryFootprint: "map-019", modelHeight: 27, pixel: [1048.3, 667.8], entryPixel: [1077, 713],
    source: "https://fptp.uthm.edu.my/", accent: "#786789",
    description: "Explore the technology management and business faculty, with its purple-accented tower, shaded teaching wings and recessed windows.",
    style: { wall: "#e4e2df", trim: "#f1eee6", accent: "#786789", glass: "#344d62", roof: "#85868b", fins: "horizontal" },
  },
  {
    id: "fptv", short: "FPTV", name: "Faculty of Technical and Vocational Education",
    sourceCodes: ["K"], primaryFootprint: "map-005", modelHeight: 23, pixel: [1152, 550], entryPixel: [1189, 605],
    source: "https://fptv.uthm.edu.my/", accent: "#527ca0",
    description: "Visit the technical and vocational education faculty: blue vertical panels, projecting sunshades and connected academic wings.",
    style: { wall: "#e5e8e7", trim: "#f6f5ed", accent: "#527ca0", glass: "#315663", roof: "#8c979a", fins: "vertical" },
  },
  {
    id: "fkaab", short: "FKAAB", name: "Faculty of Civil Engineering and Built Environment",
    sourceCodes: ["M"], primaryFootprint: "map-006", modelHeight: 31, pixel: [1252.1, 517.3], entryPixel: [1308, 603],
    source: "https://fkaab.uthm.edu.my/", accent: "#c5aa55",
    description: "Discover the civil engineering and built environment faculty, with yellow-accented elevations, deep window bays and its long academic footprint.",
    style: { wall: "#e5e6de", trim: "#f5f3e8", accent: "#c5aa55", glass: "#435b54", roof: "#92998f", fins: "vertical" },
  },
  {
    id: "fkee", short: "FKEE", name: "Faculty of Electrical and Electronic Engineering",
    sourceCodes: ["QA", "QB", "G1", "F1"], primaryFootprint: "map-022", modelHeight: 13, pixel: [1395.1, 715.4], entryPixel: [1405, 747],
    source: "https://fkee.uthm.edu.my/", accent: "#cfb45b",
    description: "Explore electrical and electronic engineering at blocks QA and QB, and the G1 laboratory complex across the campus.",
    style: { wall: "#e5e7e2", trim: "#f1f0e7", accent: "#cfb45b", glass: "#345957", roof: "#85948e", fins: "horizontal" },
  },
  {
    id: "fkmp", short: "FKMP", name: "Faculty of Mechanical and Manufacturing Engineering",
    sourceCodes: ["G2"], primaryFootprint: "map-044", modelHeight: 14, pixel: [1642.4, 927.8], entryPixel: [1642, 1000],
    source: "https://fkmp.uthm.edu.my/", accent: "#aa7966",
    description: "Visit the G2 mechanical and manufacturing laboratory complex, with its open central courtyard, workshop glazing and shaded façades.",
    style: { wall: "#e1e3de", trim: "#f2f0e6", accent: "#aa7966", glass: "#3b5f62", roof: "#8b9896", fins: "horizontal" },
  },
].map((faculty) => ({ ...faculty, position: mapToWorld(faculty.pixel), entry: mapToWorld(faculty.entryPixel) }));

export function facultyForFootprint(footprint) {
  return FACULTIES.find((faculty) => faculty.sourceCodes.includes(footprint.sourceCode));
}

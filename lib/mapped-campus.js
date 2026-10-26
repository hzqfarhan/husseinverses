import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { BUILDING_FOOTPRINTS, CAMPUS_ROADS, CAMPUS_PONDS, MAP_BOUNDS, MAP_SCALE, mapToWorld } from "./campus-layout.js";
import { polygonBoundary, rectangleBoundary, containsPoint } from "./navigation.js";
import { facultyForFootprint } from "./faculty-data.js";
import { createEnvironmentMaterials, ENVIRONMENT_COLORS } from "./environment-materials.js";
import { planCampusPlanting, createCampusTrees } from "./planting.js";
import { computeRoadFurniture } from "./road-layout.js";
import { getPondOutline } from "./water-boundaries.js";

const FRAME = "#475a59", CONCRETE = "#c8cdc3", STEEL = "#7b8988";
const DEFAULT = { wall: "#e2e4d9", trim: "#f0f0e5", accent: "#939f90", glass: "#466b69", roof: "#8c9d97", fins: "horizontal" };

// All repeated architecture is instanced by material; richer geometry keeps a
// small draw-call budget instead of creating one render object for every bay.
export function buildMappedCampus({ scene, material, collisions, plantingExclusions = [] }) {
  const root = new THREE.Group(); root.name = "Detailed campus architecture";
  const environment = createEnvironmentMaterials();
  const renderMaterial = color => environment.materials[color] || material(color);
  const batches = new Map(), instances = new Map(), roundedInstances = new Map();
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scale = new THREE.Vector3();
  const statistics = { buildings: 0, facadeBays: 0, facultyBuildings: 0, roofDetails: 0 };
  function add(geometry, color, shadow = true) {
    let g = geometry;
    if (g.index) { g = geometry.toNonIndexed(); geometry.dispose(); }
    for (const key of Object.keys(g.attributes)) if (!["position", "normal"].includes(key)) g.deleteAttribute(key);
    if (!g.attributes.normal) g.computeVertexNormals();
    const key = `${color}:${shadow}`;
    if (!batches.has(key)) batches.set(key, { color, shadow, parts: [] });
    batches.get(key).parts.push(g);
  }
  function box(x, y, z, w, h, d, color, angle = 0, rounded = false, shadow = true) {
    if (w <= 0 || h <= 0 || d <= 0) return;
    const bank = rounded ? roundedInstances : instances, key = `${color}:${shadow}`;
    if (!bank.has(key)) bank.set(key, { color, shadow, matrices: [] });
    quaternion.setFromAxisAngle(axis, angle);
    matrix.compose(pos.set(x, y, z), quaternion, scale.set(w, h, d));
    bank.get(key).matrices.push(matrix.clone());
  }
  function shape(points, holes = []) {
    const s = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const ring of holes) s.holes.push(new THREE.Path(ring.map(([x, z]) => new THREE.Vector2(x, -z))));
    return s;
  }
  function surface(points, color, y, holes = []) {
    const g = new THREE.ShapeGeometry(shape(points, holes));
    g.rotateX(-Math.PI / 2); g.translate(0, y, 0); add(g, color, false);
  }
  function solid(points, color, y, h, holes = []) {
    const g = new THREE.ExtrudeGeometry(shape(points, holes), { depth: h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, y, 0); add(g, color);
  }
  function cylinder(x, y, z, top, bottom, h, color, sides = 24) {
    const g = new THREE.CylinderGeometry(top, bottom, h, sides); g.translate(x, y, z); add(g, color);
  }
  function sign(text, x, y, z, width, angle, color) {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext("2d");
    context.fillStyle = "#f3f1e8"; context.fillRect(0, 0, 512, 128);
    context.fillStyle = color; context.font = "700 78px Arial";
    context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(text, 256, 68, 470);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    mesh.position.set(x, y, z); mesh.rotation.y = angle; root.add(mesh);
  }
  const [minX, minZ] = mapToWorld([MAP_BOUNDS.minX, MAP_BOUNDS.minY]);
  const [maxX, maxZ] = mapToWorld([MAP_BOUNDS.maxX, MAP_BOUNDS.maxY]);
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  box(cx, -4.4, cz, maxX - minX + 28, 8, maxZ - minZ + 28, "#95af79");
  box(cx, -10, cz, 2200, 3, 2200, "#c4dce1");
  // A continuous grass surface has real pond openings. Water sits just below
  // the lawn instead of floating on an unbroken green ground plane.
  surface([[minX-14,minZ-14],[maxX+14,minZ-14],[maxX+14,maxZ+14],[minX-14,maxZ+14]],
    ENVIRONMENT_COLORS.grass,-.018,CAMPUS_PONDS.map(getPondOutline));
  const furniture = computeRoadFurniture({ shelterExclusions: plantingExclusions });
  for (const segment of furniture.segments) {
    const {ax,az,bx,bz,width,length,angle} = segment;
    box((ax+bx)/2,-.13,(az+bz)/2,width+1.4,.24,length+.6,"#cbd0bb",angle);
    box((ax+bx)/2,.02,(az+bz)/2,width,.1,length+.7,"#7d8885",angle);
    if(width>4) for(let d=2;d<length-1;d+=6)
      box(ax+(bx-ax)*d/length,.08,az+(bz-az)*d/length,.13,.018,2.4,"#e4e3ce",angle,false,false);
  }
  for (const joint of furniture.joints) cylinder(joint.x,.02,joint.z,joint.radius,joint.radius,.1,"#7d8885",48);
  for (const curb of furniture.curbs) box(curb.x,.08,curb.z,curb.width,.24,curb.depth,CONCRETE,curb.angle);
  for (const lamp of furniture.lamps) {
    cylinder(lamp.x,2.8,lamp.z,.055,.11,5.6,STEEL,16);
    box((lamp.x+lamp.headX)/2,5.58,(lamp.z+lamp.headZ)/2,.16,.12,.9,STEEL,lamp.angle);
    box(lamp.headX,5.52,lamp.headZ,.3,.09,.55,"#ece8d1",lamp.angle,true);
  }
  const lampClearances = furniture.lamps.map(lamp=>rectangleBoundary(lamp.x,lamp.z,.4,.4,0,.75));
  const pondParts=[[],[]], pondMaterials=[];
  for (const pond of CAMPUS_PONDS) {
    const points = getPondOutline(pond);
    const pondModel=environment.createPond(points,pond.id);
    pondModel.children.forEach((mesh,index)=>{pondParts[index].push(mesh.geometry);pondMaterials[index]=mesh.material;});
    collisions.push(polygonBoundary(points, .5));
  }
  pondParts.forEach((parts,index)=>{
    const object=new THREE.Mesh(mergeGeometries(parts),pondMaterials[index]);
    object.name=index===0?"Curved campus ponds with animated ripples":"Natural curved pond margins";
    object.receiveShadow=true;root.add(object);
  });
  function edges(ring, hole = false) {
    const area = ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0);
    return ring.map(([ax, az], i) => {
      const [bx, bz] = ring[(i + 1) % ring.length], length = Math.hypot(bx - ax, bz - az);
      const direction = (area > 0 ? -1 : 1) * (hole ? -1 : 1);
      return { ax, az, bx, bz, length, angle: -Math.atan2(bz - az, bx - ax), nx: -(bz - az) / length * direction, nz: (bx - ax) / length * direction };
    }).filter(e => e.length > .3);
  }
  function edgeBox(edge, along, y, outward, w, h, d, color, rounded = false) {
    const t = along / edge.length;
    box(edge.ax + (edge.bx - edge.ax) * t + edge.nx * outward, y, edge.az + (edge.bz - edge.az) * t + edge.nz * outward, w, h, d, color, edge.angle, rounded);
  }
  function facades(ring, holes, height, floors, style, isFaculty) {
    const floorHeight = height / floors, exterior = edges(ring);
    for (const edge of [...exterior, ...holes.flatMap(hole => edges(hole, true))]) {
      const len = edge.length;
      edgeBox(edge, len / 2, .35, .035, len, .7, .13, CONCRETE);
      edgeBox(edge, len / 2, height + .32, .025, len + .06, .64, .23, style.trim);
      edgeBox(edge, len / 2, height + .67, .045, len + .13, .1, .39, STEEL);
      edgeBox(edge, len / 2, height - .2, .16, len + .08, .22, .49, style.trim);
      if (len < 1.8) continue;
      const count = Math.max(1, Math.floor((len - .45) / (isFaculty ? 2.55 : 2.9)));
      const spacing = (len - .5) / count, paneWidth = Math.max(.65, Math.min(spacing - .42, 2.1));
      for (let level = 1; level < floors; level++) edgeBox(edge, len / 2, level * floorHeight, .085, len, .19, .28, style.trim);
      for (let bay = 0; bay < count; bay++) {
        const along = .25 + (bay + .5) * spacing;
        if (isFaculty && bay % 4 === 0) edgeBox(edge, along - spacing * .43, height / 2, .08, .27, height - .6, .28, style.accent);
        for (let level = 0; level < floors; level++) {
          const y = (level + .53) * floorHeight, paneHeight = Math.min(1.95, floorHeight * .52);
          edgeBox(edge, along, y, .08, paneWidth + .2, paneHeight + .21, .18, FRAME);
          edgeBox(edge, along, y, .185, paneWidth, paneHeight, .07, (bay + level) % 5 === 0 ? "#66847f" : style.glass);
          edgeBox(edge, along, y, .24, .055, paneHeight, .07, style.trim);
          edgeBox(edge, along, y + paneHeight * .23, .24, paneWidth, .055, .07, style.trim);
          edgeBox(edge, along, y - paneHeight / 2 - .13, .23, paneWidth + .27, .14, .4, style.trim);
          edgeBox(edge, along, y + paneHeight / 2 + .22, .32, paneWidth + .42, .14, .8, style.trim);
          if (isFaculty && style.fins === "vertical") for (const side of [-1, 1]) edgeBox(edge, along + side * (paneWidth / 2 + .18), y + .1, .31, .1, paneHeight + .45, .58, style.accent);
          statistics.facadeBays++;
        }
      }
    }
    return exterior;
  }
  const seenFacultySigns = new Set();
  for (const footprint of BUILDING_FOOTPRINTS) {
    if (footprint.excludeLandmark) continue;
    const points = footprint.pixels.map(mapToWorld), holes = footprint.holes.map(ring => ring.map(mapToWorld));
    const faculty = facultyForFootprint(footprint), residential = ["G4", "G5", "G6"].includes(footprint.sourceCode);
    const style = faculty?.style || (residential ? { ...DEFAULT, accent: "#b79b80", wall: "#e7e0ce", roof: "#9c8e7c" } : DEFAULT);
    // Heights outside FSKTM remain estimates, with taller principal faculty blocks.
    let height = footprint.height;
    if (footprint.id === "map-005") height = 22.2;
    else if (footprint.sourceCode === "M") height = 18.5;
    else if (footprint.sourceCode === "J") height = 14.8;
    const floors = Math.max(1, Math.round(height / 3.65));
    solid(points, style.wall, 0, height, holes); surface(points, style.roof, height + .035, holes);
    collisions.push(polygonBoundary(points, .9, holes));
    const outline = facades(points, holes, height, floors, style, !!faculty);
    statistics.buildings++; if (faculty) statistics.facultyBuildings++;
    const boundary = polygonBoundary(points, 0, holes), [bcx, bcz] = mapToWorld(footprint.center);
    const [px0,pz0,px1,pz1] = footprint.bounds, [x0,z0] = mapToWorld([px0,pz0]), [x1,z1] = mapToWorld([px1,pz1]);
    let roofUnits = 0;
    for (let x=x0+2; x<x1-1.4; x+=faculty?4.7:6.2) for (let z=z0+2; z<z1-1.4; z+=5.8) {
      if (roofUnits >= (faculty?12:4)) break;
      if (![[x-1,z-1],[x+1,z-1],[x+1,z+1],[x-1,z+1]].every(([rx,rz])=>containsPoint(boundary,rx,rz))) continue;
      if ((roofUnits + Number(footprint.id.slice(-3))) % 3 === 0) {
        box(x,height+.55,z,1.65,.8,1.3,"#b8c1bc",0,true);
        for(let slat=0;slat<5;slat++) box(x,height+.35+slat*.1,z+.68,1.4,.035,.06,STEEL);
        cylinder(x,height+.98,z,.42,.42,.1,STEEL,24); cylinder(x,height+1.04,z,.27,.27,.03,FRAME,24);
      } else {
        box(x,height+.33,z,2.1,.14,2.5,FRAME,0,true); box(x,height+.42,z,1.98,.08,2.36,"#2f4758");
        for(const dx of [-.65,0,.65])box(x+dx,height+.47,z,.025,.025,2.36,"#90a2a5");
        for(let dz=-.9;dz<1;dz+=.6)box(x,height+.47,z+dz,1.98,.025,.025,"#90a2a5");
      }
      roofUnits++;statistics.roofDetails++;
    }
    const front = outline.filter(e=>e.length>4).sort((a,b)=>{
      const score=e=>e.length+(e.nx*(cx-bcx)+e.nz*(cz-bcz))*.025;return score(b)-score(a);
    })[0];
    if (front && footprint.areaPixels>500) {
      const width=Math.min(front.length-.7,faculty?6.4:3.7), middle=front.length/2;
      edgeBox(front,middle,1.45,.2,width*.6,2.65,.14,FRAME);edgeBox(front,middle,1.45,.29,width*.54,2.4,.08,style.glass);
      edgeBox(front,middle,1.45,.35,.07,2.4,.07,style.trim);edgeBox(front,middle,3.15,.95,width,.22,2.2,style.accent,true);
      edgeBox(front,middle,3.02,.95,width-.2,.06,2,style.trim);
      for(const side of [-1,1])edgeBox(front,middle+side*width*.42,2.75,.45,.14,.75,.55,STEEL);
      for(let step=0;step<3;step++)edgeBox(front,middle,.07+step*.065,.63-step*.12,width*.85,.14+step*.13,.45,CONCRETE);
      if (faculty&&footprint.id===faculty.primaryFootprint&&!seenFacultySigns.has(faculty.id)) {
        sign(faculty.short,(front.ax+front.bx)/2+front.nx*.24,height-.85,(front.az+front.bz)/2+front.nz*.24,Math.min(width,4.8),Math.atan2(front.nx,front.nz),faculty.accent);
        seenFacultySigns.add(faculty.id);
      }
    }
    if (faculty&&footprint.areaPixels>1600) {
      const site=[[bcx,bcz],[(x0+x1)/2,z0+3.1],[(x0+x1)/2,z1-3.1]].find(([x,z])=>[[x-1.1,z-1.1],[x+1.1,z-1.1],[x+1.1,z+1.1],[x-1.1,z+1.1]].every(([rx,rz])=>containsPoint(boundary,rx,rz)));
      if(site){const[x,z]=site;box(x,height+.9,z,2.2,1.8,2.2,style.accent,0,true);box(x,height+1.85,z,2.6,.18,2.6,style.trim,0,true);for(let dx=-.9;dx<=.9;dx+=.3)box(x+dx,height+.95,z+1.13,.08,1.25,.12,style.trim);}
    }
    // The principal FPTP and FKAAB slabs rise above their teaching wings.
    // Rectangles were fitted wholly inside their traced polygons, so courtyard
    // and walking boundaries remain exactly those of the source footprint.
    const tower = footprint.sourceCode === "J" ? [-20.3,-116.16,6.5,11,25.9]
      : footprint.sourceCode === "M" ? [47.78,-157.46,10,11,29.6] : null;
    if(tower){
      const[x,z,w,d,h]=tower;
      const ring=[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]];
      const fits=ring.every(([rx,rz])=>containsPoint(boundary,rx,rz));
      if(fits){
        const shell=new RoundedBoxGeometry(w,h,d,3,.2);shell.translate(x,h/2,z);add(shell,style.wall);
        facades(ring,[],h,Math.round(h/3.7),style,true);
        box(x,h+.6,z,w+1.2,.34,d+1.2,style.trim,0,true);
        box(x,h+.83,z,w+1.3,.14,d+1.3,style.roof,0,true);
        for(const side of[-1,1])box(x+side*(w/2-.45),h/2,z+d/2+.09,.46,h-.8,.26,style.accent);
        sign(faculty.short,x,h-1.2,z+d/2+.31,Math.min(w-1,5),0,faculty.accent);
      }
    }
  }
  // Deliberate avenue rows and small groves leave playing fields, entrance
  // corridors and courtyard views open. The complete canopy must fit each site.
  const planting=planCampusPlanting({boundaries:collisions,exclusions:[...plantingExclusions,...lampClearances]});
  const plantingAssets=createCampusTrees({trees:planting.trees,material});
  root.add(plantingAssets);
  const dummy=new THREE.Object3D();
  // Fine grass grows only on the same maintained verges as the planned trees.
  const tuftVertices=[];
  for(const angle of[0,Math.PI/3,Math.PI*2/3]){
    const c=Math.cos(angle),s=Math.sin(angle);
    const a=[-.065*c,0,-.065*s],b=[.065*c,0,.065*s];
    const d=[-.035*c+s*.04,.15,-.035*s+c*.04],e=[.035*c+s*.04,.15,.035*s+c*.04],tip=[s*.08,.32,c*.08];
    tuftVertices.push(...a,...b,...e,...a,...e,...d,...d,...e,...tip);
  }
  const tuftGeometry=new THREE.BufferGeometry();tuftGeometry.setAttribute("position",new THREE.Float32BufferAttribute(tuftVertices,3));tuftGeometry.computeVertexNormals();
  const tuftPositions=planting.tufts;
  const tufts=new THREE.InstancedMesh(tuftGeometry,renderMaterial(ENVIRONMENT_COLORS.grass),tuftPositions.length);tufts.name="Sparse fine grass tufts";tufts.receiveShadow=true;
  tuftPositions.forEach(({x,z,rotation,scale},i)=>{dummy.position.set(x,-.012,z);dummy.rotation.y=rotation;dummy.scale.setScalar(scale);dummy.updateMatrix();tufts.setMatrixAt(i,dummy.matrix);});
  root.add(tufts);
  for(const[bank,geometry]of[[instances,new THREE.BoxGeometry(1,1,1)],[roundedInstances,new RoundedBoxGeometry(1,1,1,2,.04)]])for(const{color,shadow,matrices}of bank.values()){
    const object=new THREE.InstancedMesh(geometry,renderMaterial(color),matrices.length);object.name=`Campus architectural details ${color}`;
    matrices.forEach((m,i)=>object.setMatrixAt(i,m));object.castShadow=shadow;object.receiveShadow=true;root.add(object);
  }
  for(const{color,shadow,parts}of batches.values()){
    const geometry=mergeGeometries(parts),object=new THREE.Mesh(geometry,renderMaterial(color));object.castShadow=shadow;object.receiveShadow=true;root.add(object);parts.forEach(g=>g.dispose());
  }
  root.userData.roadFurniture={lamps:furniture.lamps.length,curbs:furniture.curbs.length,junctions:furniture.junctions.length};
  root.userData.architecture=statistics;scene.add(root);
  root.userData.environment={ponds:CAMPUS_PONDS.length,grassTufts:tuftPositions.length,trees:planting.trees.length,worldSpaceTextures:true};
  root.userData.planting={trees:planting.trees,tufts:planting.tufts,minimumCrownGap:planting.minimumCrownGap};
  return{minX,maxX,minZ,maxZ,architecture:statistics,planting:planting.trees,
    updateEnvironment(seconds){environment.updateEnvironment(seconds);plantingAssets.userData.updatePlanting(seconds);},
    disposeEnvironment:environment.disposeEnvironment};
}

import * as THREE from "three";

// Original generated albedo assets. Texture loading enhances the procedural
// crown colors without blocking the campus or affecting planting clearances.
export function applyFoliageTextures(scene, { isDisposed = () => false } = {}) {
  const targets={green:new Set(),pink:new Set()},textures=[];
  scene.traverse(object=>{
    for(const material of [].concat(object.material||[]))
      if(material.userData.campusCanopy)targets[material.userData.campusBlossom?"pink":"green"].add(material);
  });
  let disposed=false;
  for(const [kind,file] of [["green","campus-foliage.png"],["pink","campus-blossoms.png"]]) {
    if(!targets[kind].size)continue;
    const texture=new THREE.TextureLoader().load(`/assets/textures/${file}`,loaded=>{
      if(disposed||isDisposed()){loaded.dispose();return;}
      loaded.colorSpace=THREE.SRGBColorSpace;
      loaded.wrapS=loaded.wrapT=THREE.RepeatWrapping;
      loaded.repeat.set(3,2);loaded.anisotropy=4;
      for(const material of targets[kind]) {
        material.map=loaded;material.color.set("#ffffff");
        // The albedo already supplies leaf/petal color variation; preserve
        // vertex normals for sunlight without multiplying the colors twice.
        material.vertexColors=false;material.needsUpdate=true;
      }
    });
    textures.push(texture);
  }
  return ()=>{disposed=true;textures.forEach(texture=>texture.dispose());};
}

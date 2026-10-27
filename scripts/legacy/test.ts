import * as BABYLON from "@babylonjs/core";
const mat = new BABYLON.PBRMaterial("test", null as any);
console.log(Object.keys(mat).filter(k => k.toLowerCase().includes("depth") || k.toLowerCase().includes("zoffset") || k.toLowerCase().includes("zwrite")));

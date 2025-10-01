// src/paths.js
import * as THREE from 'three';

// Build a smooth path between two anchors in the back plane Z=zBack
export function buildPath(fromVec3, toVec3, {bend=0.35, outlet=false, zBack=-0.02}){
  const p0=fromVec3.clone(); const p2=toVec3.clone();
  p0.z = p2.z = zBack;
  // control point to make a bezier-like wide curve (quadratic-ish via Catmull)
  const mid = new THREE.Vector3().addVectors(p0,p2).multiplyScalar(0.5);
  const dir = new THREE.Vector3().subVectors(p2,p0).normalize();
  const normal = new THREE.Vector3(-dir.y, dir.x, 0).normalize(); // rotate 90deg in XY
  const dist = p0.distanceTo(p2);
  const p1 = mid.clone().addScaledVector(normal, bend*dist);
  const curve = new THREE.CatmullRomCurve3([p0,p1,p2], false, 'catmullrom', 0.5);
  return curve;
}

export function sampleCurve(curve, segments=100){
  const pts=curve.getPoints(segments);
  const geom=new THREE.BufferGeometry().setFromPoints(pts);
  return {pts, geom};
}

export function makePathLine(curve, color=0x00ffff){
  const {geom}=sampleCurve(curve, 80);
  const mat=new THREE.LineBasicMaterial({color, transparent:true, opacity:.35});
  return new THREE.Line(geom, mat);
}

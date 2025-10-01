// src/anchors.js
import * as THREE from 'three';
import { OUTER_R } from './config.js';
import { hexFlatTop, segmentShift } from './geometry.js';

// Compute anchor points (2D in XY)
export function computeAnchors({ ratio, gap }, segGaps=[]){
  const outer = hexFlatTop(OUTER_R);
  const inner = hexFlatTop(OUTER_R * (ratio/100));
  const gapWorld = (gap/20);

  const trans = [];
  for(let i=0;i<6;i++){
    trans[i] = segmentShift(i, outer, inner, gapWorld, (segGaps[i]||0)/20);
  }

  // central ring anchors C0..C5
  const centers = [];
  for(let i=0;i<6;i++){
    const Ci = inner[i].clone();
    const Di = inner[i].clone().add(trans[i]);
    const Dj = inner[i].clone().add(trans[(i+5)%6]);
    const p = new THREE.Vector2( (Ci.x+Di.x+Dj.x)/3, (Ci.y+Di.y+Dj.y)/3 );
    centers.push(p);
  }

  // perimeter anchors P0..P5 (between segments around outer ring)
  const perims = [];
  for(let i=0;i<6;i++){
    const j=(i+1)%6;
    const V = outer[j];
    const Vi = V.clone().add(trans[i]);
    const Vj = V.clone().add(trans[j]);
    const p = new THREE.Vector2( (Vi.x+Vj.x)/2, (Vi.y+Vj.y)/2 );
    perims.push(p);
  }

  return { centers, perims, trans, outer, inner };
}

export function anchorsToList({centers, perims}){
  const list=[];
  centers.forEach((p,i)=> list.push({ id:`C${i}`, pos:new THREE.Vector3(p.x,p.y,0) }) );
  perims.forEach((p,i)=> list.push({ id:`P${i}`, pos:new THREE.Vector3(p.x,p.y,0) }) );
  return list;
}

// Visual helper (red plus + label)
export function makeAnchorMesh(size=0.06, color=0xff3040){
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([ -1,0,0, 1,0,0, 0,-1,0, 0,1,0 ]);
  g.setAttribute('position', new THREE.BufferAttribute(v,3));
  const m = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  const cross = new THREE.LineSegments(g,m);
  cross.scale.setScalar(size);
  return cross;
}

export function labelSprite(text, color="#ff3040"){
  const c = document.createElement('canvas'); const s=128; c.width=s; c.height=s;
  const ctx=c.getContext('2d'); ctx.clearRect(0,0,s,s);
  ctx.fillStyle=color; ctx.font='bold 48px system-ui,Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text, s/2, s/2);
  const tex=new THREE.CanvasTexture(c); tex.anisotropy=16;
  const mat=new THREE.SpriteMaterial({map:tex, transparent:true});
  const sp=new THREE.Sprite(mat); sp.scale.set(0.25,0.25,1); sp.position.set(0.12,0.12,0);
  return sp;
}

// src/geometry.js
import * as THREE from 'three';
import { OUTER_R } from './config.js';

const V2 = THREE.Vector2;

export function hexFlatTop(r){
  const pts=[];
  for(let i=0;i<6;i++){
    const a = i * Math.PI / 3; // 0 starts at +X axis -> flat-top
    pts.push(new V2(r*Math.cos(a), r*Math.sin(a)));
  }
  return pts;
}

export function inwardNormal(p, q, centroid){
  const e = new V2().subVectors(q,p);
  const n = new V2(-e.y, e.x).normalize();
  const mid = new V2().addVectors(p,q).multiplyScalar(.5);
  const toC = new V2().subVectors(centroid, mid);
  return (n.dot(toC) > 0) ? n : n.multiplyScalar(-1);
}

export function intersectLinesPD(p1,d1,p2,d2){
  const a=d1.x,b=-d2.x,c=d1.y,d=-d2.y;
  const det=a*d-b*c; if(Math.abs(det)<1e-8) return p1.clone();
  const rhsx=p2.x-p1.x, rhsy=p2.y-p1.y;
  const t=(rhsx*d-b*rhsy)/det;
  return new V2(p1.x + d1.x*t, p1.y + d1.y*t);
}

export function insetQuad(A,B,C,D,dist){
  const centroid = new V2((A.x+B.x+C.x+D.x)/4, (A.y+B.y+C.y+D.y)/4);
  const P=[A,B,C,D], lines=[];
  for(let i=0;i<4;i++){
    const p=P[i], q=P[(i+1)%4];
    const n=inwardNormal(p,q,centroid);
    const d=new V2(-n.y,n.x);
    const pShift=new V2().addVectors(p, n.clone().multiplyScalar(dist));
    lines.push({p:pShift,d});
  }
  return [
    intersectLinesPD(lines[3].p,lines[3].d,lines[0].p,lines[0].d),
    intersectLinesPD(lines[0].p,lines[0].d,lines[1].p,lines[1].d),
    intersectLinesPD(lines[1].p,lines[1].d,lines[2].p,lines[2].d),
    intersectLinesPD(lines[2].p,lines[2].d,lines[3].p,lines[3].d),
  ];
}

export function minEdgeLen(pts){
  let m=Infinity; for(let i=0;i<pts.length;i++){
    const a=pts[i], b=pts[(i+1)%pts.length];
    m=Math.min(m, a.distanceTo(b));
  } return m;
}

// segment translation (gap) vector
export function segmentShift(i, outer, inner, gapWorld, extraGap=0){
  const A=outer[i], B=outer[(i+1)%6], C=inner[(i+1)%6], D=inner[i];
  const cx=(A.x+B.x+C.x+D.x)/4, cy=(A.y+B.y+C.y+D.y)/4;
  const len = Math.hypot(cx,cy) || 1;
  const extra = gapWorld + (extraGap||0);
  return new V2((cx/len)*extra, (cy/len)*extra);
}

// Build segment mesh (rounded relief) - simplified
export function makeSegmentGeometry(A,B,C,D, rim, H, T, round=24){
  const ease = t => (1-Math.cos(Math.PI*t))*0.5;
  const verts=[]; const quad=(p1,p2,p3,p4,z)=>{
    const v=(p,z)=>[p.x,p.y,z]; const tri=(a,b,c)=>verts.push(...v(a,z),...v(b,z),...v(c,z));
    tri(p1,p2,p3); tri(p1,p3,p4);
  };
  const outer=[A,B,C,D]; let prev=outer, prevZ=0, poly=null;
  const maxInset=Math.min(A.distanceTo(B),B.distanceTo(C),C.distanceTo(D),D.distanceTo(A))*0.24;
  const s=Math.min(Math.max(rim,0),maxInset); const stepsH=Math.max(1,Math.floor(round));
  for(let k=1;k<=stepsH;k++){ const t=k/stepsH, zi=H*ease(t), si=s*t;
    poly=insetQuad(A,B,C,D,si); addBand(verts,prev,poly,prevZ,zi); prev=poly; prevZ=zi; }
  quad(poly[0],poly[1],poly[2],poly[3],prevZ);
  if (T>0){ const Zb=-T; quad(D,C,B,A,Zb); }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts,3)); geo.computeVertexNormals(); return geo;

  function addBand(verts,P,Q,z1,z2){
    const n=P.length; const v=(p,z)=>[p.x,p.y,z]; const tri=(p1,p2,p3)=>verts.push(...v(p1,z1),...v(p2,z1),...v(p3,z2));
    for(let i=0;i<n;i++){ const p1=P[i],p2=P[(i+1)%n]; const q1=Q[i], q2=Q[(i+1)%n];
      verts.push(...v(p1,z1),...v(p2,z1),...v(q2,z2)); verts.push(...v(p1,z1),...v(q2,z2),...v(q1,z2)); }
  }
}

// build whole hex assembly
export function buildHex({ratio,rim,relief,thick,gap,round, opacitys, color}, materialBuilder){
  const outer = hexFlatTop(OUTER_R);
  const inner = hexFlatTop(OUTER_R * (ratio/100));
  const H = relief/20, T=thick/20, rimW=rim/40, roundSteps=round;

  const group = new THREE.Group();
  const segMeshes=[];

  for(let i=0;i<6;i++){
    const A=outer[i],B=outer[(i+1)%6],C=inner[(i+1)%6],D=inner[i];
    const geo=makeSegmentGeometry(A,B,C,D,rimW,H,T,roundSteps);
    const mesh=new THREE.Mesh(geo, materialBuilder(opacitys[i]));
    const sh=segmentShift(i, outer, inner, gap/20, 0);
    mesh.position.set(sh.x, sh.y, 0);
    segMeshes.push(mesh); group.add(mesh);
  }

  // center
  const cx=0, cy=0; // center at origin
  const centerPts = inner.map(v=>v.clone());
  // simple hex prism cap
  const geom = new THREE.Shape();
  centerPts.forEach((p,idx)=> idx? geom.lineTo(p.x,p.y) : geom.moveTo(p.x,p.y));
  geom.closePath();
  const sh = new THREE.ShapeGeometry(geom);
  sh.rotateX(Math.PI*0); // flat
  const center = new THREE.Mesh(sh, materialBuilder(opacitys[6]));
  center.position.set(0,0,H*0.98); // slightly raised
  group.add(center);

  return { group, outer, inner, segMeshes, centerMesh:center };
}

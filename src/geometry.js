import * as THREE from 'three';

export const V2 = THREE.Vector2;
export const OUTER_R = 3.2;

export const ease = t => (1 - Math.cos(Math.PI * t)) * 0.5;

export function hexFlatTop(r){
  const a0 = 0; // flat-top
  const pts = [];
  for(let i=0;i<6;i++){
    const a = a0 + i*Math.PI/3;
    pts.push(new V2(r*Math.cos(a), r*Math.sin(a)));
  }
  return pts;
}

export function inwardNormal(p,q,centroid){
  const e = new V2().subVectors(q,p);
  const n = new V2(-e.y, e.x).normalize();
  const mid = new V2().addVectors(p,q).multiplyScalar(.5);
  const toC = new V2().subVectors(centroid, mid);
  return (n.dot(toC) > 0) ? n : n.multiplyScalar(-1);
}

export function intersectLinesPD(p1, d1, p2, d2){
  const a=d1.x, b=-d2.x, c=d1.y, d=-d2.y;
  const det = a*d - b*c; if (Math.abs(det) < 1e-8) return p1.clone();
  const rhsx = p2.x - p1.x, rhsy = p2.y - p1.y;
  const t = (rhsx*d - b*rhsy) / det;
  return new V2(p1.x + d1.x*t, p1.y + d1.y*t);
}

export function insetQuad(A,B,C,D,dist){
  const centroid = new V2((A.x+B.x+C.x+D.x)/4,(A.y+B.y+C.y+D.y)/4);
  const P=[A,B,C,D], lines=[];
  for(let i=0;i<4;i++){
    const p=P[i], q=P[(i+1)%4];
    const n=inwardNormal(p,q,centroid);
    const d=new V2(-n.y, n.x);
    const pShift = new V2().addVectors(p, n.clone().multiplyScalar(dist));
    lines.push({p:pShift, d});
  }
  return [
    intersectLinesPD(lines[3].p, lines[3].d, lines[0].p, lines[0].d),
    intersectLinesPD(lines[0].p, lines[0].d, lines[1].p, lines[1].d),
    intersectLinesPD(lines[1].p, lines[1].d, lines[2].p, lines[2].d),
    intersectLinesPD(lines[2].p, lines[2].d, lines[3].p, lines[3].d),
  ];
}

export function quadCentroid(Q){
  return new V2((Q[0].x+Q[1].x+Q[2].x+Q[3].x)/4,(Q[0].y+Q[1].y+Q[2].y+Q[3].y)/4);
}

export function minEdgeLen(pts){
  let m=Infinity; for(let i=0;i<pts.length;i++){
    const a=pts[i], b=pts[(i+1)%pts.length]; m=Math.min(m, a.distanceTo(b));
  }
  return m;
}

/* ---------- mesh builders (fixed center top — no extra rim inset) ---------- */
export function makeSegmentGeometryRounded(A,B,C,D, rim, H, T, roundSteps){
  const verts = [];
  const quad=(p1,p2,p3,p4,z)=>{ const v=(p,z)=>[p.x,p.y,z]; const tri=(a,b,c)=>verts.push(...v(a,z),...v(b,z),...v(c,z)); tri(p1,p2,p3); tri(p1,p3,p4); };
  const outer=[A,B,C,D];

  const stepsH=Math.max(1, Math.floor(roundSteps));
  let prev=outer, prevZ=0, poly=null;
  const maxInset = Math.min(A.distanceTo(B),B.distanceTo(C),C.distanceTo(D),D.distanceTo(A))*0.24;
  const s = Math.min(Math.max(rim,0), maxInset);
  for(let i=1;i<=stepsH;i++){
    const t=i/stepsH, zi=H*ease(t), si=s*t;
    poly = insetQuad(A,B,C,D,si);
    addBand(verts, prev, poly, prevZ, zi);
    prev=poly; prevZ=zi;
  }
  quad(poly[0],poly[1],poly[2],poly[3],prevZ);

  if (T>0){
    const Zb=-T; quad(D,C,B,A,Zb);
    const stepsV=Math.max(1, Math.floor(roundSteps));
    const maxSideInset=Math.min(s*0.45, Math.min(A.distanceTo(B),B.distanceTo(C),C.distanceTo(D),D.distanceTo(A))*0.08);
    let prevC=outer, prevVz=0;
    for(let i=1;i<=stepsV;i++){
      const t=i/stepsV, zi=-T*ease(t), cont=insetQuad(A,B,C,D, maxSideInset*ease(t));
      addBand(verts, prevC, cont, prevVz, zi); prevC=cont; prevVz=zi;
    }
    const maxInnerOut=Math.min(s*0.35, Math.min(A.distanceTo(B),B.distanceTo(C),C.distanceTo(D),D.distanceTo(A))*0.06);
    let prevCi=poly, prevZi=prevZ;
    for(let i=1;i<=stepsV;i++){
      const t=i/stepsV, zi=prevZ+(-T-prevZ)*ease(t);
      const cont=insetQuad(A,B,C,D, s - maxInnerOut*ease(t));
      addBand(verts, prevCi, cont, prevZi, zi); prevCi=cont; prevZi=zi;
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts,3));
  geo.computeVertexNormals();
  return geo;
}

export function makeCenterGeometryRounded(innerPts, rim, H, T, roundSteps){
  // FIX: top plateau should start from innerPts and expand slightly upward with rounding only (no fixed extra rim inset on top)
  const centroid = new V2(0,0);
  const mkInsetHex = (k)=>{
    const lines=[];
    for(let i=0;i<6;i++){
      const p=innerPts[i], q=innerPts[(i+1)%6];
      const n=inwardNormal(p,q,centroid);
      const d=new V2(-n.y, n.x);
      const pShift = new V2().addVectors(p, n.clone().multiplyScalar(k));
      lines.push({p:pShift, d});
    }
    const poly=[]; for(let i=0;i<6;i++){ const L1=lines[(i+5)%6], L2=lines[i]; poly.push(intersectLinesPD(L1.p, L1.d, L2.p, L2.d)); }
    return poly;
  };
  const verts=[]; const tri=(p1,p2,p3,z1,z2,z3)=>{ const v=(p,z)=>[p.x,p.y,z]; verts.push(...v(p1,z1),...v(p2,z2),...v(p3,z3)); };

  const stepsH=Math.max(1, Math.floor(roundSteps));
  let prevPoly=innerPts, prevZ=0, poly=null;
  for(let i=1;i<=stepsH;i++){
    const t=i/stepsH, zi=H*ease(t);
    poly = mkInsetHex((rim)*t); // grow from innerPts by rim*t (no constant offset)
    addBand(verts, prevPoly, poly, prevZ, zi);
    prevPoly=poly; prevZ=zi;
  }
  for(let i=1;i<5;i++) tri(poly[0],poly[i],poly[i+1],prevZ,prevZ,prevZ);

  if (T>0){
    const Zb=-T;
    for(let i=1;i<5;i++) tri(innerPts[0], innerPts[i+1], innerPts[i], Zb,Zb,Zb);
    const stepsV=Math.max(1, Math.floor(roundSteps));
    let prevContour=innerPts, prevVz=0;
    const maxSideInset=Math.min(rim*0.45, 0.22*rim);
    for(let i=1;i<=stepsV;i++){
      const t=i/stepsV, zi=-T*ease(t), cont=mkInsetHex(maxSideInset*ease(t));
      addBand(verts, prevContour, cont, prevVz, zi);
      prevContour=cont; prevVz=zi;
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts,3));
  geo.computeVertexNormals();
  return geo;
}

export function addBand(verts, P, Q, z1, z2){
  const n=P.length;
  const v=(p,z)=>[p.x,p.y,z];
  const tri=(p1,p2,p3,zA,zB,zC)=>verts.push(...v(p1,zA),...v(p2,zB),...v(p3,zC));
  for(let i=0;i<n;i++){
    const p1=P[i], p2=P[(i+1)%n];
    const q1=Q[i], q2=Q[(i+1)%n];
    tri(p1,p2,q2,z1,z1,z2); tri(p1,q2,q1,z1,z2,z2);
  }
}

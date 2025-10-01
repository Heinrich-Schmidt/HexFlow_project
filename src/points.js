import * as THREE from 'three';
import { V2, OUTER_R, hexFlatTop } from './geometry.js';

/** Compute segment translation vectors from gap & per-segment gap */
export function computeSegmentTranslations(UI){
  const gapWorld = +UI.geometry.gap.value/20;
  const ratio = +UI.geometry.ratio.value/100;
  const outer = hexFlatTop(OUTER_R);
  const inner = hexFlatTop(OUTER_R*ratio);

  const trans = [];
  for(let i=0;i<6;i++){
    const A=outer[i], B=outer[(i+1)%6], C=inner[(i+1)%6], D=inner[i];
    const cx=(A.x+B.x+C.x+D.x)/4;
    const cy=(A.y+B.y+C.y+D.y)/4;
    const len=Math.hypot(cx,cy)||1;
    const extra=(gapWorld + (+UI.segments[i].gap||0)/20);
    trans[i] = new V2((cx/len)*extra, (cy/len)*extra);
  }
  return {trans, outer, inner};
}

/** Circumcenter of triangle in 2D */
function circumcenter(A,B,C){
  const ax=A.x, ay=A.y, bx=B.x, by=B.y, cx=C.x, cy=C.y;
  const d = 2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by));
  if (Math.abs(d) < 1e-9){
    return new V2((ax+bx+cx)/3, (ay+by+cy)/3);
  }
  const ux = ((ax*ax+ay*ay)*(by-cy) + (bx*bx+by*by)*(cy-ay) + (cx*cx+cy*cy)*(ay-by)) / d;
  const uy = ((ax*ax+ay*ay)*(cx-bx) + (bx*bx+by*by)*(ax-cx) + (cx*cx+cy*cy)*(bx-ax)) / d;
  return new V2(ux, uy);
}

/** Build point set (inner ring + outer ring) on back plane */
export function buildAnchorPoints(UI){
  const { trans, outer, inner } = computeSegmentTranslations(UI);
  const Z_BACK = -(+UI.geometry.thick.value/20) - 0.002;

  const pts=[]; // {id, pos:THREE.Vector3, label}

  // inner ring: for vertex i of center hex, use circumcenter of triangle (D, D_i, C_i)
  for(let i=0;i<6;i++){
    const D = inner[i].clone(), C = inner[(i+1)%6].clone();
    const Di = D.clone().add(trans[i]);
    const Ci = C.clone().add(trans[i]); // use same segment i for neighbor's inner vertex offset
    const ctr = circumcenter(D, Di, Ci);
    pts.push({ id:`I${i+1}`, label:`I${i+1}`, pos:new THREE.Vector3(ctr.x, ctr.y, Z_BACK) });
  }

  // outer ring between segments: midpoint between the same shared outer vertex shifted by each neighbor's translation
  for(let i=0;i<6;i++){
    const j=(i+1)%6;
    const sharedOuter = outer[j].clone();
    const p_i = sharedOuter.clone().add(trans[i]);
    const p_j = sharedOuter.clone().add(trans[j]);
    const mid = new V2().addVectors(p_i, p_j).multiplyScalar(0.5);
    pts.push({ id:`O${j+1}`, label:`O${j+1}`, pos:new THREE.Vector3(mid.x, mid.y, Z_BACK) });
  }

  return pts;
}

export function makePointSprite(text, color="#FF3B3B"){
  const size = 64;
  const c=document.createElement('canvas'); c.width=c.height=size;
  const ctx=c.getContext('2d');
  // red plus
  ctx.strokeStyle=color; ctx.lineWidth=6; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(size*0.2,size*0.5); ctx.lineTo(size*0.8,size*0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(size*0.5,size*0.2); ctx.lineTo(size*0.5,size*0.8); ctx.stroke();
  // label
  ctx.fillStyle="#fff"; ctx.font='700 18px system-ui, sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(text, 2, 2);
  const tex=new THREE.CanvasTexture(c);
  const mat=new THREE.SpriteMaterial({ map: tex, transparent:true, depthWrite:false, depthTest:true });
  const spr=new THREE.Sprite(mat);
  const scale=0.16;
  spr.scale.set(scale, scale, 1);
  return spr;
}

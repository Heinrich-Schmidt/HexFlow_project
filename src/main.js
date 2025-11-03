import * as THREE from "three";
import { OrbitControls } from "OrbitControls";
import { RoomEnvironment } from "RoomEnvironment";

const UI = {
  view: {
    rx: {label:"Rotate X (deg)", min:-180, max:180, step:0.1, value: 15},
    ry: {label:"Rotate Y (deg)", min:-180, max:180, step:0.1, value: 25},
    rz: {label:"Rotate Z (deg)", min:-180, max:180, step:0.1, value: 0},
    distance: {label:"Zoom (distance)", min: 3, max: 30, step:0.1, value: 12},
    tx: {label:"Target X", min:-5, max:5, step:0.01, value:0},
    ty: {label:"Target Y", min:-5, max:5, step:0.01, value:0},
    tz: {label:"Target Z", min:-5, max:5, step:0.01, value:0},
    wheelZoom: {label:"Mouse wheel zoom", value:true},
  },
  geometry: {
    relief:{label:"Relief (H)", min:0, max:80, step:1, value:6},
    rim:{label:"Rim", min:0, max:60, step:1, value:10},
    round:{label:"Roundness", min:1, max:80, step:1, value:24},
    ratio:{label:"Center ratio %", min:10, max:60, step:0.5, value:26},
    gap:{label:"Gap", min:0, max:10, step:0.1, value:0.6},
    thick:{label:"Thickness down", min:0, max:30, step:1, value:2},
  },
  material: {
    type:{label:"Type", value:"standard", options:["standard","physical","phong","basic"]},
    color:{label:"Color", value:"#00ff66"},
    metalness:{label:"Metalness", min:0, max:1, step:0.01, value:0.2},
    roughness:{label:"Roughness", min:0, max:1, step:0.01, value:0.35},
    transmission:{label:"Transmission", min:0, max:1, step:0.01, value:0},
    ior:{label:"IOR", min:1, max:2.5, step:0.01, value:1.5},
    thickness:{label:"Thickness (glass)", min:0, max:5, step:0.05, value:1.2},
    clearcoat:{label:"Clearcoat", min:0, max:1, step:0.01, value:0.2},
    clearcoatRough:{label:"Clearcoat rough", min:0, max:1, step:0.01, value:0.4},
    envIntensity:{label:"EnvMap intensity", min:0, max:5, step:0.05, value:1.2},
    envEnabled:{label:"Environment on", value:true}
  },
  typography: {
    fontSize:{label:"Font size (px)", min:8, max:64, step:1, value:16},
    lineHeight:{label:"Line height", min:0.8, max:2.0, step:0.05, value:1.3},
    fontFamily:{label:"Font family", value:"system-ui", options:["system-ui","Inter","Roboto","Arial","Segoe UI","Open Sans","Montserrat","Noto Sans","PT Sans","Georgia","Times New Roman","monospace"]},
    fontWeight:{label:"Weight", value:"600", options:["400","500","600","700","800"]},
    textColor:{label:"Text color", value:"#111111"},
    strokeColor:{label:"Stroke color", value:"#ffffff"},
    strokePx:{label:"Stroke (px)", min:0, max:6, step:1, value:2},
    pxToWorld:{label:"px→world", min:0.005, max:0.03, step:0.001, value:0.012},
    uppercase:{label:"UPPERCASE", value:true}
  }
};

// ---------- scene ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(0,0,12);

const renderer = new THREE.WebGLRenderer({ antialias:true });
const vp = document.getElementById('viewport');
vp.appendChild(renderer.domElement);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setPixelRatio(Math.min(2.5, window.devicePixelRatio||1));
renderer.setSize(vp.clientWidth, vp.clientHeight, false);

const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.02).texture;
scene.environment = envTex;

function resize(){
  const w = vp.clientWidth, h = vp.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(vp);
addEventListener('resize', resize);

// controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .08;
controls.enablePan = true;

// ---------- lights ----------
const key = new THREE.DirectionalLight(0xffffff, .9); key.position.set(5,5,7);
const fill = new THREE.DirectionalLight(0xffffff, .6); fill.position.set(-6,3,-2);
const amb = new THREE.AmbientLight(0xffffff, .4);
scene.add(key, fill, amb);

// ---------- geometry helpers ----------
const V2 = THREE.Vector2;
const OUTER_R = 3.2;
const ease = t => (1-Math.cos(Math.PI*t))*0.5;
function hex(r){ const a0=0, pts=[]; for(let i=0;i<6;i++){ const a=a0+i*Math.PI/3; pts.push(new V2(r*Math.cos(a), r*Math.sin(a))); } return pts; }
function inwardNormal(p,q,centroid){ const e=new V2().subVectors(q,p); const n=new V2(-e.y,e.x).normalize();
  const mid=new V2().addVectors(p,q).multiplyScalar(.5); const toC=new V2().subVectors(centroid, mid); return (n.dot(toC)>0)?n:n.multiplyScalar(-1); }
function intersectLinesPD(p1,d1,p2,d2){ const a=d1.x,b=-d2.x,c=d1.y,d=-d2.y; const det=a*d-b*c; if(Math.abs(det)<1e-8) return p1.clone();
  const rhsx=p2.x-p1.x, rhsy=p2.y-p1.y; const t=(rhsx*d-b*rhsy)/det; return new V2(p1.x+d1.x*t, p1.y+d1.y*t); }
function insetQuad(A,B,C,D,dist){ const centroid=new V2((A.x+B.x+C.x+D.x)/4,(A.y+B.y+C.y+D.y)/4);
  const P=[A,B,C,D], lines=[]; for(let i=0;i<4;i++){ const p=P[i], q=P[(i+1)%4]; const n=inwardNormal(p,q,centroid); const d=new V2(-n.y,n.x);
    const pShift=new V2().addVectors(p, n.clone().multiplyScalar(dist)); lines.push({p:pShift,d}); }
  return [ intersectLinesPD(lines[3].p,lines[3].d,lines[0].p,lines[0].d),
           intersectLinesPD(lines[0].p,lines[0].d,lines[1].p,lines[1].d),
           intersectLinesPD(lines[1].p,lines[1].d,lines[2].p,lines[2].d),
           intersectLinesPD(lines[2].p,lines[2].d,lines[3].p,lines[3].d) ];
}
function addBand(verts,P,Q,z1,z2){ const n=P.length; const v=(p,z)=>[p.x,p.y,z]; const tri=(a,b,c,za,zb,zc)=>verts.push(...v(a,za),...v(b,zb),...v(c,zc));
  for(let i=0;i<n;i++){ const p1=P[i],p2=P[(i+1)%n], q1=Q[i],q2=Q[(i+1)%n]; tri(p1,p2,q2,z1,z1,z2); tri(p1,q2,q1,z1,z2,z2); } }

// build meshes
let hexGroup = new THREE.Group(); scene.add(hexGroup);
let segMeshes = []; let centerMesh=null; let labelRefs=[];

function buildMaterial(opacity=1){
  const m = UI.material;
  const col = new THREE.Color(m.color.value);
  let mat;
  if (m.type.value==="physical"){
    mat = new THREE.MeshPhysicalMaterial({
      color: col, metalness:+m.metalness.value, roughness:+m.roughness.value, transmission:+m.transmission.value,
      ior:+m.ior.value, thickness:+m.thickness.value, clearcoat:+m.clearcoat.value, clearcoatRoughness:+m.clearcoatRough.value,
      envMapIntensity:+m.envIntensity.value, transparent: (opacity<1 || m.transmission.value>0), opacity, side:THREE.DoubleSide
    });
  } else if (m.type.value==="standard"){
    mat = new THREE.MeshStandardMaterial({
      color: col, metalness:+m.metalness.value, roughness:+m.roughness.value, envMapIntensity:+m.envIntensity.value,
      transparent: opacity<1, opacity, side:THREE.DoubleSide
    });
  } else if (m.type.value==="phong"){
    mat = new THREE.MeshPhongMaterial({ color: col, shininess:80, specular:new THREE.Color(0xdddddd), transparent:opacity<1, opacity, side:THREE.DoubleSide });
  } else {
    mat = new THREE.MeshBasicMaterial({ color: col, transparent:opacity<1, opacity, side:THREE.DoubleSide });
  }
  scene.environment = m.envEnabled.value ? envTex : null;
  return mat;
}

function makeSegmentGeometry(A,B,C,D, rim, H, T, roundSteps){
  const maxInset = Math.min(A.distanceTo(B),B.distanceTo(C),C.distanceTo(D),D.distanceTo(A))*0.24;
  const s = Math.min(Math.max(rim,0), maxInset);
  const verts = []; const quad=(p1,p2,p3,p4,z)=>{ const v=(p,z)=>[p.x,p.y,z]; const tri=(a,b,c)=>verts.push(...v(a,z),...v(b,z),...v(c,z)); tri(p1,p2,p3); tri(p1,p3,p4); };
  const outer=[A,B,C,D]; const stepsH=Math.max(1,Math.floor(roundSteps)); let prev=outer, prevZ=0, poly=null;
  for(let i=1;i<=stepsH;i++){ const t=i/stepsH, zi=H*ease(t), si=s*t; poly=insetQuad(A,B,C,D,si); addBand(verts, prev, poly, prevZ, zi); prev=poly; prevZ=zi; }
  quad(poly[0],poly[1],poly[2],poly[3],prevZ);
  if (T>0){
    const Zb=-T; quad(D,C,B,A,Zb);
    const stepsV=Math.max(1,Math.floor(roundSteps));
    const maxSideInset=Math.min(s*0.45, Math.min(A.distanceTo(B),B.distanceTo(C),C.distanceTo(D),D.distanceTo(A))*0.08);
    let prevC=outer, prevVz=0; for(let k=1;k<=stepsV;k++){ const t=k/stepsV, zi=-T*ease(t), cont=insetQuad(A,B,C,D,maxSideInset*ease(t)); addBand(verts, prevC, cont, prevVz, zi); prevC=cont; prevVz=zi; }
    const maxInnerOut=Math.min(s*0.35, Math.min(A.distanceTo(B),B.distanceTo(C),C.distanceTo(D),D.distanceTo(A))*0.06);
    let prevCi=poly, prevZi=prevZ; for(let k=1;k<=stepsV;k++){ const t=k/stepsV, zi=prevZ+(-T-prevZ)*ease(t); const cont=insetQuad(A,B,C,D,s-maxInnerOut*ease(t)); addBand(verts, prevCi, cont, prevZi, zi); prevCi=cont; prevZi=zi; }
  }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts,3)); geo.computeVertexNormals();
  return geo;
}

function makeCenterGeometry(innerPts, inset, H, T, roundSteps){
  const centroid = new V2(0,0);
  const mkInsetHex = (k)=>{
    const lines=[]; for(let i=0;i<6;i++){ const p=innerPts[i], q=innerPts[(i+1)%6]; const n=inwardNormal(p,q,centroid); const d=new V2(-n.y,n.x);
      const pShift = new V2().addVectors(p, n.clone().multiplyScalar(k)); lines.push({p:pShift,d}); }
    const poly=[]; for(let i=0;i<6;i++){ const L1=lines[(i+5)%6], L2=lines[i]; poly.push(intersectLinesPD(L1.p,L1.d,L2.p,L2.d)); }
    return poly;
  };
  const verts=[]; const tri=(p1,p2,p3,z1,z2,z3)=>{ const v=(p,z)=>[p.x,p.y,z]; verts.push(...v(p1,z1),...v(p2,z2),...v(p3,z3)); };
  const stepsH=Math.max(1,Math.floor(roundSteps)); let prevPoly=innerPts, prevZ=0, poly=null;
  for(let i=1;i<=stepsH;i++){ const t=i/stepsH, zi=H*ease(t); poly=mkInsetHex(inset*t); addBand(verts, prevPoly, poly, prevZ, zi); prevPoly=poly; prevZ=zi; }
  for(let i=1;i<5;i++) tri(poly[0],poly[i],poly[i+1],prevZ,prevZ,prevZ);
  if (T>0){ const Zb=-T; for(let i=1;i<5;i++) tri(innerPts[0], innerPts[i+1], innerPts[i], Zb,Zb,Zb); }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts,3)); geo.computeVertexNormals();
  return geo;
}

function rebuild(){
  const g=UI.geometry;
  const H=+g.relief.value/20, rim=+g.rim.value/40, ratio=+g.ratio.value/100, T=+g.thick.value/20, gapWorld=+g.gap.value/20;

  scene.remove(hexGroup);
  hexGroup = new THREE.Group(); segMeshes=[];

  const outer = hex(OUTER_R);
  const inner = hex(OUTER_R * ratio);

  for (let i=0;i<6;i++){
    const A=outer[i], B=outer[(i+1)%6], C=inner[(i+1)%6], D=inner[i];
    const geo = makeSegmentGeometry(A,B,C,D, rim, H, T, +g.round.value);
    const seg = new THREE.Mesh(geo, buildMaterial(0.9));
    const cx=(A.x+B.x+C.x+D.x)/4, cy=(A.y+B.y+C.y+D.y)/4, len=Math.hypot(cx,cy)||1;
    seg.position.set((cx/len)*gapWorld, (cy/len)*gapWorld, 0);
    segMeshes.push(seg); hexGroup.add(seg);
  }

  const geoC = makeCenterGeometry(inner, rim*0.8, H, T, +g.round.value);
  centerMesh = new THREE.Mesh(geoC, buildMaterial(1));
  hexGroup.add(centerMesh);

  // roll Z
  hexGroup.rotation.z = THREE.MathUtils.degToRad(+UI.view.rz.value);

  scene.add(hexGroup);
  applyViewToControls(); // position by distance/target
}

function applyViewToControls(){
  const v = UI.view;
  const dist = +v.distance.value;
  const tx=+v.tx.value, ty=+v.ty.value, tz=+v.tz.value;
  const rx=THREE.MathUtils.degToRad(+v.rx.value);
  const ry=THREE.MathUtils.degToRad(+v.ry.value);

  const target = new THREE.Vector3(tx,ty,tz);
  const az = ry; const pol = rx + Math.PI/2;
  const x = target.x + dist*Math.sin(pol)*Math.cos(az);
  const y = target.y + dist*Math.cos(pol);
  const z = target.z + dist*Math.sin(pol)*Math.sin(az);
  camera.position.set(x,y,z);
  controls.target.copy(target);
  controls.update();
}

function syncFromOrbit(){
  const az = controls.getAzimuthalAngle();
  const pol = controls.getPolarAngle();
  const rxDeg = THREE.MathUtils.radToDeg(pol - Math.PI/2);
  const ryDeg = THREE.MathUtils.radToDeg(az);
  // distance and target
  const dist = camera.position.distanceTo(controls.target);
  UI.view.rx.value = rxDeg;
  UI.view.ry.value = ryDeg;
  UI.view.distance.value = dist;
  // update sliders UI if exist
  for (const id of ["rx","ry","distance","tx","ty","tz","rz"]) {
    const r = document.getElementById(id);
    const n = document.getElementById(id+"-n");
    if (r && n && id!=="rz"){ r.value = UI.view[id].value; n.value = UI.view[id].value; }
  }
}

controls.addEventListener('change', ()=>{
  if (!UI.view.wheelZoom.value){
    // block wheel zoom if disabled
    controls.enableZoom = false;
  } else {
    controls.enableZoom = true;
  }
  syncFromOrbit();
});

// ---------- UI wiring ----------
const viewRows = document.getElementById('view-rows');
const geomRows = document.getElementById('geom-rows');
const matRows = document.getElementById('mat-rows');
const typRows = document.getElementById('typ-rows');

function rowRangeNumber(container, id, cfg){
  const wrap=document.createElement('div'); wrap.className='row';
  const label=document.createElement('label'); label.textContent=cfg.label; label.htmlFor=id;
  const range=document.createElement('input'); range.type='range';
  range.id=id; range.min=cfg.min; range.max=cfg.max; range.step=cfg.step; range.value=cfg.value;
  const num=document.createElement('input'); num.type='number';
  num.id=id+'-n'; num.min=cfg.min; num.max=cfg.max; num.step=cfg.step; num.value=cfg.value;
  wrap.append(label, range, num); container.appendChild(wrap);
  const apply=(v)=>{ const vv=Math.max(+cfg.min, Math.min(+cfg.max, +v)); range.value=num.value=vv; cfg.value=vv; };
  range.addEventListener('input', ()=>{ apply(range.value); onChange(id); });
  num.addEventListener('input', ()=>{ apply(num.value); onChange(id); });
  return {range,num,apply};
}
function rowSelect(container, id, cfg){
  const wrap=document.createElement('div'); wrap.className='row';
  const label=document.createElement('label'); label.textContent=cfg.label; label.htmlFor=id;
  const sel=document.createElement('select'); sel.id=id;
  cfg.options.forEach(opt=>{ const o=document.createElement('option'); o.value=opt; o.textContent=opt; sel.appendChild(o); });
  sel.value=cfg.value; wrap.append(label, sel); container.appendChild(wrap);
  sel.addEventListener('change', ()=>{ cfg.value=sel.value; onChange(id); });
  return {select:sel};
}
function rowColor(container, id, cfg){
  const wrap=document.createElement('div'); wrap.className='row';
  const label=document.createElement('label'); label.textContent=cfg.label;
  const col=document.createElement('input'); col.type='color'; col.value=cfg.value;
  const hex=document.createElement('input'); hex.type='text'; hex.value=cfg.value; hex.style.width='110px';
  hex.style.background='#0e0f11'; hex.style.border='1px solid #333'; hex.style.borderRadius='6px'; hex.style.color='#e5e7eb'; hex.style.padding='4px 6px';
  wrap.append(label, col, hex); container.appendChild(wrap);
  const apply=v=>{ cfg.value=v; onChange(id); };
  col.addEventListener('input', ()=>apply(col.value));
  hex.addEventListener('input', ()=>{ const s=hex.value.replace('#',''); if(/^[0-9a-f]{6}$/i.test(s)){ apply('#'+s); hex.style.borderColor='#333'; } else hex.style.borderColor='#a33'; });
}

const viewCtrls = {};
viewCtrls.rx = rowRangeNumber(viewRows, 'rx', UI.view.rx);
viewCtrls.ry = rowRangeNumber(viewRows, 'ry', UI.view.ry);
viewCtrls.rz = rowRangeNumber(viewRows, 'rz', UI.view.rz);
viewCtrls.distance = rowRangeNumber(viewRows, 'distance', UI.view.distance);
viewCtrls.tx = rowRangeNumber(viewRows, 'tx', UI.view.tx);
viewCtrls.ty = rowRangeNumber(viewRows, 'ty', UI.view.ty);
viewCtrls.tz = rowRangeNumber(viewRows, 'tz', UI.view.tz);
// wheel zoom
(function(){
  const wrap=document.createElement('div'); wrap.className='row';
  const label=document.createElement('label'); label.textContent=UI.view.wheelZoom.label;
  const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!UI.view.wheelZoom.value;
  wrap.append(label, cb); viewRows.appendChild(wrap);
  cb.addEventListener('change', ()=>{ UI.view.wheelZoom.value = cb.checked; onChange('wheelZoom'); });
})();

// geometry
for (const k of Object.keys(UI.geometry)) rowRangeNumber(geomRows, k, UI.geometry[k]);

// materials
rowSelect(matRows, 'mat-type', UI.material.type);
rowColor(matRows, 'mat-color', UI.material.color);
for (const k of ['metalness','roughness','transmission','ior','thickness','clearcoat','clearcoatRough','envIntensity']) rowRangeNumber(matRows, k, UI.material[k]);
(function(){
  const wrap=document.createElement('div'); wrap.className='row';
  const label=document.createElement('label'); label.textContent=UI.material.envEnabled.label;
  const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!UI.material.envEnabled.value;
  wrap.append(label, cb); matRows.appendChild(wrap);
  cb.addEventListener('change', ()=>{ UI.material.envEnabled.value=cb.checked; onChange('envEnabled'); });
})();

// typography
rowRangeNumber(typRows, 'fontSize', UI.typography.fontSize);
rowRangeNumber(typRows, 'lineHeight', UI.typography.lineHeight);
rowSelect(typRows, 'fontFamily', UI.typography.fontFamily);
rowSelect(typRows, 'fontWeight', UI.typography.fontWeight);
rowColor(typRows, 'textColor', UI.typography.textColor);
rowColor(typRows, 'strokeColor', UI.typography.strokeColor);
rowRangeNumber(typRows, 'strokePx', UI.typography.strokePx);
rowRangeNumber(typRows, 'pxToWorld', UI.typography.pxToWorld);
(function(){
  const wrap=document.createElement('div'); wrap.className='row';
  const label=document.createElement('label'); label.textContent=UI.typography.uppercase.label;
  const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!UI.typography.uppercase.value;
  wrap.append(label, cb); typRows.appendChild(wrap);
  cb.addEventListener('change', ()=>{ UI.typography.uppercase.value=cb.checked; onChange('uppercase'); });
})();

// toggles
[ ['toggle-view','view-ui'], ['toggle-geom','geom-ui'], ['toggle-mat','mat-ui'], ['toggle-typ','typ-ui'] ]
  .forEach(([chk,panel])=>{
    const c=document.getElementById(chk), p=document.getElementById(panel);
    c.addEventListener('change', ()=>{ p.classList.toggle('hidden', !c.checked); requestAnimationFrame(resize); });
  });

function onChange(id){
  if (id==='rx' || id==='ry' || id==='rz' || id==='distance' || id==='tx' || id==='ty' || id==='tz' || id==='wheelZoom'){
    applyViewToControls();
  }
  if (id in UI.geometry){
    rebuild();
  }
  if (id.startsWith('mat') || id in UI.material){
    // refresh materials
    segMeshes.forEach(m=>{ const old=m.material; m.material=buildMaterial(m.material.opacity??1); old?.dispose?.(); });
    if (centerMesh){ const old=centerMesh.material; centerMesh.material=buildMaterial(1); old?.dispose?.(); }
  }
  if (id in UI.typography){
    // labels refresh would go here if labels re-enabled
  }
  requestAnimationFrame(resize);
}

// initial
rebuild();
applyViewToControls();
(function loop(){ requestAnimationFrame(loop); controls.update(); renderer.render(scene,camera); })();

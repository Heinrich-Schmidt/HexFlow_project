import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { OUTER_R, hexFlatTop, makeSegmentGeometryRounded, makeCenterGeometryRounded, minEdgeLen, quadCentroid, insetQuad, ease } from './geometry.js';
import { buildAnchorPoints, makePointSprite, computeSegmentTranslations } from './points.js';
import { buildCurveFromPointList } from './paths.js';
import { FlowParticles } from './particles.js';
import { rowRangeNumber, rowSelect, rowCheckbox } from './ui.js';

/* =========================
   STATE / UI CONFIG
   ========================= */
const UI = {
  view: {
    scale: { label:"Scale", min: 0.4, max: 2.5, step: 0.01, value: 1.0 },
    rx: { label:"Rotate X (deg)", min:-180, max:180, step:1, value: 14 },
    ry: { label:"Rotate Y (deg)", min:-180, max:180, step:1, value: 30 },
    rz: { label:"Rotate Z (deg)", min:-180, max:180, step:1, value: -8 },
  },
  geometry: {
    gap:   { label:"Gap", min:0, max:10, step:0.1, value: 0.5 },
    relief:{ label:"Relief H", min:0, max:80, step:1, value: 4 },
    rim:   { label:"Rim width", min:0, max:60, step:1, value: 10 },
    round: { label:"Roundness", min:1, max:100, step:1, value: 28 },
    ratio: { label:"Center ratio %", min:10, max:60, step:0.5, value: 26 },
    thick: { label:"Thickness down", min:0, max:30, step:1, value: 3 },
    color: { label:"Element color", value: "#00ff66" }
  },
  typography: {
    fontSize:   { label: "Font size (px)", min: 8, max: 64, step: 1, value: 14 },
    fontFamily: { label: "Font family", value: "system-ui", options: [
      "system-ui","Inter","Roboto","Arial","Segoe UI","Open Sans","Montserrat","Noto Sans","PT Sans","Georgia","Times New Roman","monospace"
    ]},
    lineHeight: { label: "Line height", min: 0.8, max: 2.0, step: 0.05, value: 1.4 },
    fontWeight: { label: "Weight", value: "600", options: ["400","500","600","700","800"] },
    textColor:  { label: "Text color", value: "#000000" },
    strokeColor:{ label: "Stroke color", value: "#000000" },
    strokePx:   { label: "Stroke (px)", min: 0, max: 6, step: 1, value: 0 },
    uppercase:  { label: "UPPERCASE", value: true },
    pxToWorld:  { label: "px→world", min: 0.005, max: 0.03, step: 0.001, value: 0.012 }
  },
  segments: [
    { name:"Сегмент 1", label:"\n\nпредставление сообщений", opacity:.5, gap:0 },
    { name:"Сегмент 2", label:"организация внутреннего контроля", opacity:.5, gap:0 },
    { name:"Сегмент 3", label:"\n\nдобровольное сотрудничество", opacity:.5, gap:0 },
    { name:"Сегмент 4", label:"самообучение", opacity:.5, gap:0 },
    { name:"Сегмент 5", label:"\nустранение нарушенений", opacity:.5, gap:0 },
    { name:"Сегмент 6", label:"\nРабота с перечнем", opacity:1, gap:0 },
    { name:"Центр",     label:"Низкий уровень риска", opacity:1, gap:0 },
  ],
  points: {
    show: { label:"Show points", value: true },
    showLabels: { label:"Show IDs", value: true },
  },
  paths: {
    roundingGlobal: { label:"Rounding global", min:0, max:1, step:0.01, value: 0.2 },
    steps: [] // [{toId:'I1', round:0.2} ...]
  },
  particles: {
    flowA: { label:"A→B color", value:"#ffffff", size:{label:"Size A", min:0.02,max:0.2,step:0.005, value:0.06}, speed:{label:"Speed A", min:0.02,max:1,step:0.01,value:0.25}, light:{label:"Light A", min:0,max:3,step:0.05, value:0.0} },
    flowB: { label:"B→A color", value:"#00ff66", size:{label:"Size B", min:0.02,max:0.2,step:0.005, value:0.06}, speed:{label:"Speed B", min:0.02,max:1,step:0.01,value:0.25}, light:{label:"Light B", min:0,max:3,step:0.05, value:1.0} },
    count: { label:"Particles per flow", min:10, max:120, step:1, value:36 }
  }
};

/* =========================
   SCENE
   ========================= */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(0,0,10);

const renderer = new THREE.WebGLRenderer({ antialias:true });
const vp = document.getElementById('viewport');
vp.appendChild(renderer.domElement);
renderer.setPixelRatio(Math.min(2.5, window.devicePixelRatio||1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.physicallyCorrectLights = true;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .08;
controls.enablePan = false; controls.rotateSpeed = .8;

const key = new THREE.DirectionalLight(0xffffff, .9);
const fill = new THREE.DirectionalLight(0xffffff, .7);
key.position.set(8,5,6); fill.position.set(-6,4,-3);
const amb = new THREE.AmbientLight(0xffffff, .6);
scene.add(key, fill, amb);

function sizeRenderer(){
  const w=vp.clientWidth, h=vp.clientHeight||1;
  renderer.setSize(w,h,false);
  camera.aspect=w/h; camera.updateProjectionMatrix();
}
new ResizeObserver(sizeRenderer).observe(vp); addEventListener('resize', sizeRenderer); sizeRenderer();

/* =========================
   BUILD HEX
   ========================= */
let hexGroup = new THREE.Group(); scene.add(hexGroup);
let segMeshes = []; let centerMesh = null;
let labelMeshes = []; // not fully reimplemented (keeping text out for brevity)

function buildMaterial(opacity=1){
  const col = new THREE.Color(UI.geometry.color.value);
  return new THREE.MeshStandardMaterial({
    color: col, metalness:.35, roughness:.28,
    transparent: opacity<1, opacity, side:THREE.DoubleSide, envMapIntensity:1.0
  });
}

function rebuildHex(){
  const g=UI.geometry;
  const roundSteps=+g.round.value;
  const H=+g.relief.value/20;
  const rim=+g.rim.value/40;
  const ratio=+g.ratio.value/100;
  const T=+g.thick.value/20;

  scene.remove(hexGroup); hexGroup=new THREE.Group(); segMeshes=[];

  const outer = hexFlatTop(OUTER_R);
  const inner = hexFlatTop(OUTER_R*ratio);

  const gapWorld = +g.gap.value/20;
  for(let i=0;i<6;i++){
    const A=outer[i], B=outer[(i+1)%6], C=inner[(i+1)%6], D=inner[i];
    const geo = makeSegmentGeometryRounded(A,B,C,D, rim, H, T, roundSteps);
    const seg = new THREE.Mesh(geo, buildMaterial(UI.segments[i].opacity));

    const cx=(A.x+B.x+C.x+D.x)/4;
    const cy=(A.y+B.y+C.y+D.y)/4;
    const len=Math.hypot(cx,cy)||1;
    const extra=(gapWorld + (+UI.segments[i].gap||0)/20);
    seg.position.set((cx/len)*extra, (cy/len)*extra, 0);

    segMeshes.push(seg); hexGroup.add(seg);
  }

  centerMesh = new THREE.Mesh(makeCenterGeometryRounded(inner, rim, H, T, roundSteps), buildMaterial(UI.segments[6].opacity));
  hexGroup.add(centerMesh);

  // apply view rotation
  hexGroup.rotation.z = THREE.MathUtils.degToRad(+UI.view.rz.value);
  fitCamera();
}

function fitCamera(){
  const box = new THREE.Box3().setFromObject(hexGroup);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  const maxDim = Math.max(size.x,size.y,size.z);
  const fov = camera.fov*Math.PI/180;
  let dist = (maxDim/2)/Math.tan(fov/2); dist *= (1.35 / (+UI.view.scale.value));
  camera.position.set(center.x, center.y, dist);
  controls.target.copy(center);
  camera.near = dist/100; camera.far = dist*10; camera.updateProjectionMatrix();
}

// wheel -> scale
vp.addEventListener('wheel', (e)=>{
  e.preventDefault();
  const v = +UI.view.scale.value * (e.deltaY<0 ? 1.05 : 0.95);
  UI.view.scale.value = Math.min(2.5, Math.max(0.4, v));
  fitCamera();
}, {passive:false});

/* =========================
   POINTS & LABELS
   ========================= */
let pointsGroup = new THREE.Group(); scene.add(pointsGroup);
let anchorPoints = []; // {id,label,pos:Vector3, sprite}

function rebuildPoints(){
  // clear
  pointsGroup.children.slice().forEach(ch=>{ if (ch.material?.map) ch.material.map.dispose(); ch.material?.dispose?.(); pointsGroup.remove(ch); });
  anchorPoints = buildAnchorPoints(UI);
  for(const p of anchorPoints){
    const spr = makePointSprite(UI.points.showLabels.value ? p.id : "", "#FF3B3B");
    spr.position.copy(p.pos);
    pointsGroup.add(spr);
    p.sprite = spr;
  }
  pointsGroup.visible = !!UI.points.show.value;
}

/* =========================
   PATH (single, composite) + editor
   ========================= */
let pathCurve = null;
let pathLine = null;
let perStepRounding = [];

function rebuildPath(){
  if (pathLine){
    pathLine.geometry.dispose(); pathLine.material.dispose();
    pathLine.parent && pathLine.parent.remove(pathLine);
    pathLine = null;
  }
  const seq = UI.paths.steps; // [{toId, round}]
  if (!seq.length) return;

  // start from first element's fromId (if absent, start at first defined point)
  const pts=[];
  for (let i=0;i<seq.length;i++){
    const id = seq[i].toId;
    const p = anchorPoints.find(q=>q.id===id);
    if (p) pts.push(p.pos);
  }
  if (pts.length<2) return;

  perStepRounding = seq.map(s=> (s.round ?? null));
  pathCurve = buildCurveFromPointList(pts, +UI.paths.roundingGlobal.value, perStepRounding);

  // render polyline for debugging
  const geo = new THREE.BufferGeometry();
  const N = 400;
  const pos = new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const t=i/(N-1);
    const v=pathCurve.getPoint(t);
    pos[i*3]=v.x; pos[i*3+1]=v.y; pos[i*3+2]=v.z;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const mat = new THREE.LineBasicMaterial({ color: 0x00ccff, transparent:true, opacity:.5 });
  pathLine = new THREE.Line(geo, mat);
  scene.add(pathLine);
}

/* =========================
   PARTICLES (two flows)
   ========================= */
let flowA=null, flowB=null;

function rebuildParticles(){
  if (flowA){ flowA.dispose(); flowA=null; }
  if (flowB){ flowB.dispose(); flowB=null; }
  if (!pathCurve) return;
  const cnt = +UI.particles.count.value;
  flowA = new FlowParticles({
    scene, curve: pathCurve, color: UI.particles.flowA.value,
    size: +UI.particles.flowA.size.value, speed:+UI.particles.flowA.speed.value,
    lightPower:+UI.particles.flowA.light.value, count:cnt
  });
  flowB = new FlowParticles({
    scene, curve: pathCurve, color: UI.particles.flowB.value,
    size: +UI.particles.flowB.size.value, speed:+UI.particles.flowB.speed.value,
    lightPower:+UI.particles.flowB.light.value, count:cnt
  });
}

function tick(dt){
  if (flowA) flowA.update(dt, +1);
  if (flowB) flowB.update(dt, -1);
}

/* =========================
   UI: build panels
   ========================= */
const viewRows = document.getElementById('view-rows');
const geomRows = document.getElementById('geom-rows');
const typRows  = document.getElementById('typ-rows');
const pointsRows=document.getElementById('points-rows');
const pathsRows=document.getElementById('paths-rows');
const particlesRows=document.getElementById('particles-rows');

function onChange(id){
  if (id in UI.view){
    if (id==='rz') hexGroup.rotation.z = THREE.MathUtils.degToRad(+UI.view.rz.value);
    if (id==='scale') fitCamera();
    if (id==='rx' || id==='ry'){
      const rx = THREE.MathUtils.degToRad(+UI.view.rx.value);
      const ry = THREE.MathUtils.degToRad(+UI.view.ry.value);
      // lock orbit to match sliders once
      controls.minPolarAngle = controls.maxPolarAngle = THREE.MathUtils.clamp(rx + Math.PI/2, 0.01, Math.PI-0.01);
      controls.minAzimuthAngle = controls.maxAzimuthAngle = ry;
      controls.update();
      setTimeout(()=>{
        controls.minPolarAngle=0; controls.maxPolarAngle=Math.PI;
        controls.minAzimuthAngle=-Infinity; controls.maxAzimuthAngle=Infinity;
      },0);
    }
  }
  if (id in UI.geometry){
    rebuildHex(); rebuildPoints(); rebuildPath(); rebuildParticles();
  }
  if (id==='show' || id==='showLabels'){
    rebuildPoints();
  }
  if (id==='roundingGlobal' || id.startsWith('step-')){
    rebuildPath(); rebuildParticles();
  }
  if (id in UI.particles || id==='count'){
    rebuildParticles();
  }
  requestAnimationFrame(sizeRenderer);
}

function rowColor(container, id, cfg){
  const wrap = document.createElement('div'); wrap.className='row';
  const lab = document.createElement('label'); lab.textContent = cfg.label;
  const col = document.createElement('input'); col.type='color'; col.value=cfg.value;
  const hex = document.createElement('input'); hex.type='text'; hex.value=cfg.value;
  wrap.append(lab, col, hex); container.appendChild(wrap);
  const apply=v=>{ cfg.value=v; onChange(id); };
  col.addEventListener('input', ()=>apply(col.value));
  hex.addEventListener('input', ()=>{ const s=hex.value.replace('#',''); if(/^[0-9a-f]{6}$/i.test(s)){ apply('#'+s); hex.style.borderColor='#333'; } else { hex.style.borderColor='#a33'; } });
}

(function buildView(){
  rowRangeNumber(viewRows, 'scale', UI.view.scale, onChange);
  rowRangeNumber(viewRows, 'rx', UI.view.rx, onChange);
  rowRangeNumber(viewRows, 'ry', UI.view.ry, onChange);
  rowRangeNumber(viewRows, 'rz', UI.view.rz, onChange);
})();
(function buildGeom(){
  rowRangeNumber(geomRows, 'gap', UI.geometry.gap, onChange);
  rowRangeNumber(geomRows, 'relief', UI.geometry.relief, onChange);
  rowRangeNumber(geomRows, 'rim', UI.geometry.rim, onChange);
  rowRangeNumber(geomRows, 'round', UI.geometry.round, onChange);
  rowRangeNumber(geomRows, 'ratio', UI.geometry.ratio, onChange);
  rowRangeNumber(geomRows, 'thick', UI.geometry.thick, onChange);
  rowColor(geomRows, 'color', UI.geometry.color);
})();
(function buildPoints(){
  rowCheckbox(pointsRows, 'show', UI.points.show, onChange);
  rowCheckbox(pointsRows, 'showLabels', UI.points.showLabels, onChange);
  const list = document.createElement('div'); list.className='small';
  list.id='pts-list'; pointsRows.appendChild(list);
})();
(function buildPaths(){
  const r = rowRangeNumber(pathsRows, 'roundingGlobal', UI.paths.roundingGlobal, onChange);
  const list = document.createElement('div'); list.id='steps'; pathsRows.appendChild(list);

  const hdr = document.createElement('div'); hdr.className='path-steps';
  hdr.innerHTML = '<div class="hdr">To point ID</div><div class="hdr">Rounding</div><div></div><div></div>';
  list.appendChild(hdr);

  function refreshSteps(){
    // clear existing rows except header
    [...list.querySelectorAll('.step-row')].forEach(n=>n.remove());
    // add rows
    UI.paths.steps.forEach((s, idx)=>{
      const row = document.createElement('div'); row.className='path-steps step-row';
      const inpId = document.createElement('input'); inpId.type='text'; inpId.value=s.toId; inpId.placeholder='e.g. I1, O2, ...';
      const inpR = document.createElement('input'); inpR.type='number'; inpR.min=0; inpR.max=1; inpR.step=0.01; inpR.value=(s.round ?? '');
      const btnDel = document.createElement('button'); btnDel.className='btn'; btnDel.textContent='Delete';
      const btnAdd = document.createElement('button'); btnAdd.className='btn'; btnAdd.textContent='Add after';
      row.append(inpId, inpR, btnDel, btnAdd);
      list.appendChild(row);
      inpId.addEventListener('input', ()=>{ s.toId = inpId.value.trim(); onChange('step-'+idx); });
      inpR.addEventListener('input', ()=>{ const v=inpR.value===''? null : Math.max(0, Math.min(1, +inpR.value)); s.round = (v===null? null : v); onChange('step-'+idx); });
      btnDel.addEventListener('click', ()=>{ UI.paths.steps.splice(idx,1); refreshSteps(); onChange('roundingGlobal'); });
      btnAdd.addEventListener('click', ()=>{ UI.paths.steps.splice(idx+1, 0, {toId:'', round:null}); refreshSteps(); });
    });
    // controls
    const ctrl = document.createElement('div'); ctrl.style.marginTop='8px';
    const add = document.createElement('button'); add.className='btn'; add.textContent='Add point';
    const build = document.createElement('button'); build.className='btn'; build.textContent='Rebuild path';
    ctrl.append(add, build); list.appendChild(ctrl);
    add.addEventListener('click', ()=>{ UI.paths.steps.push({toId:'', round:null}); refreshSteps(); });
    build.addEventListener('click', ()=>{ onChange('roundingGlobal'); });
  }
  pathsRows._refreshSteps = refreshSteps;
})();
(function buildParticles(){
  rowRangeNumber(particlesRows, 'count', UI.particles.count, onChange);
  // Flow A
  rowRangeNumber(particlesRows, 'sizeA', UI.particles.flowA.size, onChange);
  rowRangeNumber(particlesRows, 'speedA', UI.particles.flowA.speed, onChange);
  rowRangeNumber(particlesRows, 'lightA', UI.particles.flowA.light, onChange);
  const ca = document.createElement('div'); particlesRows.appendChild(ca); ca.style.marginBottom='8px';
  (function rowColorA(){ const wrap=document.createElement('div'); wrap.className='row'; const lab=document.createElement('label'); lab.textContent='Color A'; const col=document.createElement('input'); col.type='color'; col.value=UI.particles.flowA.value; const hex=document.createElement('input'); hex.type='text'; hex.value=UI.particles.flowA.value; wrap.append(lab,col,hex); ca.appendChild(wrap); const apply=v=>{ UI.particles.flowA.value=v; onChange('flowA'); }; col.addEventListener('input',()=>apply(col.value)); hex.addEventListener('input',()=>{ const s=hex.value.replace('#',''); if(/^[0-9a-f]{6}$/i.test(s)){ apply('#'+s); hex.style.borderColor='#333'; } else { hex.style.borderColor='#a33'; } }); })();
  // Flow B
  rowRangeNumber(particlesRows, 'sizeB', UI.particles.flowB.size, onChange);
  rowRangeNumber(particlesRows, 'speedB', UI.particles.flowB.speed, onChange);
  rowRangeNumber(particlesRows, 'lightB', UI.particles.flowB.light, onChange);
  const cb = document.createElement('div'); particlesRows.appendChild(cb);
  (function rowColorB(){ const wrap=document.createElement('div'); wrap.className='row'; const lab=document.createElement('label'); lab.textContent='Color B'; const col=document.createElement('input'); col.type='color'; col.value=UI.particles.flowB.value; const hex=document.createElement('input'); hex.type='text'; hex.value=UI.particles.flowB.value; wrap.append(lab,col,hex); cb.appendChild(wrap); const apply=v=>{ UI.particles.flowB.value=v; onChange('flowB'); }; col.addEventListener('input',()=>apply(col.value)); hex.addEventListener('input',()=>{ const s=hex.value.replace('#',''); if(/^[0-9a-f]{6}$/i.test(s)){ apply('#'+s); hex.style.borderColor='#333'; } else { hex.style.borderColor='#a33'; } }); })();
})();

/* panel toggles (all hidden by default per requirement) */
[['toggle-view','view-ui'],['toggle-geom','geom-ui'],['toggle-typ','typ-ui'],['toggle-points','points-ui'],['toggle-paths','paths-ui'],['toggle-particles','particles-ui']]
.forEach(([chk,panel])=>{
  const c=document.getElementById(chk); const p=document.getElementById(panel);
  c.checked=false; p.classList.add('hidden');
  c.addEventListener('change', ()=>{ p.classList.toggle('hidden', !c.checked); requestAnimationFrame(sizeRenderer); });
});

/* =========================
   INITIALIZE
   ========================= */
rebuildHex();
rebuildPoints();
document.getElementById('paths-rows')._refreshSteps();
// default path: go through inner points clockwise
UI.paths.steps = ['I1','I2','I3','I4','I5','I6'].map(id=>({toId:id, round:null}));
document.getElementById('paths-rows')._refreshSteps();
rebuildPath();
rebuildParticles();

/* sync sliders with orbit */
let suppress=false;
controls.addEventListener('change', ()=>{
  if (suppress) return;
  const az=controls.getAzimuthalAngle();
  const pol=controls.getPolarAngle();
  const rxDeg=THREE.MathUtils.radToDeg(pol - Math.PI/2);
  const ryDeg=THREE.MathUtils.radToDeg(az);
  suppress=true;
  UI.view.rx.value=rxDeg; UI.view.ry.value=ryDeg;
  suppress=false;
});

/* loop */
let t0=performance.now();
function loop(){
  const t=performance.now(); const dt=(t-t0)/1000; t0=t;
  controls.update();
  tick(dt);
  renderer.render(scene,camera);
  requestAnimationFrame(loop);
}
loop();

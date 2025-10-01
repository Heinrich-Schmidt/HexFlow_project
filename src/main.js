// src/main.js
import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { RoomEnvironment } from 'RoomEnvironment';
import { DEFAULTS } from './config.js';
import { buildHex } from './geometry.js';
import { computeAnchors, anchorsToList, makeAnchorMesh, labelSprite } from './anchors.js';
import { buildPath, makePathLine } from './paths.js';
import { makeParticlesForPath } from './particles.js';
import { rowRange, rowSelect, rowCheckbox, rowColor, rowButton } from './ui.js';

// ===== Scene / renderer =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(0,0,10);
const renderer = new THREE.WebGLRenderer({antialias:true});
const vp = document.getElementById('viewport'); vp.appendChild(renderer.domElement);
const DPR = Math.min(2.5, window.devicePixelRatio||1);
renderer.setPixelRatio(DPR);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.physicallyCorrectLights = true;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.02).texture;
function size(){ const w=vp.clientWidth, h=vp.clientHeight||1; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
new ResizeObserver(size).observe(vp); addEventListener('resize', size); size();
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=.08; controls.enablePan=false; controls.rotateSpeed=.8;

// lights
const key = new THREE.DirectionalLight(0xffffff, .8);
const fill= new THREE.DirectionalLight(0xffffff, 1.08);
const amb = new THREE.AmbientLight(0xffffff, .6);
scene.add(key, fill, amb);
function setDir(light, az=120, el=40, dist=12){
  const a=THREE.MathUtils.degToRad(az), e=THREE.MathUtils.degToRad(el);
  light.position.set(dist*Math.cos(e)*Math.cos(a), dist*Math.sin(e), dist*Math.cos(e)*Math.sin(a));
}
setDir(key,105,42); setDir(fill,162,51,16);

// ===== State =====
const state = {
  geometry: {...DEFAULTS.geometry},
  rotation: {...DEFAULTS.rotation},
  anchors: {...DEFAULTS.anchors},
  paths: JSON.parse(JSON.stringify(DEFAULTS.paths)),
  particles: JSON.parse(JSON.stringify(DEFAULTS.particles)),
  view: {...DEFAULTS.view},
  segments: Array.from({length:7}, (_,i)=>({opacity: i===5||i===6 ? 1 : 0.55, gap:0})), // simple
  color: DEFAULTS.appearance.color
};

// material builder
function buildMaterial(opacity=1){
  return new THREE.MeshPhysicalMaterial({
    color: state.color, metalness:.35, roughness:.26, clearcoat:.6, clearcoatRoughness:.4,
    transmission:.9, ior:1.8, thickness:2.2, envMapIntensity:1.0,
    transparent:true, opacity, side:THREE.DoubleSide
  });
}

// containers
let hexObj=null;
let anchorObjs=[]; // {id, cross, label}
const anchorsGroup = new THREE.Group(); scene.add(anchorsGroup);
const pathsGroup = new THREE.Group(); scene.add(pathsGroup);
const particlesGroup = new THREE.Group(); scene.add(particlesGroup);
let particleItems=[];

// ===== Build/update =====
function fitCameraTo(obj){
  const box=new THREE.Box3().setFromObject(obj);
  const size=new THREE.Vector3(); box.getSize(size);
  const center=new THREE.Vector3(); box.getCenter(center);
  const maxDim=Math.max(size.x,size.y,size.z), fov=camera.fov*(Math.PI/180);
  let dist=(maxDim/2)/Math.tan(fov/2); dist*=1.35/state.view.scale;
  camera.position.set(center.x, center.y, dist);
  camera.near=dist/100; camera.far=dist*10; camera.updateProjectionMatrix();
  controls.target.copy(center);
}

function rebuildHex(){
  if (hexObj) scene.remove(hexObj.group);
  const opacitys = state.segments.map(s=>s.opacity);
  hexObj = buildHex(
    {ratio:state.geometry.ratio, rim:state.geometry.rim, relief:state.geometry.relief, thick:state.geometry.thick, gap:state.geometry.gap, round:state.geometry.round, opacitys, color:state.color},
    buildMaterial
  );
  scene.add(hexObj.group);
  hexObj.group.rotation.z = THREE.MathUtils.degToRad(state.rotation.rz||0);
  fitCameraTo(hexObj.group);
  updateAnchors(); // rebuild anchors/paths relative
  rebuildPaths();
  rebuildParticles();
}

function updateAnchors(){
  anchorsGroup.clear(); anchorObjs=[];
  const info = computeAnchors({ ratio:state.geometry.ratio, gap:state.geometry.gap }, state.segments.map(s=>s.gap||0));
  const list = anchorsToList(info);
  const zBack = -state.geometry.thick/20 - 0.01;
  list.forEach(a=>{
    const cross=makeAnchorMesh(state.anchors.size, state.anchors.color);
    cross.position.set(a.pos.x,a.pos.y,zBack);
    const label=labelSprite(a.id, "#ff4455");
    cross.add(label);
    anchorsGroup.add(cross);
    anchorObjs.push({id:a.id, cross, pos:new THREE.Vector3(a.pos.x,a.pos.y,zBack)});
    label.visible = !!state.anchors.showLabels;
  });
  anchorsGroup.visible = !!state.anchors.show;
  // also expose for path find
  state._anchorIndex = Object.fromEntries(anchorObjs.map(o=>[o.id,o]));
}

function pathFromIds(fromId, toId){
  const a=state._anchorIndex[fromId], b=state._anchorIndex[toId];
  if (!a || !b) return null;
  return buildPath(a.pos, b.pos, {bend:.35, zBack:a.pos.z});
}

function rebuildPaths(){
  pathsGroup.clear();
  if (!state.paths.show) return;
  state.paths.list.forEach(p=>{
    const curve = pathFromIds(p.from, p.to);
    if (!curve) return;
    const line = makePathLine(curve, 0x55ffff);
    pathsGroup.add(line);
    p._curve = curve;
  });
}

function rebuildParticles(){
  particlesGroup.clear(); particleItems=[];
  if (!state.particles.enabled) return;
  state.paths.list.forEach(p=>{
    if (!p._curve) return;
    const palette = {
      speed: state.particles.speed,
      size: state.particles.size,
      trail: state.particles.trail,
      light: state.particles.light
    };
    const {group, items} = makeParticlesForPath(p._curve, Math.max(1, Math.floor(state.particles.countPerPath/4)), palette);
    particlesGroup.add(group); particleItems.push(...items);
  });
}

function animate(ts){
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, (renderer.info.render.frame? 0.016 : 0.016));
  particleItems.forEach(p=>p.step(dt));
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// ===== UI =====
function togglePanel(chkId, panelId){
  const c=document.getElementById(chkId), p=document.getElementById(panelId);
  c.addEventListener('change', ()=> p.classList.toggle('hidden', !c.checked));
}

togglePanel('tg-geom','geom-ui');
togglePanel('tg-light','light-ui');
togglePanel('tg-seg','seg-ui');
togglePanel('tg-anc','anc-ui');
togglePanel('tg-path','path-ui');
togglePanel('tg-part','part-ui');
togglePanel('tg-view','view-ui');
// Start hidden by default (per requirement)

// Geometry UI
(function(){
  const r=document.getElementById('geom-rows');
  rowRange(r,'g-gap','Gap',0,10,0.1,state.geometry.gap,(v)=>{state.geometry.gap=v; rebuildHex();});
  rowRange(r,'g-relief','Relief (H)',0,80,1,state.geometry.relief,(v)=>{state.geometry.relief=v; rebuildHex();});
  rowRange(r,'g-rim','Rim width',0,60,1,state.geometry.rim,(v)=>{state.geometry.rim=v; rebuildHex();});
  rowRange(r,'g-round','Roundness',1,100,1,state.geometry.round,(v)=>{state.geometry.round=v; rebuildHex();});
  rowRange(r,'g-ratio','Center ratio',10,60,0.5,state.geometry.ratio,(v)=>{state.geometry.ratio=v; rebuildHex();});
  rowRange(r,'g-thick','Thickness down',0,30,1,state.geometry.thick,(v)=>{state.geometry.thick=v; rebuildHex();});
})();

// Anchors UI
(function(){
  const r=document.getElementById('anc-rows');
  rowCheckbox(r,'anc-show','Show anchors',state.anchors.show,(v)=>{state.anchors.show=v; anchorsGroup.visible=v;});
  rowCheckbox(r,'anc-labels','Show labels',state.anchors.showLabels,(v)=>{state.anchors.showLabels=v; anchorObjs.forEach(a=> a.cross.children[0].visible=v );});
  rowRange(r,'anc-size','Anchor size',0.02,0.2,0.005,state.anchors.size,(v)=>{state.anchors.size=v; anchorObjs.forEach(a=>a.cross.scale.setScalar(v));});
  rowColor(r,'anc-col','Anchor color','#ff3040',(v)=>{ anchorObjs.forEach(a=>a.cross.material.color.set(v));});
  // helper to list anchors
  const list=document.createElement('div'); list.className='small'; r.appendChild(list);
  function refreshList(){ list.textContent='IDs: ' + anchorObjs.map(a=>a.id).join(', '); }
  refreshList();
})();

// Paths UI
(function(){
  const r=document.getElementById('path-rows');
  rowCheckbox(r,'p-show','Show paths',state.paths.show,(v)=>{state.paths.show=v; rebuildPaths();});
  // simple table-like editor
  const grid=document.createElement('div'); grid.className='grid';
  grid.innerHTML='<div class="hdr">ID</div><div class="hdr">From</div><div class="hdr">To</div><div class="hdr"></div>';
  r.appendChild(grid);

  function renderList(){
    // clear dynamic rows
    [...grid.querySelectorAll('.row-item')].forEach(n=>n.remove());
    state.paths.list.forEach((p,idx)=>{
      const row=document.createElement('div'); row.className='row-item'; row.style.display='contents';
      const id=document.createElement('input'); id.type='text'; id.value=p.id||('path'+idx);
      const sFrom=document.createElement('select'), sTo=document.createElement('select');
      const ids = anchorObjs.map(a=>a.id);
      ids.forEach(idv=>{ const o=document.createElement('option'); o.value=idv; o.textContent=idv; sFrom.appendChild(o.cloneNode(true)); sTo.appendChild(o); });
      sFrom.value=p.from; sTo.value=p.to;
      const btn=document.createElement('button'); btn.className='btn'; btn.textContent='Delete';
      [id,sFrom,sTo,btn].forEach(el=>grid.appendChild(el));
      btn.addEventListener('click',()=>{ state.paths.list.splice(idx,1); rebuildPaths(); renderList(); });
      id.addEventListener('input',()=>{p.id=id.value;});
      sFrom.addEventListener('change',()=>{p.from=sFrom.value; rebuildPaths();});
      sTo.addEventListener('change',()=>{p.to=sTo.value; rebuildPaths();});
    });
  }
  renderList();
  rowButton(r,'Add path',()=>{ state.paths.list.push({id:'path'+(state.paths.list.length+1), from:'P0', to:'C0', type:'auto', bend:.35}); rebuildPaths(); renderList(); });
})();

// Particles UI
(function(){
  const r=document.getElementById('part-rows');
  rowCheckbox(r,'pt-en','Enable',state.particles.enabled,(v)=>{state.particles.enabled=v; rebuildParticles();});
  rowRange(r,'pt-count','Count per path',1,300,1,state.particles.countPerPath,(v)=>{state.particles.countPerPath=v; rebuildParticles();});
  rowRange(r,'pt-speed','Speed',0.05,2.0,0.01,state.particles.speed,(v)=>{state.particles.speed=v; rebuildParticles();});
  rowRange(r,'pt-size','Size',0.01,0.2,0.005,state.particles.size,(v)=>{state.particles.size=v; rebuildParticles();});
  rowRange(r,'pt-trail','Trail length',0,20,1,state.particles.trail,(v)=>{state.particles.trail=v; rebuildParticles();});
  rowCheckbox(r,'pt-light','Light enabled',state.particles.light.enabled,(v)=>{state.particles.light.enabled=v; rebuildParticles();});
  rowRange(r,'pt-li','Light intensity',0,3,0.05,state.particles.light.intensity,(v)=>{state.particles.light.intensity=v; rebuildParticles();});
  rowRange(r,'pt-ld','Light distance',0.2,5,0.1,state.particles.light.distance,(v)=>{state.particles.light.distance=v; rebuildParticles();});
})();

// View UI
(function(){
  const r=document.getElementById('view-rows');
  rowRange(r,'vw-scale','Scale (wheel)',0.5,2.0,0.01,state.view.scale,(v)=>{state.view.scale=v; fitCameraTo(hexObj.group);});
  // wheel handler
  vp.addEventListener('wheel', (e)=>{
    e.preventDefault();
    const s=state.view.scale * (e.deltaY<0 ? 1.05 : 0.95);
    state.view.scale = THREE.MathUtils.clamp(s, 0.5, 2.0);
    document.getElementById('vw-scale').value = state.view.scale;
    fitCameraTo(hexObj.group);
  }, {passive:false});
})();

// initial build
rebuildHex();

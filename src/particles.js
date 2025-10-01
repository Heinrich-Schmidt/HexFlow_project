// src/particles.js
import * as THREE from 'three';

// Simple particle along a curve with trail "ghosts"
export class FlowAlongCurve {
  constructor(curve, opts){
    this.curve = curve;
    this.t = Math.random();
    this.speed = opts.speed || 0.3;
    this.color = new THREE.Color(opts.color||0xffffff);
    this.size = opts.size || 0.06;
    this.trail = Math.max(0, opts.trail||0);
    this.group = new THREE.Group();

    // point sprite
    const tex = makeDotTexture();
    this.mat = new THREE.PointsMaterial({map:tex, alphaTest:0.1, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, size:this.size, sizeAttenuation:true, color:this.color});
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((this.trail+1)*3),3));
    this.points = new THREE.Points(this.geo, this.mat);
    this.group.add(this.points);

    // optional light
    if (opts.light && opts.light.enabled){
      this.light = new THREE.PointLight(opts.light.color||this.color.getHex(), opts.light.intensity||0.6, opts.light.distance||1.2);
      this.group.add(this.light);
    }
  }
  step(dt){
    this.t = (this.t + dt*this.speed) % 1;
    const positions = this.geo.attributes.position.array;
    for(let i=0;i<=this.trail;i++){
      const tt = (this.t - i*0.02 + 1) % 1;
      const p = this.curve.getPoint(tt);
      positions[i*3+0]=p.x; positions[i*3+1]=p.y; positions[i*3+2]=p.z;
      if (this.light && i===0){ this.light.position.copy(p); }
    }
    this.geo.attributes.position.needsUpdate = true;
    // fade trail by changing material opacity slightly
    this.mat.opacity = 0.35 + 0.35*Math.sin((performance.now()%1000)/1000*Math.PI*2);
  }
}

function makeDotTexture(){
  const s=64; const c=document.createElement('canvas'); c.width=c.height=s;
  const ctx=c.getContext('2d'); const g=ctx.createRadialGradient(s/2,s/2,0, s/2,s/2,s/2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(s/2,s/2,s/2,0,Math.PI*2); ctx.fill();
  const tex=new THREE.CanvasTexture(c); tex.anisotropy=16; return tex;
}

export function makeParticlesForPath(curve, count, palette){
  const group=new THREE.Group();
  const items=[];
  for(let i=0;i<count;i++){
    const item=new FlowAlongCurve(curve, palette);
    group.add(item.group);
    items.push(item);
  }
  return {group, items};
}

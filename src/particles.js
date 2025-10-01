import * as THREE from 'three';

/** Simple particle system that moves N head sprites along a given path, with optional trailing */
export class FlowParticles {
  constructor({scene, curve, color='#ffffff', size=0.06, speed=0.25, lightPower=0, count=30}){
    this.scene=scene;
    this.curve=curve;
    this.color=color;
    this.size=size;
    this.speed=speed;
    this.count=count;
    this.offsets = new Float32Array(count); // 0..1 positions along curve
    for(let i=0;i<count;i++) this.offsets[i] = (i/count);
    this.group = new THREE.Group();
    scene.add(this.group);

    this.sprites=[];
    for(let i=0;i<count;i++){
      const mat = new THREE.SpriteMaterial({ color: new THREE.Color(color), transparent:true, opacity:1, blending:THREE.AdditiveBlending });
      const spr = new THREE.Sprite(mat);
      spr.scale.set(size,size,1);
      this.group.add(spr);
      this.sprites.push(spr);
    }

    this.lightPower = lightPower;
    this.pointLight = null;
    if (lightPower>0){
      this.pointLight = new THREE.PointLight(new THREE.Color(color), lightPower, 2.5, 2);
      this.group.add(this.pointLight);
    }
  }

  setCurve(curve){ this.curve=curve; }
  setColor(color){
    this.color=color;
    this.sprites.forEach(s=>s.material.color.set(color));
    if (this.pointLight) this.pointLight.color.set(color);
  }
  setSize(size){ this.size=size; this.sprites.forEach(s=>s.scale.set(size,size,1)); }
  setSpeed(speed){ this.speed=speed; }
  setLightPower(p){ this.lightPower=p; if (this.pointLight){ this.pointLight.intensity=p; } else if (p>0){ this.pointLight = new THREE.PointLight(new THREE.Color(this.color), p, 2.5, 2); this.group.add(this.pointLight);} }

  update(dt, direction=1){
    if (!this.curve) return;
    for(let i=0;i<this.count;i++){
      let u = this.offsets[i];
      u += direction*this.speed*dt;
      if (u>1) u-=1;
      if (u<0) u+=1;
      this.offsets[i]=u;
      const p = this.curve.getPoint(u);
      this.sprites[i].position.copy(p);
    }
    if (this.pointLight){
      const headU = this.offsets[this.count-1];
      const p = this.curve.getPoint(headU);
      this.pointLight.position.copy(p);
    }
  }

  dispose(){
    this.sprites.forEach(s=>s.material.dispose());
    this.group.parent && this.group.parent.remove(this.group);
  }
}

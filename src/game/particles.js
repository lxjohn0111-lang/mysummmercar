import * as THREE from 'three';

// Lightweight soft-particle system (smoke, dust, steam, splashes) using a single Points draw call.
export class Particles {
  constructor(scene, max = 600) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    this.p = [];
    for (let i = 0; i < max; i++) this.p.push({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, s0: 0.2, grow: 1, a0: 0.3, drag: 0.5, grav: 0 });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uScale: { value: 600 }, uLight: { value: 1 }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0.001 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, vertexColors: true,
      vertexShader: `attribute float alpha; attribute float size; varying float vA; varying vec3 vC; varying float vD; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uScale / max(0.1, -mv.z); vA = alpha; vC = color; vD = -mv.z; }`,
      fragmentShader: `varying float vA; varying vec3 vC; varying float vD; uniform float uLight; uniform vec3 fogColor; uniform float fogDensity;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d)*4.0; if (r > 1.0) discard; float a = vA * (1.0 - r) * (1.0 - r);
          vec3 c = vC * uLight; float f = 1.0 - exp(-fogDensity*fogDensity*vD*vD); c = mix(c, fogColor, f);
          gl_FragColor = vec4(c, a);
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
    this.next = 0;
    this._c = new THREE.Color();
  }
  emit(pos, { color = 0xffffff, alpha = 0.3, size = 0.3, grow = 1.5, life = 2, vel = null, drag = 0.6, grav = 0 } = {}) {
    const i = this.next; this.next = (this.next + 1) % this.max;
    const p = this.p[i];
    p.life = life; p.max = life; p.s0 = size; p.grow = grow; p.a0 = alpha; p.drag = drag; p.grav = grav;
    p.vx = vel ? vel.x : 0; p.vy = vel ? vel.y : 0.3; p.vz = vel ? vel.z : 0;
    this.pos[i * 3] = pos.x; this.pos[i * 3 + 1] = pos.y; this.pos[i * 3 + 2] = pos.z;
    this._c.setHex(color).convertSRGBToLinear();
    this.col[i * 3] = this._c.r; this.col[i * 3 + 1] = this._c.g; this.col[i * 3 + 2] = this._c.b;
  }
  update(dt, game) {
    const P = this.pos;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life <= 0) { this.alpha[i] = 0; continue; }
      p.life -= dt;
      const k = 1 - p.life / p.max;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d - p.grav * dt; p.vz *= d;
      P[i * 3] += p.vx * dt; P[i * 3 + 1] += p.vy * dt; P[i * 3 + 2] += p.vz * dt;
      this.size[i] = p.s0 * (1 + k * p.grow);
      this.alpha[i] = p.a0 * Math.min(1, k * 8) * (1 - k);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.alpha.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.color.needsUpdate = true;
    this.uniforms.uScale.value = window.innerHeight * 0.9;
    if (game) {
      this.uniforms.uLight.value = 0.25 + game.sky.daylight * 0.85;
      this.uniforms.fogColor.value.copy(game.scene.fog.color);
      this.uniforms.fogDensity.value = game.scene.fog.density;
    }
  }
}

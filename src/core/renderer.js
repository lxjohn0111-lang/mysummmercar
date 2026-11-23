import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';

export const QUALITY = [
  { name: 'Low', pixelRatio: 0.75, shadows: false, shadowSize: 1024, bloom: false, msaa: 0, veg: 0, direct: true },
  { name: 'Medium', pixelRatio: 0.9, shadows: true, shadowSize: 1024, bloom: false, msaa: 0, veg: 1 },
  { name: 'High', pixelRatio: 1.0, shadows: true, shadowSize: 2048, bloom: true, msaa: 4, veg: 2 },
  { name: 'Ultra', pixelRatio: 1.5, shadows: true, shadowSize: 4096, bloom: true, msaa: 4, veg: 3 },
];

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uDrunk: { value: 0 }, uVignette: { value: 0.35 }, uGrain: { value: 0.035 },
    uFade: { value: 0 }, uHurt: { value: 0 }, uWater: { value: 0 }, uBlur: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uSat: { value: 1.05 }, uSleepy: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uDrunk, uVignette, uGrain, uFade, uHurt, uWater, uBlur, uSat, uSleepy; uniform vec2 uRes;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    vec3 samp(vec2 uv){
      vec3 c = texture2D(tDiffuse, uv).rgb;
      if (uBlur > 0.001) {
        vec2 px = uBlur * 3.0 / uRes;
        c = c * 0.4 + (texture2D(tDiffuse, uv + vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, uv - vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, uv + vec2(0.0, px.y)).rgb + texture2D(tDiffuse, uv - vec2(0.0, px.y)).rgb) * 0.15;
      }
      return c;
    }
    void main(){
      vec2 uv = vUv;
      if (uDrunk > 0.0) {
        uv += vec2(sin(uv.y * 6.0 + uTime * 1.3), cos(uv.x * 5.0 + uTime * 1.1)) * 0.006 * uDrunk;
      }
      if (uWater > 0.0) uv += vec2(sin(uv.y * 30.0 + uTime * 3.0), cos(uv.x * 25.0 + uTime * 2.0)) * 0.004 * uWater;
      vec3 col = samp(uv);
      if (uDrunk > 0.0) {
        vec2 off = vec2(sin(uTime * 0.7), cos(uTime * 0.53)) * 0.012 * uDrunk;
        col = mix(col, samp(uv + off), 0.45 * min(1.0, uDrunk));
      }
      // saturation / grade
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSat);
      col = mix(col, col * vec3(1.03, 1.0, 0.95), 0.5);
      if (uWater > 0.0) col = mix(col, vec3(0.05, 0.14, 0.12) + col * 0.3, 0.6 * uWater);
      // vignette
      vec2 d = vUv - 0.5;
      float v = 1.0 - dot(d, d) * (uVignette + uSleepy * 2.5 + uHurt * 1.5) * 2.0;
      col *= clamp(v, 0.0, 1.0);
      col = mix(col, vec3(0.6, 0.0, 0.0), uHurt * 0.35 * smoothstep(0.1, 0.7, length(d)));
      // grain
      col += (h(vUv * uRes + fract(uTime * 7.31)) - 0.5) * uGrain;
      col = mix(col, vec3(0.0), uFade);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.7;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.build(QUALITY[2]);
  }
  build(q) {
    const r = this.renderer;
    this.direct = !!q.direct;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.msaa });
    if (this.composer) this.composer.dispose();
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.22, 0.5, 0.92);
    this.bloom.enabled = q.bloom;
    this.composer.addPass(this.bloom);
    this.after = new AfterimagePass(0.0);
    this.after.enabled = false;
    this.composer.addPass(this.after);
    this.composer.addPass(new OutputPass());
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
    this.resize();
  }
  resize() {
    const r = this.renderer;
    const w = window.innerWidth, h = window.innerHeight;
    r.setSize(w, h, false);
    this.composer.setPixelRatio(r.getPixelRatio());
    this.composer.setSize(w, h);
    const s = r.getDrawingBufferSize(new THREE.Vector2());
    this.final.uniforms.uRes.value.set(s.x, s.y);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  render(dt, fx) {
    const u = this.final.uniforms;
    u.uTime.value += dt;
    u.uDrunk.value = fx.drunk; u.uFade.value = fx.fade; u.uHurt.value = fx.hurt; u.uWater.value = fx.water; u.uBlur.value = fx.blur; u.uSleepy.value = fx.sleepy;
    const trail = Math.min(0.88, fx.drunk * 0.5);
    this.after.enabled = trail > 0.05;
    this.after.uniforms.damp.value = trail;
    // Low quality never uses the post chain: switching between direct and post-processed rendering makes
    // three.js recompile every material's shader at once (a multi-second freeze). Screen effects are drawn
    // by a cheap HTML overlay instead (see Game.renderFrame).
    if (this.direct) { this.renderer.setRenderTarget(null); this.renderer.render(this.scene, this.camera); return; }
    this.composer.render(dt);
  }
}

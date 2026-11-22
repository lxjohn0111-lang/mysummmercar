import * as THREE from 'three';
import { tex } from '../core/assets.js';
import { WATER_LEVEL, LAKE_BLOBS, MAP_SIZE } from './layout.js';

// Lake surface: env reflections, fresnel, scrolling normals, shoreline-aware depth tint, forest-line reflection trick.
export class Water {
  constructor(game) {
    this.game = game;
    const T = game.terrain;
    const geo = new THREE.PlaneGeometry(1500, 1400, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(-180, WATER_LEVEL, 20);
    const nt = tex('water_n.jpg', { srgb: false });
    this.uniforms = {
      uTime: { value: 0 }, tNormal: { value: nt }, uHeight: { value: T.heightTex }, uMapSize: { value: MAP_SIZE },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color(1, 1, 1) },
      uSkyTop: { value: new THREE.Color(0.35, 0.55, 0.85) }, uSkyHorizon: { value: new THREE.Color(0.7, 0.8, 0.9) },
      uForest: { value: new THREE.Color(0.05, 0.08, 0.04) }, uDeep: { value: new THREE.Color(0.02, 0.05, 0.05) },
      uShallow: { value: new THREE.Color(0.18, 0.16, 0.1) }, uRain: { value: 0 }, uWaterLevel: { value: WATER_LEVEL },
      fogColor: { value: new THREE.Color() }, fogDensity: { value: 0.001 }, uEnv: { value: null }, uHasEnv: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: true, fog: false,
      vertexShader: `
        varying vec3 vW; varying vec4 vClip;
        void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; vClip = gl_Position; }`,
      fragmentShader: `
        uniform float uTime, uMapSize, uRain, uWaterLevel, fogDensity, uHasEnv;
        uniform sampler2D tNormal, uHeight; uniform samplerCube uEnv;
        uniform vec3 uSunDir, uSunColor, uSkyTop, uSkyHorizon, uForest, uDeep, uShallow, fogColor;
        varying vec3 vW; varying vec4 vClip;
        void main(){
          vec2 uv = vW.xz;
          vec3 n1 = texture2D(tNormal, uv / 22.0 + vec2(uTime * 0.012, uTime * 0.008)).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(tNormal, uv / 9.0 - vec2(uTime * 0.018, -uTime * 0.01)).xyz * 2.0 - 1.0;
          vec3 n3 = texture2D(tNormal, uv / 3.1 + vec2(uTime * 0.03, uTime * 0.025)).xyz * 2.0 - 1.0;
          vec3 nn = normalize(vec3(n1.xy * 0.5 + n2.xy * 0.35 + n3.xy * (0.15 + uRain * 0.8), 1.0));
          vec3 N = normalize(vec3(nn.x, nn.z * 5.0, nn.y));
          vec3 V = normalize(cameraPosition - vW);
          float dist = length(cameraPosition - vW);
          N = normalize(mix(N, vec3(0.0, 1.0, 0.0), smoothstep(60.0, 700.0, dist) * 0.7));
          vec3 R = reflect(-V, N);
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          // sky reflection
          vec3 sky = uHasEnv > 0.5 ? textureCube(uEnv, vec3(-R.x, R.y, R.z)).rgb : mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.5, R.y));
          // dark forest silhouette reflected near the horizon
          float fl = smoothstep(0.075, 0.015, R.y + sin(atan(R.z, R.x) * 23.0) * 0.006 + sin(atan(R.z, R.x) * 61.0) * 0.004);
          vec3 refl = mix(sky, uForest * (0.5 + 0.5 * uSunColor), fl * 0.92);
          // depth from terrain height
          vec2 suv = (vW.xz + uMapSize * 0.5) / uMapSize;
          float th = texture2D(uHeight, suv).r;
          float depth = max(0.0, uWaterLevel - th);
          vec3 body = mix(uShallow, uDeep, smoothstep(0.2, 3.5, depth)) * (0.4 + 0.6 * uSunColor);
          vec3 col = mix(body, refl, fres);
          // sun glitter
          vec3 H = normalize(uSunDir + V);
          float spec = pow(max(dot(N, H), 0.0), 600.0) * 18.0 + pow(max(dot(N, H), 0.0), 60.0) * 0.25;
          col += uSunColor * spec * step(0.0, uSunDir.y);
          float alpha = smoothstep(0.0, 0.6, depth) * 0.75 + 0.25 * fres;
          alpha = clamp(alpha + fres * 0.5, 0.0, 0.97);
          // fog (exp2)
          float f = 1.0 - exp(-fogDensity * fogDensity * dist * dist);
          col = mix(col, fogColor, f);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = 2;
    game.scene.add(this.mesh);
    this.material = mat;
  }

  update(dt, sky) {
    const u = this.uniforms;
    u.uTime.value += dt;
    if (sky) {
      u.uSunDir.value.copy(sky.sunDir);
      u.uSunColor.value.copy(sky.sunLightColor).multiplyScalar(Math.max(0.05, sky.sunIntensity / 3));
      u.uSkyTop.value.copy(sky.zenithColor);
      u.uSkyHorizon.value.copy(sky.horizonColor);
      u.fogColor.value.copy(this.game.scene.fog.color);
      u.fogDensity.value = this.game.scene.fog.density;
      u.uRain.value = sky.rain;
      u.uForest.value.setRGB(0.03, 0.05, 0.025).multiplyScalar(0.4 + sky.daylight * 0.8);
      if (sky.envCube) { u.uEnv.value = sky.envCube; u.uHasEnv.value = 1; }
    }
  }

  // Is a world position under water?
  depthAt(x, y, z) {
    if (y > WATER_LEVEL) return 0;
    const th = this.game.terrain.getHeight(x, z);
    if (th > WATER_LEVEL) return 0;
    return WATER_LEVEL - y;
  }
}

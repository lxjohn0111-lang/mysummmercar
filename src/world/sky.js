import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { tex } from '../core/assets.js';
import { clamp, lerp, smooth, rand } from '../core/util.js';
import { audio } from '../core/audio.js';

const LAT = THREE.MathUtils.degToRad(62.2);
const DEC = THREE.MathUtils.degToRad(21.5);

// Time of day, weather, sky, clouds, stars, sun light and environment lighting.
export class SkySystem {
  constructor(game) {
    this.game = game;
    const { scene } = game;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.sunLightColor = new THREE.Color();
    this.zenithColor = new THREE.Color();
    this.horizonColor = new THREE.Color();
    this.sunIntensity = 3;
    this.daylight = 1;
    this.weather = { clouds: 0.35, rain: 0, wind: 0.35, storm: 0 };
    this.target = { clouds: 0.35, rain: 0, wind: 0.35, storm: 0 };
    this.weatherTimer = 60;
    this.rain = 0;
    this.lightning = 0;
    this.lightningTimer = 10;

    // Preetham sky
    this.sky = new Sky();
    this.sky.scale.setScalar(4500);
    const su = this.sky.material.uniforms;
    su.turbidity.value = 5; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.8;
    // blend horizon into fog colour
    su.uFogColor = { value: new THREE.Color() }; su.uDim = { value: 1 };
    this.sky.material.fragmentShader = this.sky.material.fragmentShader
      .replace('uniform vec3 up;', 'uniform vec3 up;\nuniform vec3 uFogColor; uniform float uDim;')
      .replace('gl_FragColor = vec4( texColor, 1.0 );', `
        float hz = smoothstep(-0.02, 0.1, direction.y);
        texColor = mix(uFogColor, texColor * uDim, hz);
        gl_FragColor = vec4( texColor, 1.0 );`);
    this.sky.material.depthWrite = false;
    scene.add(this.sky);

    // Clouds dome
    this.cloudUniforms = {
      tNoise: { value: tex('noise.jpg', { srgb: false }) }, uTime: { value: 0 }, uCover: { value: 0.4 },
      uSunDir: { value: this.sunDir }, uSunCol: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uFog: { value: new THREE.Color() },
    };
    const cloudMat = new THREE.ShaderMaterial({
      uniforms: this.cloudUniforms, transparent: true, depthWrite: false, side: THREE.BackSide,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; }`,
      fragmentShader: `
        uniform sampler2D tNoise; uniform float uTime, uCover; uniform vec3 uSunDir, uSunCol, uAmb, uFog; varying vec3 vDir;
        float dens(vec2 p){
          float n = texture2D(tNoise, p * 0.5).r * 0.55 + texture2D(tNoise, p * 1.13 + 0.3).g * 0.28 + texture2D(tNoise, p * 2.71 + 0.7).r * 0.12 + texture2D(tNoise, p * 6.3).g * 0.05;
          return smoothstep(1.0 - uCover, 1.0 - uCover + 0.35, n);
        }
        void main(){
          vec3 d = normalize(vDir);
          if (d.y < -0.02) discard;
          vec2 p = d.xz / (d.y + 0.12) * 0.35 + vec2(uTime * 0.004, uTime * 0.0015);
          float c = dens(p);
          vec2 sd = normalize(uSunDir.xz + 1e-4) * 0.06;
          float shade = dens(p + sd) * 0.6 + dens(p + sd * 2.0) * 0.4;
          vec3 lit = mix(uSunCol * 1.25, uAmb * 0.9, shade * 0.75);
          vec3 col = mix(lit, uAmb * 0.55, smoothstep(0.6, 1.0, uCover) * 0.6);
          // silver lining near sun
          float sunA = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSunCol * pow(sunA, 12.0) * (1.0 - c) * 2.0;
          float a = c * smoothstep(-0.02, 0.2, d.y);
          col = mix(uFog, col, smoothstep(0.0, 0.25, d.y));
          gl_FragColor = vec4(col, a * 0.95);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), cloudMat);
    this.clouds.renderOrder = -1;
    scene.add(this.clouds);

    // Stars
    const sp = [];
    for (let i = 0; i < 1500; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(0.05, 1), rand(-1, 1)).normalize().multiplyScalar(3800);
      sp.push(v.x, v.y, v.z);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    scene.add(this.stars);

    // Lights
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 600;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun); scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x4a5a2a, 0.6);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xaabbcc, 0.0012);

    // Rain streaks
    const RN = 4000;
    const rp = new Float32Array(RN * 6);
    for (let i = 0; i < RN; i++) {
      const x = rand(-25, 25), y = rand(0, 30), z = rand(-25, 25);
      rp.set([x, y, z, x + 0.03, y - 0.6, z + 0.02], i * 6);
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rainUniforms = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmount: { value: 0 }, uColor: { value: new THREE.Color(0.7, 0.75, 0.8) } };
    this.rainMesh = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
      uniforms: this.rainUniforms, transparent: true, depthWrite: false,
      vertexShader: `uniform float uTime; uniform vec3 uCam; varying float vA;
        void main(){ vec3 p = position; float id = float(gl_VertexID / 2);
          p.y = mod(p.y - uTime * 14.0 - uCam.y, 30.0) + uCam.y - 12.0;
          p.x = mod(p.x - uCam.x + 25.0, 50.0) - 25.0 + uCam.x; p.z = mod(p.z - uCam.z + 25.0, 50.0) - 25.0 + uCam.z;
          vA = fract(id * 0.618);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float uAmount; uniform vec3 uColor; varying float vA; void main(){ if (vA > uAmount) discard; gl_FragColor = vec4(uColor, 0.35); }`,
    }));
    this.rainMesh.frustumCulled = false;
    scene.add(this.rainMesh);

    // Environment map (cube + PMREM) for reflections and IBL
    this.envScene = new THREE.Scene();
    this.envSky = new Sky(); this.envSky.scale.setScalar(4000);
    this.envSky.material = this.sky.material;
    this.envScene.add(this.envSky);
    this.envClouds = new THREE.Mesh(this.clouds.geometry, cloudMat); this.envScene.add(this.envClouds);
    const groundEnv = new THREE.Mesh(new THREE.CircleGeometry(3000, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1c2414 }));
    groundEnv.position.y = -30; this.envScene.add(groundEnv); this.envGround = groundEnv;
    this.cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    this.cubeCam = new THREE.CubeCamera(1, 10000, this.cubeRT);
    this.pmrem = new THREE.PMREMGenerator(game.renderer);
    this.envTimer = 0;
    this.envCube = this.cubeRT.texture;
    this.lastEnvSun = new THREE.Vector3(9, 9, 9);
  }

  // minutes: time of day [0,1440)
  computeSun(minutes) {
    const hours = minutes / 60;
    const H = THREE.MathUtils.degToRad((hours - 13.2) * 15);
    const east = -Math.cos(DEC) * Math.sin(H);
    const north = Math.sin(DEC) * Math.cos(LAT) - Math.cos(DEC) * Math.cos(H) * Math.sin(LAT);
    const up = Math.sin(DEC) * Math.sin(LAT) + Math.cos(DEC) * Math.cos(H) * Math.cos(LAT);
    this.sunDir.set(east, up, -north).normalize();
    return this.sunDir;
  }

  update(dt, minutes, gameDt, focus) {
    const g = this.game;
    this.computeSun(minutes);
    const el = Math.asin(this.sunDir.y); // radians
    const elDeg = THREE.MathUtils.radToDeg(el);
    // weather evolution (gameDt in game minutes)
    this.weatherTimer -= gameDt;
    if (this.weatherTimer <= 0) this.rollWeather();
    const W = this.weather, T = this.target;
    const k = 1 - Math.exp(-gameDt / 40);
    for (const key of ['clouds', 'rain', 'wind', 'storm']) W[key] = lerp(W[key], T[key], k);
    this.rain = W.rain;
    const overcast = smooth(clamp((W.clouds - 0.45) / 0.5, 0, 1));

    // daylight factor
    this.daylight = smooth(clamp((elDeg + 9.5) / 17, 0, 1));
    const golden = smooth(clamp(1 - Math.abs(elDeg - 3) / 12, 0, 1));
    // sun colour
    const warm = new THREE.Color(1.0, 0.55, 0.28), noon = new THREE.Color(1.0, 0.96, 0.9);
    this.sunLightColor.copy(noon).lerp(warm, golden * 0.85);
    this.sunIntensity = 3.9 * smooth(clamp((elDeg + 1) / 10, 0, 1)) * (1 - overcast * 0.75) * (1 - W.rain * 0.3);
    this.sun.color.copy(this.sunLightColor);
    this.sun.intensity = this.sunIntensity + this.lightning * 6;
    // sky colours (for fog / water / clouds)
    const dayH = new THREE.Color(0.62, 0.72, 0.84), duskH = new THREE.Color(0.85, 0.55, 0.38), nightH = new THREE.Color(0.13, 0.15, 0.24);
    const dayZ = new THREE.Color(0.18, 0.36, 0.72), nightZ = new THREE.Color(0.03, 0.05, 0.12);
    this.horizonColor.copy(nightH).lerp(dayH, this.daylight).lerp(duskH, golden * 0.55 * (1 - overcast));
    this.zenithColor.copy(nightZ).lerp(dayZ, this.daylight);
    const grey = new THREE.Color(0.5, 0.53, 0.56).multiplyScalar(0.15 + this.daylight * 0.85);
    this.horizonColor.lerp(grey, overcast * 0.85);
    this.zenithColor.lerp(grey, overcast * 0.8);

    // Sky uniforms
    const su = this.sky.material.uniforms;
    su.sunPosition.value.copy(this.sunDir).multiplyScalar(4000);
    su.turbidity.value = 2.6 + overcast * 9 + W.rain * 4;
    su.rayleigh.value = 1.0 + golden * 1.3;
    const fogC = this.horizonColor.clone().multiplyScalar(0.62 + golden * 0.2);
    su.uFogColor.value.copy(fogC);
    su.uDim.value = 1 - overcast * 0.6;
    g.scene.fog.color.copy(fogC);
    g.scene.fog.density = (0.00062 + overcast * 0.0006 + W.rain * 0.0016 + (1 - this.daylight) * 0.0004) * (g.fogMul || 1);

    // Lights
    this.hemi.color.copy(this.zenithColor).lerp(new THREE.Color(1, 1, 1), 0.35);
    this.hemi.groundColor.setRGB(0.24, 0.26, 0.15);
    this.hemi.intensity = (0.42 + this.daylight * 0.6) * (1 + this.lightning * 3) + overcast * 0.35 * this.daylight;
    g.scene.environmentIntensity = 0.25 + this.daylight * 0.55;
    g.renderer.toneMappingExposure = 0.78 + (1 - this.daylight) * 0.5;

    // shadow follows focus, snapped to texels
    const fp = focus;
    const d = this.sunDir.y > 0.05 ? this.sunDir : _tmp.set(this.sunDir.x, 0.05, this.sunDir.z).normalize();
    const texel = 140 / this.sun.shadow.mapSize.x;
    const sx = Math.round(fp.x / texel) * texel, sz = Math.round(fp.z / texel) * texel;
    this.sun.target.position.set(sx, fp.y, sz);
    this.sun.position.set(sx + d.x * 250, fp.y + d.y * 250, sz + d.z * 250);
    this.sun.target.updateMatrixWorld();
    this.sun.castShadow = this.sunIntensity > 0.15 && g.quality.shadows;

    // Clouds / stars / rain
    const cu = this.cloudUniforms;
    cu.uTime.value += dt * (0.5 + W.wind * 2);
    cu.uCover.value = W.clouds;
    cu.uSunCol.value.copy(this.sunLightColor).multiplyScalar(0.3 + this.daylight * 0.9 + golden * 0.3);
    cu.uAmb.value.copy(this.horizonColor).multiplyScalar(0.9);
    cu.uFog.value.copy(fogC);
    this.clouds.position.copy(g.camera.position);
    this.sky.position.copy(g.camera.position);
    this.stars.position.copy(g.camera.position);
    this.stars.material.opacity = clamp((-elDeg - 3) / 5, 0, 0.85) * (1 - overcast);
    this.stars.visible = this.stars.material.opacity > 0.01;
    this.rainUniforms.uTime.value += dt;
    this.rainUniforms.uCam.value.copy(g.camera.position);
    this.rainUniforms.uAmount.value = W.rain;
    this.rainUniforms.uColor.value.setScalar(0.35 + this.daylight * 0.5);
    this.rainMesh.visible = W.rain > 0.02;

    // lightning
    this.lightning = Math.max(0, this.lightning - dt * 5);
    if (W.storm > 0.5) {
      this.lightningTimer -= dt;
      if (this.lightningTimer < 0) {
        this.lightningTimer = rand(6, 25);
        this.lightning = 1;
        audio.play('thunder');
      }
    }

    // environment map refresh
    this.envTimer -= dt;
    if (this.envTimer <= 0 || this.sunDir.distanceTo(this.lastEnvSun) > 0.08) {
      this.envTimer = 8;
      this.lastEnvSun.copy(this.sunDir);
      this.updateEnv();
    }
  }

  updateEnv() {
    const g = this.game;
    this.envGround.material.color.setRGB(0.05, 0.07, 0.04).multiplyScalar(0.3 + this.daylight);
    this.envClouds.position.set(0, 0, 0);
    const fog = g.scene.fog; // no fog in env scene
    this.cubeCam.update(g.renderer, this.envScene);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromCubemap(this.cubeRT.texture);
    g.scene.environment = this.envRT.texture;
  }

  rollWeather() {
    const r = Math.random();
    const T = this.target;
    if (r < 0.45) { T.clouds = rand(0.15, 0.45); T.rain = 0; T.wind = rand(0.15, 0.45); T.storm = 0; }
    else if (r < 0.7) { T.clouds = rand(0.45, 0.62); T.rain = 0; T.wind = rand(0.3, 0.6); T.storm = 0; }
    else if (r < 0.85) { T.clouds = rand(0.75, 0.95); T.rain = 0; T.wind = rand(0.3, 0.7); T.storm = 0; }
    else if (r < 0.96) { T.clouds = 0.95; T.rain = rand(0.4, 0.8); T.wind = rand(0.4, 0.8); T.storm = 0; }
    else { T.clouds = 1; T.rain = 1; T.wind = 0.9; T.storm = 1; }
    this.weatherTimer = rand(80, 240);
  }

  setWeatherNow(w) { Object.assign(this.weather, w); Object.assign(this.target, w); }
}
const _tmp = new THREE.Vector3();

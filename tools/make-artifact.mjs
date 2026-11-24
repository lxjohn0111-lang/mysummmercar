// Packages the game as a static multi-file page for publishing as a claude.ai Artifact
// (or any static host): the page, the unbundled ES-module sources, the textures, and an
// import map that loads three.js and Rapier from the jsDelivr CDN.
// Usage: node tools/make-artifact.mjs <outDir> [--local]   (--local maps the libraries to node_modules copies for offline testing)
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] || 'build-artifact');
const local = process.argv.includes('--local');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const copyDir = (src, dst, filter = () => true) => {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d, filter);
    else if (filter(e.name)) fs.copyFileSync(s, d);
  }
};
copyDir('src', path.join(out, 'src'), (n) => n.endsWith('.js'));
copyDir('public/textures', path.join(out, 'textures'));

const imports = local ? {
  three: './lib/three/build/three.module.js',
  'three/examples/jsm/': './lib/three/examples/jsm/',
  '@dimforge/rapier3d-compat': './lib/rapier.es.js',
} : {
  three: 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js',
  'three/examples/jsm/': 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/',
  '@dimforge/rapier3d-compat': 'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/rapier.es.js',
};
if (local) {
  fs.mkdirSync(path.join(out, 'lib/three/build'), { recursive: true });
  fs.copyFileSync('node_modules/three/build/three.module.js', path.join(out, 'lib/three/build/three.module.js'));
  for (const d of ['postprocessing', 'shaders', 'objects']) copyDir(`node_modules/three/examples/jsm/${d}`, path.join(out, 'lib/three/examples/jsm', d));
  fs.copyFileSync('node_modules/@dimforge/rapier3d-compat/rapier.es.js', path.join(out, 'lib/rapier.es.js'));
}

const css = fs.readFileSync('src/style.css', 'utf8');
const page = `<title>Rustbucket Summer</title>
<style>
${css}
</style>
<canvas id="game"></canvas>
<div id="ui"></div>
<div id="loading">
  <div class="load-inner">
    <div class="load-title">RUSTBUCKET<span>SUMMER</span></div>
    <div class="load-sub">a Finnish summer garage survival</div>
    <div class="load-bar"><div id="load-fill"></div></div>
    <div id="load-text">Starting up…</div>
    <div class="load-tip" id="load-tip"></div>
  </div>
</div>
<script type="importmap">
${JSON.stringify({ imports }, null, 2)}
</script>
<script type="module" src="src/main.js"></script>
`;
fs.writeFileSync(path.join(out, 'kesakaara.html'), page);
// a full document for local testing with a static server
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>\n${page}</body></html>\n`);
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(path.relative(out, p)); } };
walk(out);
console.log(`wrote ${files.length} files to ${out}`);

// Builds the CrazyGames upload: ONE self-contained index.html (game code, three.js, Rapier physics,
// CSS and every texture inlined), zipped as crazygames/kesakaara-crazygames.zip.
//   node tools/make-crazygames.mjs
import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(root, 'crazygames');
const tmp = path.join(root, 'build-crazygames');
fs.rmSync(tmp, { recursive: true, force: true });

// 1) bundle everything into a single JS module + CSS
await build({
  root, base: './', logLevel: 'warn', publicDir: false,
  build: { outDir: tmp, emptyOutDir: true, target: 'es2020', minify: 'esbuild', cssCodeSplit: false, assetsInlineLimit: 100000000, chunkSizeWarningLimit: 100000, modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } } },
});
let html = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
const assets = path.join(tmp, 'assets');
const jsFile = fs.readdirSync(assets).find((f) => f.endsWith('.js'));
const cssFile = fs.readdirSync(assets).find((f) => f.endsWith('.css'));
const js = fs.readFileSync(path.join(assets, jsFile), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = cssFile ? fs.readFileSync(path.join(assets, cssFile), 'utf8') : '';

// 2) recompress textures (same resolution, lighter JPEG quality) and embed them as data URIs
const texDir = path.join(root, 'public', 'textures');
const tex = {};
let raw = 0, packed = 0;
for (const f of fs.readdirSync(texDir).sort()) {
  const buf = fs.readFileSync(path.join(texDir, f));
  raw += buf.length;
  let out = buf, mime = 'image/png';
  if (f.endsWith('.jpg')) {
    mime = 'image/jpeg';
    const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
    const q = f.endsWith('_n.jpg') ? 80 : 84;
    const enc = jpeg.encode({ data: img.data, width: img.width, height: img.height }, q).data;
    if (enc.length < buf.length) out = Buffer.from(enc);
  } else if (f.endsWith('.png')) {
    const png = PNG.sync.read(buf);
    const enc = PNG.sync.write(png, { deflateLevel: 9, filterType: -1 });
    if (enc.length < buf.length) out = enc;
  } else continue;
  packed += out.length;
  tex[f] = `data:${mime};base64,${out.toString('base64')}`;
}

// 3) assemble one HTML file
html = html
  .replace(/<link rel="stylesheet"[^>]*>/g, '')
  .replace(/<script type="module"[^>]*src="[^"]*"[^>]*><\/script>/g, '')
  .replace('</head>', `<style>${css}</style>\n</head>`)
  .replace('</body>', `<script>window.__TEX=${JSON.stringify(tex)};</script>\n<script type="module">${js}</script>\n</body>`);
fs.mkdirSync(outDir, { recursive: true });
const single = path.join(outDir, 'index.html');
fs.writeFileSync(single, html);

// 4) zip it (index.html at the zip root)
const zip = path.join(outDir, 'kesakaara-crazygames.zip');
fs.rmSync(zip, { force: true });
execFileSync('zip', ['-9', '-j', '-q', zip, single]);
fs.rmSync(tmp, { recursive: true, force: true });
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
console.log(`textures ${mb(raw)} -> ${mb(packed)}; index.html ${mb(fs.statSync(single).size)}; zip ${mb(fs.statSync(zip).size)}`);

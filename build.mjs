// Production build.
//
// Two bundles: the game, and the camera worker. The worker is separate so the
// pose model and the MediaPipe WASM only reach the browser when a player
// actually turns the camera on -- a keyboard player never downloads them.
//
// Binary assets go through esbuild's `file` loader, which copies them into
// dist/assets under a content hash. That hash is what lets the server mark
// them immutable and cache them for a year.
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync, mkdirSync, copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, resolve} from 'node:path';

const require = createRequire(import.meta.url);
const {build} = require('esbuild');
const root = dirname(fileURLToPath(import.meta.url));
const nodePaths = [resolve(root, 'node_modules')];
const target = ['chrome110', 'edge110', 'firefox115'];

const out = join(root, 'public');
mkdirSync(join(out, 'dist'), {recursive: true});

await build({
  entryPoints: [join(root, 'src/motion-worker.js')],
  outfile: join(out, 'dist/motion-worker.js'),
  bundle: true, minify: true, format: 'iife', nodePaths, target,
});

await build({
  entryPoints: [join(root, 'src/game.js')],
  outfile: join(out, 'dist/game.js'),
  bundle: true, minify: true, format: 'iife', nodePaths, target,
  assetNames: 'assets/[name]-[hash]',
  publicPath: './dist',
  loader: {
    '.glb': 'file', '.mp3': 'file',
    '.wasm': 'file', '.wasmjs': 'file', '.tflite': 'file', '.task': 'file',
  },
  legalComments: 'eof',
});

copyFileSync(join(root, 'src/style.css'), join(out, 'dist/style.css'));

// The shell carries markers rather than links so the source stays directly
// readable; the cache-buster is the build time.
const version = Date.now();
const html = readFileSync(join(root, 'src/shell.html'), 'utf8')
  .replace('<style>/*INLINE_CSS*/</style>', `<link rel="stylesheet" href="./dist/style.css?v=${version}">`)
  .replace('<script>/*INLINE_JS*/</script>', `<script defer src="./dist/game.js?v=${version}"></script>`);
writeFileSync(join(out, 'index.html'), html);

console.log('Built NEON RAIL into public/ - index.html, dist/game.js, dist/motion-worker.js, dist/style.css and hashed assets.');

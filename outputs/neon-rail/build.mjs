import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let build;try{({build}=require('esbuild'));}catch{({build}=require('../../work/build/node_modules/esbuild'));}
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const nodePaths=[resolve(root,'../../work/build/node_modules')];
mkdirSync(join(root,'dist'),{recursive:true});
await build({entryPoints:[join(root,'src/motion-worker.js')],bundle:true,outfile:join(root,'dist/motion-worker.js'),minify:true,format:'iife',nodePaths,target:['chrome110','edge110','firefox115']});
await build({entryPoints:[join(root,'src/game.js')],bundle:true,outfile:join(root,'dist/game.js'),minify:true,format:'iife',nodePaths,assetNames:'assets/[name]-[hash]',publicPath:'./dist',loader:{'.glb':'file','.wasm':'file','.wasmjs':'file','.tflite':'file','.task':'file','.mp3':'file'},target:['chrome110','edge110','firefox115'],legalComments:'eof'});
copyFileSync(join(root,'src/style.css'),join(root,'dist/style.css'));
const version=Date.now();
const html=readFileSync(join(root,'src/shell.html'),'utf8').replace('<style>/*INLINE_CSS*/</style>',`<link rel="stylesheet" href="./dist/style.css?v=${version}">`).replace('<script>/*INLINE_JS*/</script>',`<script defer src="./dist/game.js?v=${version}"></script>`);
writeFileSync(join(root,'NEON RAIL.html'),html);writeFileSync(join(root,'index.html'),html);
console.log('Built split game: HTML, CSS, JavaScript and cached binary assets. Camera runtime loads only when enabled.');

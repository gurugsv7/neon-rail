import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const result=await build({entryPoints:[join(root,'src/game.js')],bundle:true,write:false,minify:true,format:'iife',loader:{'.glb':'base64'},target:['chrome110','edge110','firefox115'],legalComments:'eof'});
const html=readFileSync(join(root,'src/shell.html'),'utf8')
  .replace('/*INLINE_CSS*/',readFileSync(join(root,'src/style.css'),'utf8'))
  .replace('/*INLINE_JS*/',()=>result.outputFiles[0].text.replaceAll('</script','<\\/script'));
writeFileSync(join(root,'NEON RAIL.html'),html);
console.log('Built NEON RAIL.html — ready to open, no server required.');

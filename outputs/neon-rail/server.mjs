import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {dirname,resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.wasm':'application/wasm','.png':'image/png'};
createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}const info=await stat(file);if(!info.isFile())throw Error();const tag='"'+info.size+'-'+info.mtimeMs+'"';if(req.headers['if-none-match']===tag){res.writeHead(304).end();return;}res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','ETag':tag,'Cache-Control':file.includes(sep+'assets'+sep)?'public, max-age=31536000, immutable':'no-cache'});res.end(req.method==='HEAD'?undefined:await readFile(file));}catch{res.writeHead(404).end('Not found');}}).listen(8765,'127.0.0.1',()=>{console.log('NEON RAIL: http://127.0.0.1:8765');if(process.argv.includes('--open'))spawn('explorer.exe',['http://127.0.0.1:8765']);}).on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port 8765 already in use. Open http://127.0.0.1:8765':e);process.exitCode=1;});

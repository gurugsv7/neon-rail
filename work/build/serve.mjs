import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {extname,join,normalize} from 'node:path';
const types={'.html':'text/html','.glb':'model/gltf-binary','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const root=join(process.cwd(),'..');
createServer((req,res)=>{
  const path=join(root,normalize(decodeURIComponent(req.url.split('?')[0])));
  let body;try{body=readFileSync(path);}catch{res.writeHead(404).end('not found');return;}
  res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'}).end(body);
}).listen(8127,()=>console.log('serving on 8127'));

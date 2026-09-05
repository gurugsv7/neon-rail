from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
MEASURE = """
(clip)=>{
  const g=__rail.game;
  if(clip)g.rig.play(clip,{fade:0}); 
  for(let i=0;i<60;i++){g.rig.update(1/60);}
  g.character.root.updateMatrixWorld(true);
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  g.character.root.traverse(o=>{
    if(!o.isMesh||!o.geometry)return;
    const geo=o.geometry;
    // pose-accurate bounds: skin every vertex with the live bone matrices
    const pos=geo.attributes.position, sk=geo.attributes.skinIndex, sw=geo.attributes.skinWeight;
    const v=new pos.constructor===undefined?null:null;
    const tmp=new (o.position.constructor)();
    for(let i=0;i<pos.count;i+=7){
      tmp.fromBufferAttribute(pos,i);
      if(o.isSkinnedMesh){o.applyBoneTransform(i,tmp);}   
      tmp.applyMatrix4(o.matrixWorld);
      mn=[Math.min(mn[0],tmp.x),Math.min(mn[1],tmp.y),Math.min(mn[2],tmp.z)];
      mx=[Math.max(mx[0],tmp.x),Math.max(mx[1],tmp.y),Math.max(mx[2],tmp.z)];
    }
  });
  return {clip:clip||'current',height:+(mx[1]-mn[1]).toFixed(2),feet:+mn[1].toFixed(2),top:+mx[1].toFixed(2)};
}
"""
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1500,'height':850})
    errs=[]; page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail')
    page.get_by_role("button",name="LET’S RUN").click()
    page.evaluate('__rail.game.testClock=true;__rail.game.audio.enabled=false;__rail.clear();__rail.advance(2)')
    for clip in ['run','slide','jump','stumble']:
        print(json.dumps(page.evaluate(MEASURE,clip)),flush=True)
    page.evaluate('__rail.game.rig.play("run",{fade:0});__rail.advance(2);__rail.game.render(1/60)')
    page.wait_for_timeout(300); page.screenshot(path='work/char-scale.png'); print('shot',flush=True)
    print('errors:',errs[:3],flush=True)
    b.close()

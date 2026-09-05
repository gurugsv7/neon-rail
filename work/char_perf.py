from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
BENCH = """
async ()=>{
  const g=__rail.game, gl=g.renderer.getContext();
  const bench=()=>{const t=[];for(let i=0;i<40;i++){const s=performance.now();g.render(1/60);gl.finish();t.push(performance.now()-s);}
    t.sort((a,b)=>a-b);return +t[20].toFixed(2);};
  const rig=g.character.root;
  const meshes=[];rig.traverse(o=>{if(o.isMesh)meshes.push(o);});
  bench();
  const on=bench();
  meshes.forEach(m=>m.castShadow=false); bench();
  const noShadow=bench();
  rig.visible=false; bench();
  const hidden=bench();
  rig.visible=true; meshes.forEach(m=>m.castShadow=true);
  return {characterVisible:on, shadowOff:noShadow, characterHidden:hidden,
          costOfShadow:+(on-noShadow).toFixed(2), costTotal:+(on-hidden).toFixed(2),
          skinned:meshes.filter(m=>m.isSkinnedMesh).length, bones:meshes[0]?.skeleton?.bones.length||0,
          tris:g.renderer.info.render.triangles, calls:g.renderer.info.render.calls};
}
"""
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    for w,h in ((1920,1080),(2560,1440)):
        page=b.new_page(viewport={'width':w,'height':h})
        page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
        page.wait_for_function('!!window.__rail')
        page.get_by_role("button",name="LET’S RUN").click()
        page.evaluate('__rail.game.testClock=true;__rail.game.audio.enabled=false;__rail.clear();__rail.advance(4)')
        r=page.evaluate(BENCH)
        print(f"{w}x{h}", json.dumps(r), flush=True)
        page.close()
    b.close()

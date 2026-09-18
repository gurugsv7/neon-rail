from pathlib import Path
from playwright.sync_api import sync_playwright
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
results=[]
def check(name,value,detail=None):
    results.append({'test':name,'passed':bool(value),'detail':detail})
    print(('PASS ' if value else 'FAIL ')+name,detail or '',flush=True)
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.goto('http://127.0.0.1:8765/NEON%20RAIL.html?qa',wait_until='networkidle',timeout=60000)
    page.wait_for_function('!!window.__rail')
    page.evaluate('__rail.game.testClock=true')
    def ev(s):return page.evaluate(s)
    def reset():ev('__rail.game.start();__rail.clear();__rail.game.audio.enabled=false')
    def adv(t):return ev(f'__rail.advance({t})')
    ev('''window.testRoute=seed=>{const g=__rail.game;g.seed=seed;g.start();g.audio.enabled=false;const oldActivate=g.activate,oldHit=g.hit;let hits=0,currentBase=null,safe=1;const events=[];g.activate=()=>{};g.hit=function(...args){hits++;events.push({distance:this.distance,player:{...this.player},type:args[1].type,base:args[1].baseS,actual:args[1].s,hazards:this.world.entities.filter(e=>Math.abs(e.s-this.distance)<90).map(e=>({type:e.type,lane:e.lane,base:e.baseS-this.distance,z:e.s-this.distance}))});return oldHit.apply(this,args)};
      for(let i=0;i<210*120;i++){let first=null;for(const e of g.world.entities)if(e.baseS+22>g.distance&&(!first||e.baseS<first.baseS))first=e;
      if(first){if(first.baseS!==currentBase){currentBase=first.baseS;const row=g.world.entities.filter(e=>e.baseS===first.baseS);safe=[0,1,2].find(l=>!row.some(e=>e.lane===l));}if(safe!==undefined&&safe!==g.player.lane)g.player.move(Math.sign(safe-g.player.lane));}g.step(1/120);if(g.state!=='playing')break;}
      g.activate=oldActivate;g.hit=oldHit;return {state:g.state,hits,distance:g.distance,patterns:g.world.generated,events};}''')
    for seed in [1,99,2026]:
        r=ev(f'testRoute({seed})');check(f'210-second unprotected route, seed {seed}',r['state']=='playing' and r['hits']==0,r)

    check('No browser errors',not errors,errors)
    b.close()
    assert all(r['passed'] for r in results)

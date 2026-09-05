from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
out={}
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1440,'height':900})
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.on('request',lambda r:requests.append(r.url))
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail')
    page.wait_for_timeout(1300)
    page.screenshot(path='outputs/neon-rail/preview.png')
    out['offline_launch']=page.evaluate('__rail.snapshot().state')=='menu'
    out['network_requests']=[r for r in requests if r.startswith('http')]
    page.get_by_role('button',name='LET’S RUN').click()
    page.evaluate('__rail.game.testClock=true;__rail.game.audio.enabled=false;__rail.clear();__rail.power("magnet");__rail.game.pause()')
    before=page.evaluate('__rail.game.power.magnet')
    page.evaluate('__rail.advance(20)')
    out['pause_freezes_active_timer']=before==page.evaluate('__rail.game.power.magnet')
    page.get_by_role('button',name='KEEP RUNNING').click()
    page.keyboard.press('f');page.wait_for_timeout(150)
    out['fullscreen']=page.evaluate('!!document.fullscreenElement')
    page.keyboard.press('f')
    # Follow validated bypasses with all protection disabled, retaining the
    # real player controller, hazard movement and collision system.
    page.evaluate('''window.noProtectionSoak=(seed)=>{const g=__rail.game;g.seed=seed;g.start();g.audio.enabled=false;const activate=g.activate,hit=g.hit;let hits=0,currentBase=null,safe=1;g.activate=()=>{};g.hit=function(...args){hits++;return hit.apply(this,args)};let failure=null;
      for(let i=0;i<720*120;i++){let first=null;for(const e of g.world.entities)if(e.baseS+22>g.distance&&(!first||e.baseS<first.baseS))first=e;
        if(first){if(first.baseS!==currentBase){currentBase=first.baseS;const row=g.world.entities.filter(e=>e.baseS===first.baseS);safe=[0,1,2].find(l=>!row.some(e=>e.lane===l));}if(safe!==undefined&&safe!==g.player.lane)g.player.move(Math.sign(safe-g.player.lane));}
        g.step(1/120);if(g.state!=='playing'){failure={distance:g.distance,player:{...g.player}};break;}}
      g.activate=activate;g.hit=hit;return {seed,hits,failure,distance:g.distance,generated:g.world.generated};}''')
    out['unprotected_runs']=[]
    for seed in [1,99,2026]:
        r=page.evaluate(f'noProtectionSoak({seed})');out['unprotected_runs'].append(r);print('UNPROTECTED',r,flush=True)
    page.evaluate('__rail.game.start();__rail.clear();__rail.game.audio.enabled=false;__rail.power("board");__rail.game.player.move(-1);__rail.advance(.22)')
    x=page.evaluate('__rail.game.player.x');out['board_lane_switch']=abs(x+3.25)<.05
    page.evaluate('__rail.spawn("train",0,10);__rail.advance(1)')
    out['board_crash_protection']=page.evaluate('__rail.game.state==="playing"&&__rail.game.power.board===0')
    # Keep gameplay running during the GPU frame-rate tests. Each test starts
    # on a clear track to keep capture independent of a human's input timing.
    out['performance']=[]
    for width,height in [(1366,768),(1920,1080),(2560,1440)]:
        page.set_viewport_size({'width':width,'height':height})
        page.evaluate('__rail.game.start();__rail.clear();__rail.game.audio.enabled=false;__rail.game.testClock=false')
        page.wait_for_timeout(500)
        page.evaluate('window.ft=[];window.lt=performance.now();window.sample=t=>{ft.push(t-lt);lt=t;if(ft.length<180)requestAnimationFrame(sample)};requestAnimationFrame(sample)')
        page.wait_for_function('ft.length>=180',timeout=60000)
        perf=page.evaluate('(()=>{const f=ft.slice(10),sorted=[...f].sort((a,b)=>a-b);return {mean_ms:f.reduce((a,b)=>a+b,0)/f.length,p95_ms:sorted[Math.floor(sorted.length*.95)],distance:__rail.game.distance}})()')
        perf.update(width=width,height=height);out['performance'].append(perf);print('GPU GAMEPLAY',perf,flush=True)
    page.evaluate('__rail.game.testClock=true;__rail.game.score=45678;__rail.game.end()')
    page.reload(wait_until='networkidle');page.wait_for_function('!!window.__rail')
    out['offline_save_persists']=page.evaluate('__rail.game.save.data.best>=45678')
    out['errors']=errors
    out['renderer']=page.evaluate('(()=>{const gl=__rail.game.renderer.getContext(),e=gl.getExtension("WEBGL_debug_renderer_info");return gl.getParameter(e.UNMASKED_RENDERER_WEBGL)})()')
    json.dump(out,open('work/final-checks.json','w'),indent=2)
    print(json.dumps(out,indent=2),flush=True)
    b.close()
assert out['offline_launch'] and not out['network_requests'] and out['pause_freezes_active_timer'] and out['fullscreen'] and out['board_lane_switch'] and out['board_crash_protection'] and out['offline_save_persists'] and not out['errors']
assert all(r['hits']==0 and r['failure'] is None for r in out['unprotected_runs'])

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
    page.goto('http://127.0.0.1:8765/NEON%20RAIL.html?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail')
    page.evaluate('__rail.game.testClock=true')
    def ev(s):return page.evaluate(s)
    def reset():ev('__rail.game.start();__rail.clear();__rail.game.audio.enabled=false')
    def adv(t):return ev(f'__rail.advance({t})')
    reset();ev('__rail.spawn("approach",0,45)')
    positions=[]
    for i in range(4):
        adv(.5);positions.append(ev('(()=>{const e=__rail.game.world.entities[0];return {world:e.s,relative:e.s-__rail.game.distance,warned:e.warned}})()'))
    check('Incoming train keeps moving beyond old displacement cap',all(abs(positions[i]['world']-positions[i-1]['world']+9)<.001 for i in range(1,4)),positions)
    check('Incoming train travels past the player',positions[-1]['relative']< -20)
    check('Incoming train is warned before encounter',positions[0]['warned'])
    adv(.6);check('Incoming train recycles after passing',ev('__rail.game.world.entities.length')==0)
    for kind in ['train','approach','depart']:
        for speed in [17,30]:
            for collision_time in [.35,.5,.7]:
                reset()
                forward=18 if kind=='approach' else -2.5 if kind=='depart' else 0
                distance=6.7+(speed+forward)*collision_time
                ev(f'__rail.game.distance={0 if speed==17 else 3000};__rail.game.speed={speed};__rail.clear();__rail.spawn("{kind}",1,{distance})')
                page.keyboard.press('Space');s=adv(1.6)
                check(f'Ground jump cannot clear {kind} at {speed}m/s, timing {collision_time}s',s['state']=='over')
    reset();ev('__rail.spawn("rampTrain",1,24)');s=adv(1.25)
    check('Extended access ramp reaches full-height roof',s['state']=='playing' and abs(s['player']['y']-4.27)<.01 and s['player']['grounded'],s['player'])
    page.keyboard.press('Space');s=adv(.4)
    check('Jump still works from roof elevation',s['player']['y']>6.8)
    page.keyboard.press('d');s=adv(1.0)
    check('Airborne lane change and landing from tall train',s['state']=='playing' and s['player']['lane']==2 and s['player']['grounded'] and s['player']['y']==0,s['player'])
    reset();ev('__rail.spawn("train",1,15)');page.keyboard.press('a');s=adv(.8)
    check('Normal lane dodge clears tall train',s['state']=='playing' and s['threat']==0)
    for power in ['shield','board']:
        reset();ev(f'__rail.power("{power}");__rail.spawn("approach",1,28)');s=adv(1.5)
        check(power+' protects against moving train',s['state']=='playing' and s['power'][power]==0)
    reset();ev('__rail.spawn("hurdle",1,7)');page.keyboard.press('Space');s=adv(.7)
    check('Low obstacles remain jumpable',s['state']=='playing' and s['threat']==0)
    reset();ev('__rail.spawn("overhead",1,4)');page.keyboard.press('s');s=adv(.4)
    check('Slide collision unchanged',s['state']=='playing' and s['threat']==0)
    # Sustained routes with shields and boards disabled. Retain real collision
    # and player systems, and count every hit rather than just final deaths.
    ev('''window.testRoute=seed=>{const g=__rail.game;g.seed=seed;g.start();g.audio.enabled=false;const oldActivate=g.activate,oldHit=g.hit;let hits=0,currentBase=null,safe=1;const events=[];g.activate=()=>{};g.hit=function(...args){hits++;events.push({distance:this.distance,player:{...this.player},type:args[1].type,base:args[1].baseS,actual:args[1].s,hazards:this.world.entities.filter(e=>Math.abs(e.s-this.distance)<90).map(e=>({type:e.type,lane:e.lane,base:e.baseS-this.distance,z:e.s-this.distance}))});return oldHit.apply(this,args)};
      for(let i=0;i<720*120;i++){let first=null;for(const e of g.world.entities)if(e.baseS+22>g.distance&&(!first||e.baseS<first.baseS))first=e;
      if(first){if(first.baseS!==currentBase){currentBase=first.baseS;const row=g.world.entities.filter(e=>e.baseS===first.baseS);safe=[0,1,2].find(l=>!row.some(e=>e.lane===l));}if(safe!==undefined&&safe!==g.player.lane)g.player.move(Math.sign(safe-g.player.lane));}g.step(1/120);if(g.state!=='playing')break;}
      g.activate=oldActivate;g.hit=oldHit;return {state:g.state,hits,distance:g.distance,patterns:g.world.generated,events};}''')
    for seed in [1,99,2026]:
        r=ev(f'testRoute({seed})');check(f'12-minute unprotected route, seed {seed}',r['state']=='playing' and r['hits']==0,r)
    # Visual checks of the actual revised geometry, ramp and camera.
    reset();ev('__rail.spawn("approach",0,24);__rail.spawn("train",2,38);__rail.game.time=8;__rail.game.world.step(0,__rail.game)')
    page.wait_for_timeout(1200);page.screenshot(path='work/tall-trains.png')
    reset();ev('__rail.spawn("rampTrain",1,24);__rail.spawn("train",0,35)');adv(1.2)
    page.wait_for_timeout(900);page.screenshot(path='work/tall-train-roof.png')
    ev('__rail.game.menu()');page.wait_for_timeout(1300);page.screenshot(path='outputs/neon-rail/preview.png')
    check('No browser errors after train changes',not errors,errors)
    json.dump({'results':results,'errors':errors},open('work/train-checks.json','w'),indent=2)
    b.close()
assert all(r['passed'] for r in results)

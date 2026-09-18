from playwright.sync_api import sync_playwright
from pathlib import Path
import json,sys
sys.stdout.reconfigure(encoding='utf-8')
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
    page=b.new_page(viewport={'width':1440,'height':900});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle',timeout=60000)
    page.wait_for_function('!!window.__rail',timeout=60000)
    page.evaluate('__rail.game.testClock=true;__rail.game.start();__rail.clear();__rail.game.audio.enabled=false')
    for name,d in [('bridge',15),('station',135),('sunvault',375),('switchworks',423),('solarium',471)]:
        page.evaluate(f'__rail.game.distance={d};__rail.game.time=8;__rail.game.world.step(0,__rail.game);__rail.game.ui.lastUpdate=1;__rail.game.ui.update(0)')
        page.wait_for_timeout(900);page.screenshot(path=f'work/{name}-new.png')
        print(name,page.evaluate('__rail.snapshot()'),flush=True)
    page.evaluate('__rail.game.menu()');page.wait_for_timeout(800)
    page.get_by_role('button',name='Toggle motion control').click()
    page.wait_for_function('__rail.motion().active',timeout=30000)
    print('camera active',page.evaluate('({active:__rail.motion().active,streaming:__rail.motion().streaming,status:__rail.motion().status})'),flush=True)
    page.get_by_role('button',name='Toggle motion control').click()
    assert page.evaluate('!__rail.motion().active&&__rail.motion().video.srcObject===null')
    page.evaluate('window.requestCount=0;window.resolveCamera=null;window.trackStopped=0;window.realGetMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=()=>{requestCount++;return new Promise(resolve=>resolveCamera=resolve)};window.pendingStart=__rail.motion().enable();__rail.motion().toggle();resolveCamera({getTracks:()=>[{stop:()=>trackStopped++}]})')
    page.wait_for_timeout(150)
    race=page.evaluate('({requests:requestCount,stopped:trackStopped,active:__rail.motion().active,stream:__rail.motion().video.srcObject===null})');print('cancel startup',race,flush=True)
    assert race=={'requests':1,'stopped':1,'active':False,'stream':True}
    page.evaluate('void (navigator.mediaDevices.getUserMedia=realGetMedia)')
    print('errors',errors,flush=True)
    json.dump({'errors':errors,'cancelStartup':race},open('work/improvements-results.json','w'),indent=2)
    b.close()
    assert not errors

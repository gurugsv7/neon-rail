from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
 p=b.new_page(viewport={'width':1440,'height':900});errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto('http://127.0.0.1:8765/?qa',wait_until='networkidle');p.wait_for_function('!!window.__rail',timeout=60000)
 p.evaluate('__rail.game.testClock=true;__rail.game.start();__rail.clear();__rail.game.motionControl={requiresJog:true,tracked:true,running:false}')
 start=p.evaluate('__rail.game.distance');p.evaluate('__rail.advance(2)');assert p.evaluate('__rail.game.distance')==start
 assert p.evaluate('__rail.game.idleSeconds')>1.9
 p.screenshot(path='work/standing-pursuit.png')
 pressure=p.evaluate('__rail.game.idleSeconds');p.evaluate('__rail.game.motionControl.tracked=false;__rail.advance(10)');assert p.evaluate('__rail.game.idleSeconds')==pressure;assert p.evaluate('__rail.game.state')=='playing'
 p.wait_for_timeout(100);assert p.locator('#body-guide').inner_text()=='Return to position'
 p.evaluate('__rail.game.motionControl.tracked=true;__rail.game.motionControl.running=true;__rail.advance(.5)');assert p.evaluate('__rail.game.distance')>start;assert p.evaluate('__rail.game.idleSeconds')<pressure
 p.evaluate('__rail.game.motionControl.running=false;__rail.advance(5.1)');assert p.evaluate('__rail.game.state')=='caught';assert not p.locator('#gameover').is_visible()
 p.evaluate('__rail.advance(.9)');p.screenshot(path='work/capture-lock.png')
 p.evaluate('__rail.advance(2.5)');p.screenshot(path='work/capture-tow.png');assert p.evaluate('__rail.game.character.root.position.y')>.1
 p.evaluate('__rail.advance(2.5)');assert p.evaluate('__rail.game.state')=='over';assert p.locator('#gameover').is_visible()
 p.evaluate('__rail.game.start();__rail.clear();__rail.game.motionControl.requiresJog=false');assert not p.evaluate('__rail.game.captureTime')
 p.evaluate('__rail.game.end();__rail.advance(6)');assert p.evaluate('__rail.game.state')=='over'
 p.evaluate('__rail.game.start();__rail.clear();__rail.spawn("train",1,12);__rail.advance(2)');assert p.evaluate('__rail.game.state')=='caught';p.evaluate('__rail.advance(3)');p.screenshot(path='work/capture-train.png')
 assert not errors;print('PASS standing pursuit, tracking freeze, jogging escape, capture timing, tow, results and restart; no page errors')
 b.close()

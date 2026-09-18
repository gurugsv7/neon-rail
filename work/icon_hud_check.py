from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
 p=b.new_page(viewport={'width':1440,'height':900});errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle',timeout=60000)
 p.wait_for_function('!!window.__rail',timeout=60000)
 p.evaluate('__rail.game.testClock=true');p.locator('#run').click()
 p.evaluate('__rail.clear();__rail.game.audio.enabled=false;__rail.advance(1)')
 p.screenshot(path='work/icon-hud-clean.png')
 p.evaluate("['magnet','boost','shield','board'].forEach((k,i)=>__rail.game.world.addPower(k,i%3,__rail.game.distance+6+i*4));__rail.game.world.step(0,__rail.game)")
 p.screenshot(path='work/icon-pickups.png')
 p.evaluate('__rail.clear()')
 p.evaluate("['magnet','boost','shield','board'].forEach(k=>__rail.power(k));__rail.game.ui.lastUpdate=1;__rail.game.ui.update(0)")
 assert p.locator('.power svg').count()==4
 assert p.locator('#toast svg').count()==1
 assert p.locator('#power-shield').get_attribute('aria-label').endswith('one hit covered')
 p.screenshot(path='work/icon-hud-powers.png')
 p.evaluate('__rail.game.threat=5;__rail.game.ui.lastUpdate=1;__rail.game.ui.update(0)')
 assert 'danger' in p.locator('#chase').get_attribute('class')
 p.locator('#pause-button').click();assert p.locator('#paused').is_visible()
 p.locator('#resume').click();assert p.locator('#hud').is_visible()
 p.locator('#audio').click();assert p.locator('#audio svg').count()==1
 p.evaluate('__rail.game.power.magnet=2;__rail.game.ui.lastUpdate=1;__rail.game.ui.update(0)')
 assert 'expiring' in p.locator('#power-magnet').get_attribute('class')
 p.evaluate('__rail.advance(3)');assert p.locator('#power-magnet').count()==0
 for w,h in [(800,600),(390,844)]:
  p.set_viewport_size({'width':w,'height':h});p.wait_for_timeout(300)
  p.screenshot(path=f'work/icon-hud-{w}.png')
  assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
 p.locator('#pause-button').click();p.locator('#restart').click();assert p.locator('.power').count()==0
 print({'passed':True,'errors':errors,'checks':'four timers, notification icons, threat, pause, resume, audio, expiry, restart, resize'})
 assert not errors
 b.close()

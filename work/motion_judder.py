from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
# Judder shows up as a bimodal frame-time distribution, not as a worse mean, so
# count long frames rather than averaging.
SAMPLE = """(seconds) => new Promise(function(res){
  var d=[], last=performance.now(), n=0, target=seconds*60;
  function tick(){ requestAnimationFrame(function(){
    var t=performance.now(); d.push(t-last); last=t;
    if(++n<target){ tick(); } else {
      d.splice(0,20); d.sort(function(a,b){return a-b;});
      var long=d.filter(function(x){return x>22;}).length;
      res({frames:d.length, median:+d[Math.floor(d.length/2)].toFixed(2),
           p95:+d[Math.floor(d.length*0.95)].toFixed(2), max:+d[d.length-1].toFixed(2),
           longFrames:long, longPerSec:+(long/seconds).toFixed(1)});
    }});}
  tick();
})"""
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist',
        '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
    page=b.new_page(viewport={'width':1280,'height':720})
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail',timeout=60000)
    page.get_by_role("button",name="LET’S RUN").click()
    page.evaluate('__rail.game.audio.enabled=false')
    page.wait_for_timeout(1500)
    print('motion OFF:',json.dumps(page.evaluate(SAMPLE,5)),flush=True)
    page.evaluate("__rail.game.motionControl.enable()")
    page.wait_for_timeout(5000)
    print('motion ON :',json.dumps(page.evaluate(SAMPLE,5)),flush=True)
    print('status:',page.evaluate("__rail.game.motionControl.status"),flush=True)
    b.close()

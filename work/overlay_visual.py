from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
# Draws the preview exactly as game.js does -- mirrored video, box from
# previewBox -- with a synthetic face at known offsets, so the alignment can be
# seen rather than argued about.
SHOT = r"""
async ()=>{
  await __rail.prepareTracker();
  const src=document.createElement('canvas'); src.width=640; src.height=480;
  const sx=src.getContext('2d');
  const drawFace=(fx)=>{const fy=220,r=95;
    sx.fillStyle='#5b6b7a'; sx.fillRect(0,0,640,480);
    sx.fillStyle='#e0b48c'; sx.beginPath(); sx.ellipse(fx,fy,r*0.78,r,0,0,7); sx.fill();
    sx.fillStyle='#2b2118';
    sx.beginPath(); sx.ellipse(fx-r*0.3,fy-r*0.18,r*0.11,r*0.07,0,0,7); sx.fill();
    sx.beginPath(); sx.ellipse(fx+r*0.3,fy-r*0.18,r*0.11,r*0.07,0,0,7); sx.fill();
    sx.fillRect(fx-r*0.42,fy-r*0.36,r*0.26,r*0.05);
    sx.fillRect(fx+r*0.16,fy-r*0.36,r*0.26,r*0.05);
    sx.strokeStyle='#7d3f36'; sx.lineWidth=7;
    sx.beginPath(); sx.arc(fx,fy+23,r*0.28,0.15*Math.PI,0.85*Math.PI); sx.stroke();
    sx.fillStyle='#26343f'; sx.beginPath(); sx.ellipse(fx,fy-59,r*0.85,r*0.42,0,Math.PI,2*Math.PI); sx.fill();};
  const detect=()=>new Promise(d=>{ if(!__rail.requestHead(src,d)) d(null); });

  const strip=document.createElement('canvas'); strip.width=3*170; strip.height=150;
  const p=strip.getContext('2d');
  p.fillStyle='#173f49'; p.fillRect(0,0,strip.width,strip.height);
  const labels=['player leans RIGHT','centred','player leans LEFT'];
  const rawXs=[170,320,470];          // raw-image x; 470 = player's own left
  const out=[];
  for(let i=0;i<3;i++){
    drawFace(rawXs[i]); await detect();               // warm
    drawFace(rawXs[i]); const head=await detect();
    const ox=i*170+5;
    // exactly what game.js does
    p.save(); p.beginPath(); p.rect(ox,5,160,120); p.clip();
    p.translate(ox+160,5); p.scale(-1,1); p.drawImage(src,0,0,160,120); p.restore();
    const box=__rail.previewBox(head,160,120);
    if(box){p.strokeStyle='#c6f578'; p.lineWidth=2; p.strokeRect(ox+box.x,5+box.y,box.w,box.h);}
    p.fillStyle='#cfe6dd'; p.font='11px monospace'; p.fillText(labels[i],ox,141);
    out.push({label:labels[i], headX:head&&+head.x.toFixed(3), boxCentre:box&&+(box.x+box.w/2).toFixed(1)});
  }
  document.body.innerHTML=''; document.body.style.background='#173f49';
  strip.style.cssText='position:fixed;left:20px;top:20px;transform:scale(1.6);transform-origin:top left;image-rendering:pixelated';
  document.body.appendChild(strip);
  return out;
}
"""
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':900,'height':300})
    page.goto(Path('outputs/neon-rail/NEON RAIL.html').resolve().as_uri()+'?qa',wait_until='networkidle')
    page.wait_for_function('!!window.__rail',timeout=60000)
    print(json.dumps(page.evaluate(SHOT),indent=1),flush=True)
    page.wait_for_timeout(300)
    page.screenshot(path='work/overlay-check.png')
    print('wrote work/overlay-check.png',flush=True)
    b.close()

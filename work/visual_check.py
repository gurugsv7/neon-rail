from playwright.sync_api import sync_playwright
import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--enable-webgl','--ignore-gpu-blocklist'])
    page=browser.new_page(viewport={"width":1440,"height":900},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.on('console',lambda msg: print(msg.type, msg.text) if msg.type=='error' else None)
    page.goto('http://127.0.0.1:8765/NEON%20RAIL.html?qa',wait_until='networkidle')
    page.wait_for_timeout(3000)
    page.screenshot(path='work/menu.png')
    print('BUTTONS',page.get_by_role('button').all_text_contents())
    print('SNAPSHOT',page.evaluate('window.__rail?.snapshot()'))
    print('ERRORS',errors)
    if page.evaluate('!!window.__rail'):
        page.get_by_role('button',name='LET’S RUN').click()
        page.wait_for_timeout(1500)
        page.screenshot(path='work/playing.png')
        print('PLAY',page.evaluate('window.__rail.snapshot()'))
    browser.close()

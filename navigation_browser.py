"""Integration checks for camera gestures and keyboard exploration in both apps."""
import json
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
import websocket

ROOT=Path(__file__).resolve().parent
with tempfile.TemporaryDirectory(prefix='atlas-navigation-',ignore_cleanup_errors=True) as profile:
    proc=subprocess.Popen(['C:/Program Files/Google/Chrome/Application/chrome.exe','--headless','--no-first-run','--allow-file-access-from-files','--remote-debugging-port=0','--remote-allow-origins=http://localhost',f'--user-data-dir={profile}','--window-size=1500,1000','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
    ws=None
    try:
        for _ in range(100):
            try:
                port=(Path(profile)/'DevToolsActivePort').read_text().splitlines()[0]
                page=next(p for p in json.load(urllib.request.urlopen(f'http://localhost:{port}/json')) if p['type']=='page')
                break
            except (OSError,StopIteration):time.sleep(.1)
        ws=websocket.create_connection(page['webSocketDebuggerUrl'],origin='http://localhost',timeout=60)
        seq=0
        errors=[]
        def call(method,params=None):
            global seq
            seq+=1;ident=seq;ws.send(json.dumps({'id':ident,'method':method,'params':params or {}}))
            while True:
                r=json.loads(ws.recv())
                if r.get('method')=='Runtime.exceptionThrown':errors.append(r['params'])
                if r.get('id')==ident:return r.get('result',{})
        def js(expr):
            r=call('Runtime.evaluate',{'expression':expr,'returnByValue':True,'awaitPromise':True})
            if 'exceptionDetails' in r:raise RuntimeError(r['exceptionDetails'])
            return r.get('result',{}).get('value')
        def check(expr,name):
            assert js(expr),name
            print('PASS',name,flush=True)
        call('Runtime.enable');call('Page.enable');call('Page.navigate',{'url':(ROOT/'index.html').as_uri()})
        for _ in range(100):
            if js("typeof navigation!=='undefined'&&layers.length&&scene.projected.length>0"):break
            time.sleep(.1)
        check("(()=>{yaw=0;tilt=0;draw();document.querySelector('[data-nav=opposite]').click();return Math.abs(yaw)===180})()",'editor opposite hemisphere')
        check("(()=>{document.querySelector('[data-tool=pan]').click();yaw=0;tilt=0;draw();const r=canvas.getBoundingClientRect(),o={pointerId:1,clientX:r.left+200,clientY:r.top+200,button:2,buttons:2,bubbles:true};canvas.dispatchEvent(new PointerEvent('pointerdown',o));canvas.dispatchEvent(new PointerEvent('pointermove',{...o,clientX:o.clientX+60,clientY:o.clientY+60}));canvas.dispatchEvent(new PointerEvent('pointerup',o));return yaw>10&&tilt<0})()",'editor right drag overrides pan and allows negative tilt')
        check("(()=>{navigation.toggle();const old={...navigation.position},saved=JSON.stringify(playerLocation);navigation.keys.add('KeyW');navigation.step(.2);navigation.keys.clear();const p=scene.project(navigation.position.x,navigation.position.y,0,camera(),true);return navigation.position.y<old.y&&JSON.stringify(playerLocation)===saved&&Math.abs(p.x-$('viewport').clientWidth/2)<5})()",'editor traveler moves and camera follows without modifying location')
        check("(()=>{const saved={...navigation.saved};navigation.toggle(false);return yaw===saved.yaw&&tilt===saved.tilt&&zoom===saved.zoom})()",'editor exit restores previous camera')
        check("(async()=>{canvas.focus();roll=0;canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'e',code:'KeyE',bubbles:true}));await new Promise(r=>setTimeout(r,180));canvas.dispatchEvent(new KeyboardEvent('keyup',{key:'e',code:'KeyE',bubbles:true}));const value=roll;await new Promise(r=>setTimeout(r,80));return value>0&&value<25&&roll===value})()",'held keyboard rotation stops on key release')
        check("(async()=>{window.AtlasScene=AtlasScene;window.AtlasNavigation=AtlasNavigation;const {MapViewer}=await import('./mapa-rpg/viewer.js');const stage=document.createElement('div'),el=document.createElement('canvas');stage.style.cssText='position:absolute;left:0;top:0;width:900px;height:650px;z-index:10;background:#43686e';stage.append(el);document.body.append(stage);window.testViewer=new MapViewer(el,stage,()=>{});await testViewer.load(projectData());return testViewer.layers.length===3&&!!testViewer.scene.gl})()",'viewer loads shared navigation')
        check("(()=>{const v=testViewer;v.tilt(-130);v.rotate(220);return v.c.tilt===-130&&v.c.yaw>=-180&&v.c.yaw<180})()",'viewer freely rotates through both poles')
        check("(()=>{const v=testViewer;v.navigation.toggle();const p={...v.navigation.position};v.navigation.keys.add('KeyD');v.navigation.step(.1);const normal=v.navigation.position.x-p.x;v.navigation.position={...p};v.navigation.keys.add('ShiftLeft');v.navigation.step(.1);const fast=v.navigation.position.x-p.x;v.navigation.keys.clear();return normal>0&&Math.abs(fast/normal-2.5)<.01})()",'viewer WASD movement and Shift running')
        check("(()=>{const v=testViewer;v.rotate(180);const p=v.navigation.position,q=v.scene.project(p.x,p.y,0,v.camera(),true);return q.visible&&Math.abs(q.x-v.stage.clientWidth/2)<5})()",'walking orbit keeps traveler visible')
        check("(async()=>{const v=testViewer;v.canvas.focus();v.canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'w',code:'KeyW',bubbles:true}));v.canvas.blur();await new Promise(r=>setTimeout(r,150));return !v.navigation.keys.size})()",'blur clears movement keys')
        check("(()=>{const v=testViewer;v.canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));return !v.navigation.walking&&v.scene.gl.getError()===0})()",'Escape exits viewer exploration')
        check("(()=>{testViewer.stage.remove();demo();playerLocation={x:4000,y:2200};navigation.toggle();navigation.keys.add('KeyD');navigation.step(.15);navigation.keys.clear();draw();$('toast').classList.remove('show');return !!scene.gl&&scene.gl.getError()===0})()",'character renders over terrain')
        shot=call('Page.captureScreenshot',{'format':'png'})
        import base64
        (ROOT/'navigation-preview.png').write_bytes(base64.b64decode(shot['data']))
        check("(()=>{navigation.toggle(false);layers.forEach(l=>l.planet={enabled:false});textureDirty=true;draw();navigation.toggle();navigation.keys.add('KeyD');navigation.step(.1);navigation.keys.clear();const ok=navigation.position.x>=3200&&navigation.position.x<=4800&&navigation.position.y>=1650&&navigation.position.y<=2750;navigation.toggle(false);$('tilt').value=-180;$('tilt').oninput();return ok&&tilt===-85})()",'flat map movement bounds and tilt remain usable')
        check("(()=>{const p=document.querySelector('.navigation-panel'),buttons=[...p.querySelectorAll('button')],r=p.getBoundingClientRect();return !p.querySelector('p')&&r.width<130&&buttons.every(b=>b.textContent.length<4&&b.getAttribute('aria-label')&&Math.abs(b.offsetWidth-b.offsetHeight)<1)})()",'navigation toolbar has only compact accessible square icons')
        check("(()=>{$('planetMode').checked=false;layers=[layer('Vegetação colorida')];active=0;const t=layers[0].terrain;t.coverage.fill(255);t.heights.fill(120);t.biomes.fill(1);['forest','palms','pines','magic','autumn','jungle'].forEach((biome,i)=>{Terrain.stamp(layers,0,155+i*240,510,{mode:'brush',biome,size:230,strength:1,soft:false,integrate:false})});textureDirty=true;yaw=-15;tilt=55;roll=0;draw();fit();return scene.vegetation.count>50&&Object.keys(scene.vegetation.counts).length===6&&scene.gl.getError()===0})()",'six forest species generate real 3D trunk and crown meshes')
        check("(()=>{$('grassColor').value='#ad54d8';$('grassColor').oninput();$('forestType').value='magic';$('forestType').onchange();$('foliageColor').value='#48e8da';$('foliageColor').oninput();$('trunkColor').value='#8861bd';$('trunkColor').oninput();const t=Terrain.getTheme(),v=scene.vegetation.vertices;return t.grass==='#ad54d8'&&t.magic==='#48e8da'&&t.trunk==='#8861bd'&&Array.from(v).every(Number.isFinite)&&v.some((n,i)=>i%10===9&&n>5)})()",'fantasy palette changes terrain, foliage and elevated mesh geometry')
        check("(async()=>{const {MapViewer}=await import('./mapa-rpg/viewer.js');const stage=document.createElement('div'),el=document.createElement('canvas');stage.style.cssText='width:800px;height:600px;position:absolute;left:-9999px';stage.append(el);document.body.append(stage);const v=new MapViewer(el,stage,()=>{}),data=projectData();await v.load(data);const result=v.scene.vegetation.count===scene.vegetation.count&&Object.keys(v.scene.vegetation.counts).length===6&&Terrain.getTheme().magic==='#48e8da'&&v.scene.gl.getError()===0;stage.remove();return result})()",'saved species and fantasy colors load in the viewer')
        check("(()=>{const t=layers[0].terrain,k=Terrain.index(300,800);t.biomes[k]=0;t.dirty=true;const settings={texture:false,shade:false,contours:false,altitude:false},a=Terrain.render(t,settings).getContext('2d').getImageData(300,800,1,1).data;Terrain.setTheme({...Terrain.getTheme(),grass:'#36dbf1'});t.dirty=true;const b=Terrain.render(t,settings).getContext('2d').getImageData(300,800,1,1).data;return a[0]>a[1]&&b[2]>b[0]})()",'automatic grass honors custom colors')
        js("textureDirty=true;draw();$('toast').classList.remove('show');$('toolsPanel').scrollTop=150");
        shot=call('Page.captureScreenshot',{'format':'png'})
        (ROOT/'vegetation-preview.png').write_bytes(base64.b64decode(shot['data']))
        check("(()=>{const l=layer('Clareira');l.terrain.coverage.fill(255);l.terrain.heights.fill(120);l.terrain.biomes.fill(1);layers.push(l);textureDirty=true;draw();const hidden=scene.vegetation.count===0;l.visible=false;textureDirty=true;draw();return hidden&&scene.vegetation.count>50})()",'upper grass layers mask trees and hiding layers restores forests')
        check("(()=>{const t=layers[0].terrain;t.biomes.fill(2);t.dirty=true;textureDirty=true;draw();return scene.vegetation.count>1000&&scene.vegetation.count<=2200&&scene.gl.getError()===0})()",'dense forest geometry stays within the rendering budget')
        assert not errors,errors
    finally:
        if ws:ws.close()
        proc.terminate()

"""Browser integration: immutable tree colors, object selection and layer transfers."""
import json, subprocess, tempfile, time, urllib.request, base64
from pathlib import Path
import websocket
ROOT=Path(__file__).resolve().parent
with tempfile.TemporaryDirectory(prefix='atlas-selector-',ignore_cleanup_errors=True) as profile:
    proc=subprocess.Popen(['C:/Program Files/Google/Chrome/Application/chrome.exe','--headless','--no-first-run','--allow-file-access-from-files','--remote-debugging-port=0','--remote-allow-origins=http://localhost',f'--user-data-dir={profile}','--window-size=1500,1000','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
    ws=None
    try:
        for _ in range(100):
            try:
                port=(Path(profile)/'DevToolsActivePort').read_text().splitlines()[0]
                page=next(p for p in json.load(urllib.request.urlopen(f'http://localhost:{port}/json')) if p['type']=='page');break
            except (OSError,StopIteration):time.sleep(.1)
        ws=websocket.create_connection(page['webSocketDebuggerUrl'],origin='http://localhost',timeout=60);seq=0;errors=[]
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
        def mouse(kind,p,buttons=0):call('Input.dispatchMouseEvent',{'type':kind,'x':p['x'],'y':p['y'],'button':'left','buttons':buttons,'clickCount':1})
        def click(p):mouse('mousePressed',p,1);mouse('mouseReleased',p)
        call('Runtime.enable');call('Page.enable');call('Page.navigate',{'url':(ROOT/'index.html').as_uri()})
        for _ in range(100):
            if js("typeof Selector!=='undefined'&&layers.length&&scene.projected.length>0"):break
            time.sleep(.1)
        check("(()=>{$('planetMode').checked=false;layers=[layer('Base'),layer('Objetos')];active=0;const t=layers[0].terrain;t.coverage.fill(255);t.heights.fill(120);t.biomes.fill(1);Terrain.stamp(layers,0,1050,500,{mode:'brush',biome:'forest',size:170,strength:1,soft:false,integrate:false});layers[0].objects.push({kind:'building',building:'house',x:400,y:600,size:40,rotation:0,text:'Casa selecionável',color:'#ffffff'});textureDirty=true;yaw=0;tilt=0;roll=0;render();fit();window.oldMesh=scene.vegetation.vertices.slice();window.oldTree=scene.vegetation.entries[0];window.oldTexture=layers[0].terrain.surface.toDataURL();history=[];future=[];return oldTree&&oldTree.foliage===Terrain.getTheme().trees})()",'initial forest captures its painted colors')
        check("(()=>{$('forestType').value='forest';$('foliageColor').value='#ef459b';$('foliageColor').oninput();$('trunkColor').value='#419fee';$('trunkColor').oninput();const mesh=scene.vegetation.vertices;return mesh.length===oldMesh.length&&mesh.every((v,i)=>v===oldMesh[i])&&layers[0].terrain.surface.toDataURL()===oldTexture})()",'changing palette leaves existing tree meshes and textures unchanged')
        check("(()=>{Terrain.stamp(layers,0,720,500,{mode:'brush',biome:'forest',size:150,strength:1,soft:false,integrate:false});textureDirty=true;draw();const entries=scene.vegetation.entries,old=entries.filter(e=>e.x>950),fresh=entries.filter(e=>e.x<850);return old.length&&fresh.length&&old.every(e=>e.foliage===oldTree.foliage&&e.trunk===oldTree.trunk)&&fresh.every(e=>e.foliage==='#ef459b'&&e.trunk==='#419fee')})()",'new forests use new colors alongside existing forests')
        js("document.querySelector('[data-tool=select]').click()");
        p=js("(()=>{const h=billboardHits.find(h=>h.object.kind==='building'),r=canvas.getBoundingClientRect();return {x:r.left+h.box.x+h.box.w/2,y:r.top+h.box.y+h.box.h/2}})()")
        mouse('mousePressed',p,1);target={'x':p['x']+js('zoom')*80,'y':p['y']+js('zoom')*30};mouse('mouseMoved',target,1);mouse('mouseReleased',target)
        check("(()=>{const o=layers[0].objects[0];return Selector.selected?.object===o&&Math.abs(o.x-480)<1&&Math.abs(o.y-630)<1&&!layers[0].ink&&!document.querySelector('.selection-panel').hidden})()",'selector drags buildings without painting the map')
        check("(()=>{$('selectionX').value=520;$('selectionY').value=680;$('selectionMove').click();return layers[0].objects[0].x===520&&layers[0].objects[0].y===680})()",'position fields move the selected object')
        check("(()=>{$('selectionLayer').value=1;$('selectionTransfer').click();return !layers[0].objects.length&&layers[1].objects.length===1&&Selector.selected.layer===1})()",'selected building transfers between layers')
        check("(()=>{undo();const restored=layers[0].objects.length===1&&layers[1].objects.length===0;undo(true);return restored&&layers[1].objects.length===1&&layers[0].objects.length===0})()",'undo and redo preserve layer transfers')
        js("layers[0].routes.push({kind:'path',width:8,points:[{x:100,y:150},{x:200,y:150}]});textureDirty=true;draw()");
        click(js("(()=>{const p=scene.project(150,150,0,camera()),r=canvas.getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top}})()"))
        check("(()=>{if(Selector.selected?.collection!=='routes')return false;Selector.moveTo(300,200);Selector.transfer(1);const r=layers[1].routes[0];return r&&r.points[0].x===250&&r.points[0].y===200&&r.points[1].x===350&&r.points[1].y===200})()",'selector moves paths as a whole and changes their layer')
        js("layers[0].tunnels.push({a:{x:700,y:200},b:{x:900,y:200},width:18,depth:90,route:[{x:700,y:200,z:-90},{x:900,y:200,z:-90}]});textureDirty=true;draw()");
        click(js("(()=>{const h=billboardHits.find(h=>h.tunnel),r=canvas.getBoundingClientRect();return {x:r.left+h.box.x+h.box.w/2,y:r.top+h.box.y+h.box.h/2}})()"))
        check("(()=>{if(Selector.selected?.collection!=='tunnels')return false;Selector.moveTo(600,300);Selector.transfer(1);const t=layers[1].tunnels[0];return t.a.x===500&&t.b.x===700&&t.a.y===300&&t.route[0].x===500&&t.route[0].y===300})()",'tunnel moves preserve both portals and the underground route')
        click(js("(()=>{const e=scene.vegetation.entries.find(e=>!e.object&&e.x>950),b=Selector.treeBox(e),r=canvas.getBoundingClientRect();return {x:r.left+b.x+b.w/2,y:r.top+b.y+b.h/2}})()"))
        check("(()=>{if(!Selector.selected?.generated)return false;const count=scene.vegetation.count;$('selectionColor').value='#bceb4a';$('selectionColor').onchange();const o=Selector.selected.object;return o.kind==='tree'&&o.color==='#bceb4a'&&scene.vegetation.count===count&&layers[0].terrain.treeExclusions.size===1&&scene.vegetation.entries.filter(e=>!e.object&&e.x>950).every(e=>e.foliage===oldTree.foliage)})()",'explicit recoloring changes only the selected generated tree')
        check("(()=>{Selector.moveTo(1200,750);Selector.transfer(1);const o=Selector.selected.object;return o.x===1200&&o.y===750&&layers[1].objects.includes(o)&&!layers[0].objects.includes(o)&&o.color==='#bceb4a'})()",'individual generated trees move between positions and layers')
        check("(()=>{const o=Selector.selected.object,before={...o};layers[1].locked=true;Selector.moveTo(300,300);layers[1].locked=false;layers[0].locked=true;Selector.transfer(0);layers[0].locked=false;return o.x===before.x&&o.y===before.y&&Selector.selected.layer===1})()",'locked source and destination layers reject edits')
        check("(async()=>{const {MapViewer}=await import('./mapa-rpg/viewer.js');const stage=document.createElement('div'),el=document.createElement('canvas');stage.style.cssText='width:800px;height:600px;position:absolute;left:-9999px';stage.append(el);document.body.append(stage);const v=new MapViewer(el,stage,()=>{});await v.load(projectData());const tree=v.layers[1].objects.find(o=>o.kind==='tree'),entries=v.scene.vegetation.entries,result=tree&&tree.x===1200&&tree.y===750&&tree.color==='#bceb4a'&&entries.filter(e=>e.object).length===1&&entries.filter(e=>!e.object&&e.x>950).every(e=>e.foliage===oldTree.foliage);stage.remove();return result})()",'viewer preserves tree exclusions, edited positions and fixed colors')
        check("(()=>{const data=Terrain.serialize(layers[0].terrain);delete data.treeStyles;delete data.treeStyleIds;delete data.treeExclusions;Terrain.setTheme({...Terrain.getTheme(),trees:'#395b79'});const t=Terrain.validate(data);Terrain.freezeTreeColors(t);const before=t.treeStyles.map(s=>s.foliage).join();Terrain.setTheme({...Terrain.getTheme(),trees:'#f3b777'});Terrain.freezeTreeColors(t);return before===t.treeStyles.map(s=>s.foliage).join()})()",'legacy forests freeze their existing palette during migration')
        js("Terrain.setTheme({...Terrain.getTheme(),trees:'#ef459b'});textureDirty=true;render();$('toolsPanel').scrollTop=0;$('toast').classList.remove('show')");
        shot=call('Page.captureScreenshot',{'format':'png'});(ROOT/'selector-preview.png').write_bytes(base64.b64decode(shot['data']))
        assert not errors,errors
    finally:
        if ws:ws.close()
        proc.terminate()

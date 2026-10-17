"""Real Chrome regression: CSS pixels, planet/crop picking and pointer lifecycle."""
import json, subprocess, tempfile, time, urllib.request, sys, base64
from pathlib import Path
import websocket

root = Path(__file__).resolve().parents[1]
profile = Path(tempfile.mkdtemp(prefix='atlas-coordinates-'))
chrome_args = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '--headless',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run',
    '--no-default-browser-check', '--allow-file-access-from-files',
    '--remote-debugging-port=0', '--remote-allow-origins=http://localhost',
    f'--user-data-dir={profile}', 'about:blank'
]
if '--hardware' in sys.argv:
    chrome_args=[arg for arg in chrome_args if arg not in ['--use-angle=swiftshader','--enable-unsafe-swiftshader']]
proc = subprocess.Popen(chrome_args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
ws = None
seq = 0
errors = []

def call(method, params=None):
    global seq
    seq += 1
    ws.send(json.dumps({'id': seq, 'method': method, 'params': params or {}}))
    while True:
        reply = json.loads(ws.recv())
        if reply.get('method') == 'Runtime.exceptionThrown':
            errors.append(reply['params']['exceptionDetails'])
        if reply.get('id') == seq:
            if 'error' in reply:
                raise RuntimeError(reply['error'])
            return reply.get('result', {})

def js(expression):
    reply = call('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True})
    if 'exceptionDetails' in reply:
        raise RuntimeError(reply['exceptionDetails'])
    return reply.get('result', {}).get('value')

def check(expression, label):
    result = js(expression)
    assert result, (label, result)
    print('PASS', label, flush=True)

def mouse(kind, p, buttons=0):
    call('Input.dispatchMouseEvent', {'type': kind, 'x': p['x'], 'y': p['y'],
        'button': 'left', 'buttons': buttons, 'clickCount': 1})

try:
    for _ in range(100):
        try:
            port=(profile/'DevToolsActivePort').read_text().splitlines()[0]
            pages=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json',timeout=2));page=next(p for p in pages if p['type']=='page');break
        except (OSError,StopIteration):time.sleep(.1)
    ws=websocket.create_connection(page['webSocketDebuggerUrl'],origin='http://localhost',timeout=90)
    call('Page.enable');call('Runtime.enable')
    call('Emulation.setDeviceMetricsOverride',{'width':1600,'height':1000,'deviceScaleFactor':1,'mobile':False})
    call('Page.navigate',{'url':(root/'index.html').as_uri()})
    for _ in range(150):
        if js("document.readyState==='complete'&&typeof scene!=='undefined'&&typeof sessionRestoring!=='undefined'&&!sessionRestoring"):break
        time.sleep(.2)
    js("window.openTestProject=$('file').onchange;$('file').onchange=null;dirty=false")
    doc=call('DOM.getDocument');node=call('DOM.querySelector',{'nodeId':doc['root']['nodeId'],'selector':'#file'})['nodeId']
    call('DOM.setFileInputFiles',{'nodeId':node,'files':[str(root/'Aeon RPG.json')]})
    check("openTestProject({target:$('file'),fromDrive:true,discardConfirmed:true})",'Aeon RPG imports')
    js("""end();if(lightweight)lightModeButton.click();window.beforeProject=JSON.stringify(projectData());
        const candidates=Billboards.collect(layers,true).filter(e=>['castle','village','tower','house'].includes(e.object.building));window.testBuilding=candidates.find(e=>e.object.building==='castle')||candidates[0];
        const o=testBuilding.object;enterFlatRegion({x:o.x+3200-180,y:o.y+1650-125,width:360,height:250});
        window.flushModels=()=>{const r=canvas.getBoundingClientRect();scene.draw(r.width,r.height,1,{...camera(),fullQuality:true});draw();};flushModels();
    """)
    full=js("({bytes:scene.buildings.vertices.byteLength+scene.buildings.indices.byteLength,rawBytes:scene.buildings.originalBytes,triangles:scene.buildings.indices.length/3,entries:scene.buildings.entries.length})")
    check("scene.buildings.indices.length>0&&scene.gl.getError()===0",'indexed full quality meshes render on GPU')
    js("""tool='select';window.rotationOriginal={...testBuilding.object};
        const hit=billboardHits.find(h=>(h.originalObject||h.object)===testBuilding.object),rotationRect=canvas.getBoundingClientRect();
        if(!hit)throw Error('Missing building selection hit');
        Selector.pick({clientX:rotationRect.left+hit.box.x+hit.box.w/2,clientY:rotationRect.top+hit.box.y+hit.box.h/2,pointerId:1});Selector.finish();draw();
        if(Selector.selected?.object!==testBuilding.object)throw Error('Wrong building selected');
        window.rotationTerrain=scene.vertices;window.rotationMesh=scene.buildings.vertices;window.rotationUpdates=0;
        window.rotationUpdate=scene.update;scene.update=function(...args){rotationUpdates++;return rotationUpdate.apply(this,args);};
    """)
    handle=js("(()=>{const h=Selector.gizmo.handles.find(h=>h.mode==='rotate'),r=canvas.getBoundingClientRect();return {x:h.x+r.left,y:h.y+r.top};})()")
    mouse('mousePressed',handle,1)
    for i in range(12):
        mouse('mouseMoved',{'x':handle['x']+i*3,'y':handle['y']+i*2},1)
        js('new Promise(resolve=>requestAnimationFrame(()=>resolve(true)))')
    check('testBuilding.object.rotation!==rotationOriginal.rotation&&rotationUpdates===0&&scene.vertices===rotationTerrain&&scene.buildings.vertices===rotationMesh&&scene.gl.getError()===0','real building rotation drag reuses terrain and GPU meshes on Aeon RPG')
    mouse('mouseReleased',handle)
    js("scene.update=rotationUpdate;for(const key of Object.keys(testBuilding.object))delete testBuilding.object[key];Object.assign(testBuilding.object,rotationOriginal);Selector.clear();textureDirty=true;flushModels();")
    (root/'buildings-map-full-preview.png').write_bytes(base64.b64decode(call('Page.captureScreenshot',{'format':'png'})['data']))
    js('lightModeButton.click();flushModels()')
    light=js("({bytes:scene.buildings.vertices.byteLength+scene.buildings.indices.byteLength,rawBytes:scene.buildings.originalBytes,triangles:scene.buildings.indices.length/3,entries:scene.buildings.entries.length})")
    assert light['triangles']<full['triangles'],(full,light)
    check("lightModeButton.getAttribute('aria-pressed')==='true'&&localStorage.getItem('atlas-editor-lightweight')==='true'",'light button is visible and persists editor preference')
    check("JSON.stringify(projectData())===beforeProject",'light mode does not modify the project or viewer settings')
    check("scene.gl.getError()===0",'light meshes render without WebGL errors')
    (root/'buildings-map-light-preview.png').write_bytes(base64.b64decode(call('Page.captureScreenshot',{'format':'png'})['data']))
    js("""const r=canvas.getBoundingClientRect();scene.draw(r.width,r.height,1,{...camera(),lightweight:false,fullQuality:true});""")
    assert js('scene.buildings.indices.length/3')==full['triangles'],'export restores every full quality triangle'
    check('camera().lightweight','export override does not change the editor preference')
    js("""end();leaveFlatRegion();lightweight=false;syncLightMode();layers=[layer('Encosta')];layers[0].planet.enabled=false;active=0;patches=[];
        const t=layers[0].terrain;t.coverage.fill(255);t.biomes.fill(1);for(let y=0;y<275;y++)for(let x=0;x<400;x++)t.heights[y*400+x]=400+Math.sin(x*.045)*210+y*.65;
        const names=['house','village','tower','castle'];for(let style=0;style<3;style++)for(let i=0;i<4;i++)layers[0].objects.push({kind:'building',building:names[i],buildingStyle:style,buildingPalette:style,x:320+i*320,y:270+style*290,size:150,rotation:25,text:'',color:'#ffffff'});
        yaw=-12;tilt=48;roll=0;relief=1;textureDirty=true;fit();flushModels();
    """)
    check('scene.buildings.entries.length===12&&scene.gl.getError()===0','all twelve houses, towns, towers and castles adapt to slopes')
    (root/'buildings-ground-full-preview.png').write_bytes(base64.b64decode(call('Page.captureScreenshot',{'format':'png'})['data']))
    js('lightModeButton.click();flushModels()')
    (root/'buildings-ground-light-preview.png').write_bytes(base64.b64decode(call('Page.captureScreenshot',{'format':'png'})['data']))
    js('dirty=false')
    call('Page.navigate',{'url':(root/'tools/buildings-viewer-fixture.html').as_uri()})
    for _ in range(150):
        if js("typeof viewerResult!=='undefined'"):break
        if errors:raise RuntimeError(errors)
        time.sleep(.2)
    check('viewerResult.entries===12&&viewerResult.triangles===viewerResult.expected&&viewerResult.error===0','viewer always renders complete models, even with editor light preference')
    (root/'buildings-viewer-preview.png').write_bytes(base64.b64decode(call('Page.captureScreenshot',{'format':'png'})['data']))
    assert not errors,errors
    result={'map':'Aeon RPG.json','full':full,'light':light,'memorySavedWithoutVisualLossPercent':round(100*(1-full['bytes']/full['rawBytes']),1),'lightTriangleReductionPercent':round(100*(1-light['triangles']/full['triangles']),1),'viewerFullQuality':js('viewerResult'),'browserErrors':errors}
    (root/'tools/buildings-audit-results.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result),flush=True)
finally:
    if ws:ws.close()
    proc.terminate()

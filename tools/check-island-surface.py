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
            port=(profile/'DevToolsActivePort').read_text().splitlines()[0];pages=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json'));page=next(p for p in pages if p['type']=='page');break
        except (OSError,StopIteration):time.sleep(.1)
    ws=websocket.create_connection(page['webSocketDebuggerUrl'],origin='http://localhost',timeout=60)
    call('Page.enable');call('Runtime.enable');call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':900,'deviceScaleFactor':1,'mobile':False})
    call('Page.navigate',{'url':(root/'index.html').as_uri()})
    for _ in range(150):
        if js("typeof sessionRestoring!=='undefined'&&!sessionRestoring"):break
        time.sleep(.2)
    js("relief=.3;window.island={kind:'building',building:'floatingIsland',x:800,y:550,size:100,rotation:0,elevation:100,text:'Ilha de teste',color:'#ffffff'};layers[active].objects.push(island);window.mainLayers=layers;window.mainHeight=Terrain.sample(layers,800,550);focusFloatingIsland(island)")
    check('!!submapEdit.island&&layers!==mainLayers&&!worldMode()&&!flatRegion','island opens independently of the main map')
    check('Terrain.sample(layers,100,100)===null&&Terrain.sample(layers,800,550)===0','only the island footprint is visible')
    check("(()=>{const p=scene.project(100,100,0,camera()),r=canvas.getBoundingClientRect();return !point({clientX:r.left+p.x,clientY:r.top+p.y}).inside})()",'outside the island cannot be edited')
    check("(()=>{const r=canvas.getBoundingClientRect(),p=scene.project(800,550,0,camera());canvas.onpointermove({clientX:r.left+p.x,clientY:r.top+p.y,pointerId:99});return $('altitudeReadout').textContent==='0 m'})()",'island base reads zero metres')
    js("tool='raise';paint({x:800,y:550,inside:true},{x:800,y:550,inside:true});draw();window.editedHeight=Terrain.sample(layers,800,550);yaw=45;tilt=40;roll=15;draw()")
    check('editedHeight>0&&scene.gl.getError()===0','surface can be sculpted and rotated')
    js('leaveSubmap()')
    check('layers===mainLayers&&Terrain.sample(layers,800,550)===mainHeight&&!!island.surface','saving restores main map without modifying its terrain')
    check("(()=>{const mesh=Buildings3D.build(layers,false).vertices;return mesh.some((v,i)=>i%15===5&&v===12)&&mesh.every(Number.isFinite)})()",'complete map renders the saved island surface geometry')
    js("enterFlatRegion({x:3700,y:2000,width:600,height:400});const r=canvas.getBoundingClientRect();scene.draw(r.width,r.height,1,{...camera(),fullQuality:true});")
    check('scene.gl.getError()===0&&scene.buildings.indices.length>0','saved surface renders on GPU in complete map')
    result=js("""(()=>{const terrain=scene.vertices,mesh=scene.buildings.vertices,original={size:island.size,rotation:island.rotation,elevation:island.elevation},t=performance.now();for(let i=0;i<20;i++){const previous={size:island.size,rotation:island.rotation,elevation:island.elevation};Object.assign(island,{size:original.size*(1+(i%2)*.05),rotation:original.rotation+i,elevation:original.elevation+i});if(!scene.transformBuilding(island,previous))throw Error('Missing resident island');scene.draw(canvas.clientWidth,canvas.clientHeight,1,{...camera(),interacting:true});}const previous={size:island.size,rotation:island.rotation,elevation:island.elevation};Object.assign(island,original);scene.transformBuilding(island,previous);return {transform20Ms:performance.now()-t,reusesTerrain:terrain===scene.vertices,reusesBuildingMesh:mesh===scene.buildings.vertices};})()""")
    assert result['reusesTerrain'] and result['reusesBuildingMesh'],result
    print(json.dumps(result),flush=True)
    js('leaveFlatRegion()')
    check("Math.abs(relief-.3)<.001&&Math.abs(Number($('relief').value)-.3)<.001",'global relief and slider restore correctly')
    check("$('relief').closest('.global-relief').parentElement.id==='layersPanel'",'global relief is pinned below the layers')
    js('focusFloatingIsland(island)')
    check('Math.abs(Terrain.sample(layers,800,550)-editedHeight)<.11','island surface edits survive reopening')
    (root/'island-isolated-preview.png').write_bytes(base64.b64decode(call('Page.captureScreenshot',{'format':'png'})['data']))
    assert not errors,errors
    print('All isolated island checks passed',flush=True)
finally:
    if ws:ws.close()
    proc.terminate()

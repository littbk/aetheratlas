"""Real Chrome regression: place markers under the mouse in populated geographic crops."""
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

results=[]
try:
    for _ in range(100):
        try:
            port=(profile/'DevToolsActivePort').read_text().splitlines()[0]
            pages=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json',timeout=2));page=next(p for p in pages if p['type']=='page');break
        except (OSError,StopIteration):time.sleep(.1)
    ws=websocket.create_connection(page['webSocketDebuggerUrl'],origin='http://localhost',timeout=90)
    call('Page.enable');call('Runtime.enable')
    call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':900,'deviceScaleFactor':1,'mobile':False})
    for entry in ['index.html','public/index.html']:
        call('Page.navigate',{'url':(root/entry).as_uri()})
        for _ in range(150):
            if js("document.readyState==='complete'&&typeof sessionRestoring!=='undefined'&&!sessionRestoring"):break
            time.sleep(.2)
        js("window.openTestProject=$('file').onchange;$('file').onchange=null;dirty=false")
        doc=call('DOM.getDocument');node=call('DOM.querySelector',{'nodeId':doc['root']['nodeId'],'selector':'#file'})['nodeId']
        call('DOM.setFileInputFiles',{'nodeId':node,'files':[str(root/'Aeon RPG.json')]})
        check("openTestProject({target:$('file'),fromDrive:true,discardConfirmed:true})",entry+' Aeon RPG imports')
        js('end();window.polarOriginalLayers=layers;window.polarOriginalTerrain=layers[0].terrain;')
        for lon,lat in [(0,0),(179,0),(-179,35),(0,85),(0,-85),(0,90),(0,-90)]:
            js('end();yaw='+str(-lon)+';tilt='+str(-lat)+';roll=25;fit();draw();regionView.button.click()')
            p=js('(()=>{const p=scene.project('+str((lon/360+.5)*8000)+','+str((.5-lat/180)*4400)+',0,camera(),true),r=canvas.getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top};})()')
            mouse('mousePressed',{'x':p['x']-60,'y':p['y']-60},1);mouse('mouseReleased',{'x':p['x']+60,'y':p['y']+60})
            js("regionView.controls.querySelector('.region-view-confirm').click();window.editActive=active;layers.push(layer('Teste de coordenadas'));active=layers.length-1;tool='marker';selectedBuilding=null;yaw=23;roll=31;tilt=0;textureDirty=true;render();draw();")
            p=js("""(()=>{const r=flatRegion,v=scene.vertices,tx=r.x+r.width/2,ty=r.y+r.height/2;let best=null,distance=Infinity;for(let i=0;i<v.length;i+=18){const x=(v[i+3]+v[i+9]+v[i+15])*8000/3,y=(v[i+4]+v[i+10]+v[i+16])*4400/3,z=(v[i+2]+v[i+8]+v[i+14])/3,d=Math.hypot(x-tx,y-ty);if(d<distance){distance=d;best={x,y,z};}}const p=scene.project(best.x,best.y,best.z,camera(),true),box=canvas.getBoundingClientRect(),client={clientX:box.left+p.x,clientY:box.top+p.y};window.editExpected=point(client);if(!editExpected.inside)throw Error('Invalid editing point');return {x:client.clientX,y:client.clientY};})()""")
            mouse('mousePressed',p,1);mouse('mouseReleased',p)
            check("(()=>{const r=WorldSurface.locate(editExpected.x,editExpected.y),l=WorldSurface.child(layers[active],r.gx,r.gy),o=l?.objects.at(-1);return o&&Math.hypot(o.x+r.gx*1600-editExpected.x,o.y+r.gy*1100-editExpected.y)<.01&&!down&&!pointers.size&&scene.gl.getError()===0;})()",entry+' populated map marker under mouse '+str((lon,lat)))
            js('layers.pop();active=editActive;history=[];future=[];textureDirty=true;leaveFlatRegion();dirty=false')
    assert not errors,errors
finally:
    if ws:ws.close()
    proc.terminate()

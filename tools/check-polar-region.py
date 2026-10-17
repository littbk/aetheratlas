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
        for north in [True,False]:
            js('end();yaw=0;roll=0;tilt='+str(-90 if north else 90)+';fit();draw();var viewport=canvas.getBoundingClientRect();scene.draw(viewport.width,viewport.height,1,{...camera(),fullQuality:true});')
            p=js('(()=>{const p=scene.project(4000,'+str(0 if north else 4400)+',0,camera(),true),r=canvas.getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top,visible:p.visible};})()')
            assert p['visible'],p
            js('regionView.button.click()')
            a={'x':p['x']-65,'y':p['y']-65};b={'x':p['x']+65,'y':p['y']+65}
            mouse('mousePressed',a,1);mouse('mouseMoved',b,1);mouse('mouseReleased',b)
            preview=js('regionView.preview')
            assert preview and preview['x']==0 and preview['width']==8000,preview
            assert (preview['y']==0 if north else abs(preview['y']+preview['height']-4400)<.01),preview
            js("regionView.controls.querySelector('.region-view-confirm').click()")
            check('!!flatRegion&&scene.gl.getError()===0&&layers===polarOriginalLayers&&layers[0].terrain===polarOriginalTerrain',entry+(' north' if north else ' south')+' pole square selection opens without altering terrain')
            print(json.dumps({'entry':entry,'north':north,'region':preview}),flush=True)
            js('leaveFlatRegion();dirty=false')
    assert not errors,errors
finally:
    if ws:ws.close()
    proc.terminate()


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
    js("""window.labelObject=layers.flatMap(l=>l.objects).find(o=>o.text==='Velho Pantano');const o=labelObject;enterFlatRegion({x:o.x+3200-200,y:o.y+1650-150,width:400,height:300});tool='select';draw();const hit=billboardHits.find(h=>(h.originalObject||h.object)===o),r=canvas.getBoundingClientRect();Selector.pick({clientX:r.left+hit.box.x+hit.box.w/2,clientY:r.top+hit.box.y+hit.box.h/2,pointerId:99});Selector.finish();window.oldUpdates=scene.update.bind(scene);window.updateCount=0;scene.update=(...args)=>{updateCount++;return oldUpdates(...args)};window.textColors=[];const original=ctx.fillText.bind(ctx);ctx.fillText=(text,...args)=>{if(text==='Velho Pantano')textColors.push(ctx.fillStyle);original(text,...args)};window.oldHistory=history.length;""")
    js("""for(const color of ['#ff0000','#00ff00','#1234ef']){$('selectionColor').value=color;$('selectionColor').oninput();}draw();$('selectionColor').onchange();""")
    check("labelObject.color==='#1234ef'&&textColors.includes('#1234ef')",'Velho Pantano visibly renders the selected color')
    check("updateCount===0&&history.length===oldHistory+1",'color picker avoids terrain rebuilds and records one undo step')
    assert not errors,errors
    print('Text color checks passed',flush=True)
finally:
    if ws:ws.close()
    proc.terminate()

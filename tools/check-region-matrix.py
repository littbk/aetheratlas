"""Real Chrome regression: populated world selection across latitude, longitude, camera and DPR."""
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
        locations=[(-180,0),(-135,0),(-90,0),(-45,0),(0,0),(45,0),(90,0),(135,0),(179,0),(-120,35),(0,35),(120,35),(-120,-35),(0,-35),(120,-35),(-60,70),(60,70),(-60,-70),(60,-70),(0,88),(0,-88),(0,90),(0,-90)]
        for profile in [0,1]:
            call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':900,'deviceScaleFactor':1 if profile==0 else 2,'mobile':False})
            for lon,lat in locations:
                js('end();yaw='+str(-lon)+';roll='+str(profile*37)+';tilt='+str(-lat)+';fit();zoom*='+str(1 if profile==0 else 1.7)+';draw();')
                p=js('(()=>{const p=scene.project('+str((lon/360+.5)*8000)+','+str((.5-lat/180)*4400)+',0,camera(),true),r=canvas.getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top,visible:p.visible};})()')
                assert p['visible'],(lon,lat,p)
                js('window.regionCamera={yaw,tilt,roll,relief,zoom,ox,oy};regionView.button.click()')
                half=40 if profile==0 else 90
                a={'x':p['x']-half,'y':p['y']-half};b={'x':p['x']+half,'y':p['y']+half}
                mouse('mousePressed',a,1);mouse('mouseMoved',b,1);mouse('mouseReleased',b)
                result=js("""(()=>{const area=regionView.preview;if(!area)throw Error('No preview');const r=canvas.getBoundingClientRect(),a="""+json.dumps(a)+",b="+json.dumps(b)+""",missed=[];let count=0,error=0;for(let j=0;j<=32;j++)for(let i=0;i<=32;i++){const h=scene.pick(a.x+(b.x-a.x)*i/32-r.left,a.y+(b.y-a.y)*j/32-r.top);if(!regionView.valid(h))continue;count++;const d=Math.max(area.x-h.worldX,h.worldX-area.x-area.width,area.y-h.worldY,h.worldY-area.y-area.height,0);error=Math.max(error,d);if(d>1)missed.push(h);}return {area,count,maxOutside:error,missed:missed.slice(0,2)};})()""")
                assert result['count']>0,(lon,lat,result)
                results.append({'entry':entry,'dpr':1 if profile==0 else 2,'lon':lon,'lat':lat,**result})
                js("regionView.controls.querySelector('.region-view-confirm').click()")
                check('!!flatRegion&&scene.gl.getError()===0&&layers===polarOriginalLayers&&layers[0].terrain===polarOriginalTerrain&&!down&&!pointers.size',entry+' location '+str((lon,lat,profile))+' opens safely')
                precision=js("""(()=>{yaw=31;tilt=0;roll=23;draw();const r=flatRegion,c=camera(),samples=[],v=scene.vertices;for(const [u,w] of [[.25,.25],[.5,.5],[.75,.75]]){const tx=r.x+r.width*u,ty=r.y+r.height*w;let best=null,distance=Infinity;for(let i=0;i<v.length;i+=18){const x=(v[i+3]+v[i+9]+v[i+15])*8000/3,y=(v[i+4]+v[i+10]+v[i+16])*4400/3,z=(v[i+2]+v[i+8]+v[i+14])/3,d=Math.hypot(x-tx,y-ty);if(d<distance){distance=d;best={x,y,z};}}const p=scene.project(best.x,best.y,best.z,c,true),h=scene.pick(p.x,p.y);if(h)samples.push(Math.hypot(h.worldX-best.x,h.worldY-best.y));}return samples;})()""")
                assert precision and max(precision)<12,(lon,lat,profile,precision)
                js('leaveFlatRegion();dirty=false')
                check('Object.entries(regionCamera).every(([key,value])=>({yaw,tilt,roll,relief,zoom,ox,oy})[key]===value)',entry+' restores globe camera')
        js('dirty=false')
    (root/'tools/region-matrix-results.json').write_text(json.dumps(results,indent=2)+'\n')
    failed=[r for r in results if r['maxOutside']>1]
    print(json.dumps({'cases':len(results),'sampledPoints':sum(r['count'] for r in results),'missedCases':len(failed),'worstOutside':max(r['maxOutside'] for r in results),'examples':failed[:3]}),flush=True)
    assert not failed,'Selection omitted surface points; see results file'
    assert not errors,errors
finally:
    if ws:ws.close()
    proc.terminate()

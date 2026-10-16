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
            port = (profile/'DevToolsActivePort').read_text().splitlines()[0]
            pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json', timeout=2))
            page = next(p for p in pages if p['type'] == 'page')
            break
        except (OSError, StopIteration):
            time.sleep(.1)
    ws = websocket.create_connection(page['webSocketDebuggerUrl'], origin='http://localhost', timeout=60)
    call('Page.enable'); call('Runtime.enable')
    if '--map-only' in sys.argv:
        call('Emulation.setDeviceMetricsOverride', {'width':1440,'height':900,'deviceScaleFactor':1.5,'mobile':False})
        call('Page.navigate', {'url': (root/'index.html').as_uri()})
        for _ in range(150):
            if js("document.readyState==='complete'&&typeof scene!=='undefined'&&typeof sessionRestoring!=='undefined'&&!sessionRestoring"):
                break
            time.sleep(.2)
        js("window.openTestProject=$('file').onchange;$('file').onchange=null;dirty=false")
        doc=call('DOM.getDocument')
        node=call('DOM.querySelector', {'nodeId':doc['root']['nodeId'],'selector':'#file'})['nodeId']
        call('DOM.setFileInputFiles', {'nodeId':node,'files':[str(root/'Aeon RPG.json')]})
        check("openTestProject({target:$('file'),fromDrive:true,discardConfirmed:true})", 'Aeon RPG imports')
        print(json.dumps({'renderer':js("(()=>{const gl=scene.gl,e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unavailable'})()")}),flush=True)
        print(json.dumps(js("({layers:layers.length,tiles:layers.reduce((n,l)=>n+(l.tiles?.length||0),0),objects:layers.reduce((n,l)=>n+l.objects.length,0),stats:scene.performanceStats})")), flush=True)
        for mode in ['planet','crop']:
            js("end();if(flatRegion)leaveFlatRegion();if('%s'==='crop')enterFlatRegion({x:3200,y:1650,width:1600,height:1100});tool='raise';active=1;$('size').value=48;$('amount').value=20;" % mode)
            result=js("""(()=>{
                const times=[],c=camera(),r=canvas.getBoundingClientRect();
                for(let i=0;i<12;i++){const t=performance.now();draw();times.push(performance.now()-t);}
                let t=performance.now();for(let i=0;i<500;i++)scene.pick(r.width/2+i%20,r.height/2+i%10);const picks=performance.now()-t;
                const p=scene.pick(r.width/2,r.height/2);window.strokeAt=p;
                return {drawMs:times,pick500Ms:picks,point:p,stats:scene.performanceStats};
            })()""")
            print(json.dumps({'mode':mode,'beforeStroke':result}), flush=True)
            p=js("(()=>{const r=canvas.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()")
            js("window.moveCosts=[];window.drawCosts=[];window.testMove=canvas.onpointermove;canvas.onpointermove=e=>{const t=performance.now();testMove(e);moveCosts.push(performance.now()-t)};window.testDraw=draw;draw=(...a)=>{const t=performance.now();testDraw(...a);drawCosts.push({ms:performance.now()-t,interacting:camera().interacting})}")
            call('Profiler.enable');call('Profiler.start')
            start=time.perf_counter();mouse('mousePressed',p,1)
            print(json.dumps({'mode':mode,'stateDuringStroke':js('({down,strokeStarted,tool,interacting:camera().interacting})')}),flush=True)
            moves=[]
            for i in range(20):
                t=time.perf_counter();mouse('mouseMoved',{'x':p['x']+i*2,'y':p['y']+i*.5},1);moves.append((time.perf_counter()-t)*1000)
            mouse('mouseReleased',{'x':p['x']+38,'y':p['y']+9})
            print(json.dumps({'mode':mode,'strokeSeconds':time.perf_counter()-start,'moveMs':moves,'stats':js('scene.performanceStats')}),flush=True)
            print(json.dumps({'mode':mode,'handlerAndDrawMs':js('({moves:moveCosts,draws:drawCosts})')}),flush=True)
            js('canvas.onpointermove=testMove;draw=testDraw')
            profileData=call('Profiler.stop')['profile'];nodes={n['id']:n for n in profileData['nodes']};costs={}
            for ident,delta in zip(profileData.get('samples',[]),profileData.get('timeDeltas',[])):
                name=nodes[ident]['callFrame']['functionName'] or '(anonymous)';costs[name]=costs.get(name,0)+delta/1000
            print(json.dumps({'mode':mode,'cpuTopMs':sorted(costs.items(),key=lambda p:p[1],reverse=True)[:20]}),flush=True)
            check("!down&&!pointers.size&&scene.gl.getError()===0", mode+' populated map stroke finishes')
            js('undo()')
            png=call('Page.captureScreenshot',{'format':'png'})['data']
            (root/f'editor-{mode}-preview.png').write_bytes(base64.b64decode(png))
        assert not errors, errors
        sys.exit(0)
    for entry in ['index.html', 'public/index.html']:
        js("if(typeof dirty!=='undefined')dirty=false")
        call('Page.navigate', {'url': (root/entry).as_uri()})
        for _ in range(150):
            if js("document.readyState==='complete'&&typeof scene!=='undefined'&&typeof sessionRestoring!=='undefined'&&!sessionRestoring"):
                break
            time.sleep(.2)
        check("typeof scene!=='undefined' && !!scene.gl && layers.length>0", entry+' starts')
        js("end();layers=[layer('Teste')];active=0;patches=[];layers[0].planet={enabled:true};textureDirty=true;fit()")
        for dpr in [1, 1.25, 1.5, 2]:
            call('Emulation.setDeviceMetricsOverride', {'width':1440,'height':900,'deviceScaleFactor':dpr,'mobile':False})
            js("fit()")
            check("(()=>{const a=canvas.getBoundingClientRect(),b=$('viewport').getBoundingClientRect();return Math.abs(a.width-b.width)<1 && Math.abs(a.height-b.height)<1 && Math.abs(canvas.width-b.width*Math.min(devicePixelRatio,2))<1})()", f'{entry} canvas at DPR {dpr}')
            for mode in ['planet', 'crop', 'flat']:
                js("""end();flatRegion=null;layers[0].planet.enabled=true;yaw=21;tilt=32;roll=27;relief=1;
                    if('%s'==='crop'){flatRegion={x:5900,y:350,width:1000,height:700};yaw=17;tilt=35;}
                    if('%s'==='flat'){layers[0].planet.enabled=false;yaw=-18;tilt=40;}
                    textureDirty=true;fit();tool='marker';selectedBuilding=null;
                    window.target='%s'==='crop'?{x:3200,y:-950}:'%s'==='planet'?{x:333.333,y:782.222}:{x:800,y:550};
                """ % (mode, mode, mode, mode))
                p = js("""(()=>{const p=scene.project(target.x,target.y,0,camera()),r=canvas.getBoundingClientRect();
                    const hit=point({clientX:r.left+p.x,clientY:r.top+p.y});
                    window.expected=hit;
                    return {x:r.left+p.x,y:r.top+p.y,inside:hit.inside,error:Math.hypot(hit.x-target.x,hit.y-target.y)};})()""")
                assert p['inside'] and p['error'] < 5, (entry, dpr, mode, p)
                mouse('mousePressed', p, 1); mouse('mouseReleased', p)
                check("(()=>{const r=worldMode()?WorldSurface.locate(expected.x,expected.y):{gx:0,gy:0},l=WorldSurface.child(layers[0],r.gx,r.gy),o=l.objects.at(-1);return o&&Math.hypot(o.x+r.gx*1600-expected.x,o.y+r.gy*1100-expected.y)<.01&&!down&&!pointers.size})()", f'{entry} {mode} marker under mouse DPR {dpr}')
                check("(()=>{for(let i=0;i<200&&scene.detailStream;i++)draw();const p=scene.project(target.x,target.y,0,camera());scene.pick(p.x,p.y);const cached=scene.projected;draw();scene.pick(p.x,p.y);return cached===scene.projected})()", f'{entry} {mode} reuses picking cache')
        js("end();flatRegion=null;layers[0].planet.enabled=true;textureDirty=true;fit();regionView.button.click()")
        p = js("(()=>{const r=canvas.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()")
        mouse('mousePressed', p, 1); mouse('mouseReleased', p)
        check("!!regionView.preview&&!flatRegion", entry+' crop preview')
        js("regionView.controls.querySelector('.region-view-confirm').click()")
        check("!!flatRegion&&!camera().planet", entry+' confirms crop')
        js("tool='raise';$('size').value=48;$('amount').value=120;window.at={x:flatRegion.x+flatRegion.width/2-3200,y:flatRegion.y+flatRegion.height/2-1650};window.before=Terrain.sample(layers,at.x,at.y)||0")
        p = js("(()=>{const p=scene.project(at.x,at.y,0,camera()),r=canvas.getBoundingClientRect();return{x:r.left+p.x,y:r.top+p.y}})()")
        mouse('mousePressed', p, 1); mouse('mouseMoved', {'x':p['x']+10,'y':p['y']}, 1); mouse('mouseReleased', {'x':p['x']+10,'y':p['y']})
        check("Terrain.sample(layers,at.x,at.y)>before&&!down&&!pointers.size", entry+' crop sculpt drag')
        js("undo()")
        check("(Terrain.sample(layers,at.x,at.y)||0)===before", entry+' undo restores crop terrain')
        js("leaveFlatRegion();tool='brush';fit()")
        mouse('mousePressed', p, 1)
        js("window.dispatchEvent(new Event('blur'))")
        check("!down&&!pointers.size&&!strokeStarted&&!panning&&!orbiting", entry+' blur ends stroke')
        mouse('mouseReleased', p)
        check("scene.gl.getError()===0", entry+' WebGL remains valid')
    assert not errors, errors
    print(json.dumps({'browserErrors': errors, 'result':'all passed'}), flush=True)
finally:
    if ws:
        ws.close()
    proc.terminate()

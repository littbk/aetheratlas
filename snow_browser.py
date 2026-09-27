"""Browser integration checks using Chrome DevTools, with no added dependencies."""
import base64,json,math,subprocess,time,urllib.request
from pathlib import Path
import websocket

root=Path(__file__).resolve().parent
profile=root/'.browser-snow'
(profile/'DevToolsActivePort').unlink(missing_ok=True)
proc=subprocess.Popen([
    'C:/Program Files/Google/Chrome/Application/chrome.exe','--headless','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-first-run',
    '--no-default-browser-check','--allow-file-access-from-files','--remote-debugging-port=0',
    '--remote-allow-origins=http://localhost',f'--user-data-dir={profile}','--window-size=1440,900','about:blank'
],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
ws=None;seq=0;errors=[];results=[]
def call(method,params=None):
    global seq
    seq+=1;ident=seq;ws.send(json.dumps({'id':ident,'method':method,'params':params or {}}))
    while True:
        r=json.loads(ws.recv())
        if r.get('method')=='Runtime.exceptionThrown':errors.append(r['params'])
        if r.get('id')==ident:
            if 'error' in r:raise RuntimeError(r['error'])
            return r.get('result',{})
def js(expr):
    r=call('Runtime.evaluate',{'expression':expr,'returnByValue':True,'awaitPromise':True})
    if 'exceptionDetails' in r:raise RuntimeError(r['exceptionDetails'])
    return r.get('result',{}).get('value')
def check(expr,label):
    value=js(expr)
    if not value:raise AssertionError(label+': '+str(value))
    results.append(label);print('PASS',label,flush=True)
def mouse(kind,x,y,button='left',buttons=0):
    call('Input.dispatchMouseEvent',{'type':kind,'x':x,'y':y,'button':button,'buttons':buttons,'clickCount':1})
def click_world(x,y):
    p=js(f"(()=>{{const p=scene.project({x},{y},Math.max(0,Terrain.sample(layers,{x},{y})||0)*.065,camera()),r=canvas.getBoundingClientRect();return {{x:p.x+r.left,y:p.y+r.top}}}})()")
    mouse('mousePressed',p['x'],p['y'],buttons=1);mouse('mouseReleased',p['x'],p['y'])
def screenshot(name):
    r=call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
    (root/name).write_bytes(base64.b64decode(r['data']))
def touch(kind,points):
    call('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':x,'y':y,'id':i,'radiusX':4,'radiusY':4,'force':1} for i,x,y in points]})
try:
    for _ in range(100):
        try:
            port=(profile/'DevToolsActivePort').read_text().splitlines()[0]
            pages=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json',timeout=2))
            page=next(p for p in pages if p['type']=='page');break
        except (OSError,StopIteration):time.sleep(.1)
    ws=websocket.create_connection(page['webSocketDebuggerUrl'].replace('localhost','127.0.0.1'),origin='http://localhost',timeout=60)
    call('Page.enable');call('Runtime.enable')
    call('Page.navigate',{'url':(root/'index.html').as_uri()})
    for _ in range(150):
        if js("document.readyState==='complete' && typeof regionView!=='undefined' && scene.projected.length>0"):break
        time.sleep(.1)
    js("if(worldMode())document.getElementById('planetMode').click();layers=[layer('Terreno')];active=0;const t=layers[0].terrain;for(let j=0;j<275;j++)for(let i=0;i<400;i++){const k=j*400+i,x=i*4,y=j*4;t.coverage[k]=255;t.heights[k]=x<1000?100+90*Math.sin(x*.01)*Math.cos(y*.009):0;t.biomes[k]=x>1100?6:x>400?13:5;}t.dirty=true;layers[0].routes=[{kind:'path',width:15,points:[{x:200,y:200},{x:700,y:300},{x:1000,y:600},{x:900,y:850}]}];yaw=-10;tilt=48;zoom=1.8;textureDirty=true;draw()")
    check("scene.gl.getError()===0 && scene.structures.vertices.length===0 && scene.vegetation.count>0",'Estradas seguem a superfície sem fragmentos de geometria sobre a praia')
    check("scene.gl.getTexParameter(scene.gl.TEXTURE_2D,scene.gl.TEXTURE_MAG_FILTER)===scene.gl.LINEAR",'Texturas mantêm filtragem suave')
    check("scene.vegetation.entries.some(e=>e.type===13) && layers[0].terrain.treeStyles.some(s=>s.ground===Terrain.getTheme().snow) && !!document.querySelector('#forestType option[value=snowForest]')",'Floresta nevada gera árvores 3D e chão de neve, com opção no editor')
    js("Terrain.validate(serializeCurrent().layers[0].terrain)")
    screenshot('snow-forest-preview.png')
    if errors:raise AssertionError(json.dumps(errors))
    print(json.dumps({'checks':len(results),'browserErrors':errors}),flush=True)
finally:
    if ws:ws.close()
    proc.terminate()


"""Browser integration checks using Chrome DevTools, with no added dependencies."""
import base64,json,math,subprocess,time,urllib.request
from pathlib import Path
import websocket

root=Path(__file__).resolve().parent
profile=root/'.browser-region-view'
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
    js("if(!worldMode())document.getElementById('planetMode').click();window.originalLayers=layers;regionView.button.click()")
    click_world(800,550)
    check("!!flatRegion && !camera().planet && layers===originalLayers",'Seleção por clique abre a região sem substituir o mundo')
    check("scene.pick(canvas.width/2,canvas.height/2)?.worldX>0 && scene.gl.getError()===0",'Região plana permite selecionar coordenadas do mundo sem erro WebGL')
    js("window.editX=flatRegion.x+flatRegion.width/2;window.editY=flatRegion.y+flatRegion.height/2;tool='raise';window.beforeHeight=Terrain.sample(layers,editX-3200,editY-1650)||0;paint({x:editX-3200,y:editY-1650,worldX:editX,worldY:editY,inside:true},{x:editX-3200,y:editY-1650,worldX:editX,worldY:editY,inside:true});textureDirty=true;draw()")
    check("Terrain.sample(layers,editX-3200,editY-1650)>beforeHeight",'Edição no plano altera o terreno original')
    js("window.savedHeight=Terrain.sample(layers,editX-3200,editY-1650);regionView.button.click()")
    check("!flatRegion && camera().planet && Terrain.sample(layers,editX-3200,editY-1650)===savedHeight",'Retorno ao globo preserva o relevo editado')
    js("enterFlatRegion({x:6000,y:100,width:1000,height:800});tool='raise';paint({x:3300,y:-1400,worldX:6500,worldY:250,inside:true},{x:3300,y:-1400,worldX:6500,worldY:250,inside:true});textureDirty=true;draw()")
    check("Terrain.sample(layers,3300,-1400)>0 && scene.pick(canvas.width/2,canvas.height/2)?.worldX>6000",'Regiões distantes da área antiga também são editáveis no plano')
    check("!('flatRegion' in serializeCurrent().camera)",'Salvamento não transforma a projeção temporária em mapa separado')
    screenshot('region-flat-preview.png')
    js("leaveFlatRegion()")
    if errors:raise AssertionError(json.dumps(errors))
    print(json.dumps({'checks':len(results),'browserErrors':errors}),flush=True)
finally:
    if ws:ws.close()
    proc.terminate()

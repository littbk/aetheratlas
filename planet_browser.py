"""Browser integration checks using Chrome DevTools, with no added dependencies."""
import base64,json,math,subprocess,time,urllib.request
from pathlib import Path
import websocket

root=Path(__file__).resolve().parent
profile=root/'.browser-planet-edit'
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
    call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':900,'deviceScaleFactor':1,'mobile':False})
    call('Page.navigate',{'url':(root/'index.html').as_uri()})
    for _ in range(100):
        if js("document.body.classList.contains('compact-ui') && typeof scene!=='undefined' && scene.projected.length>0"):break
        time.sleep(.1)
    js("document.getElementById('planetMode').checked=true;layers=[layer('Terreno')];active=0;tool='brush';selectedBiome='grass';document.getElementById('size').value=180;document.getElementById('strength').value=100;textureDirty=true;fit()")
    targets=[(600,1200),(7400,3200),(4100,100),(3900,4300),(5,2300)]
    for wx,wy in targets:
        js(f"yaw=-({wx}/8000-.5)*360;tilt=({wy}/4400-.5)*180;roll=23;draw()")
        click_world(wx-3200,wy-1650)
        check(f"Terrain.sample(layers,{wx-3200},{wy-1650})>0",f'Pincel pinta o planeta em {wx}, {wy}')
    check("Terrain.sample(layers,4795,650)>0",'Pincel atravessa a emenda de longitude sem deixar uma faixa vazia')
    js("remember();tool='mountain';paint({x:-2600,y:-450},{x:-2600,y:-450});changed()")
    check("Terrain.sample(layers,-2600,-450)>150",'Montanha altera relevo 3D fora da região central')
    js("undo()")
    check("Terrain.sample(layers,-2600,-450)<150",'Desfazer restaura o relevo de uma região distante')
    js("undo(true);tool='marker';placeMarker({x:4200,y:1550});tool='room';finishConstruction({x:-2800,y:-600,inside:true},{x:-2650,y:-450,inside:true});changed()")
    check("layers[0].tiles.some(t=>t.objects.length) && layers[0].tiles.some(t=>t.structures.length)",'Marcadores e arquitetura funcionam nas regiões distantes')
    js("tool='brush';selectedBiome='forest';paint({x:4200,y:1550},{x:4200,y:1550});changed()")
    check("scene.vegetation.vertices.length>0",'Vegetação 3D aparece fora do quadrado original')
    js("window.savedPlanet=serializeCurrent()")
    schema=(root/'mapa-rpg/schema.js').read_text(encoding='utf-8').replace('export ','')
    js(schema)
    check("validateProject(savedPlanet)===savedPlanet",'Projeto com regiões passa pela validação de publicação')
    js("document.getElementById('file').onchange({target:{files:[new File([JSON.stringify(savedPlanet)],'planeta.json',{type:'application/json'})],value:''},discardConfirmed:true,fromDrive:true})")
    check("Terrain.sample(layers,-2600,-450)>150 && layers[0].tiles.some(t=>t.objects.length)",'Salvar e reabrir preserva terreno e objetos do planeta inteiro')
    js("yaw=-153;tilt=40;roll=0;zoom=1;draw();tool='select';const h=billboardHits.find(h=>h.originalObject?.kind==='marker');if(!h)throw Error('Marcador remoto não renderizado');const r=canvas.getBoundingClientRect();Selector.pick({clientX:r.left+h.box.x+h.box.w/2,clientY:r.top+h.box.y+h.box.h/2,pointerId:42});Selector.recolor('#ffeeaa','#70503b')")
    check("Selector.selected?.region && Selector.selected.source.objects.some(o=>o.color==='#ffeeaa')",'Seletor edita objetos nas regiões distantes')
    js("yaw=-153;tilt=40;roll=0;fit()")
    screenshot('whole-planet-preview.png')
    viewer=(root/'mapa-rpg/viewer.js').read_text(encoding='utf-8').replace("import { validateProject } from './schema.js';",'').replace('export class MapViewer','class MapViewer')
    js(viewer+";window.viewerStage=document.createElement('div');viewerStage.style.cssText='position:fixed;inset:0;width:900px;height:700px';document.body.append(viewerStage);window.viewerCanvas=document.createElement('canvas');viewerStage.append(viewerCanvas);window.planetViewer=new MapViewer(viewerCanvas,viewerStage,()=>{});planetViewer.load(savedPlanet)")
    check("Terrain.sample(planetViewer.layers,-2600,-450)>150 && planetViewer.scene.vegetation.vertices.length>0 && planetViewer.scene.gl.getError()===0",'Visualizador carrega as regiões, o relevo e a vegetação do planeta inteiro')
    if errors:raise AssertionError('Exceções no navegador: '+json.dumps(errors))
    print(json.dumps({'checks':len(results),'browserErrors':errors},ensure_ascii=False),flush=True)
finally:
    if ws:ws.close()
    proc.terminate()

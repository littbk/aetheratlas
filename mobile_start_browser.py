"""Browser integration checks using Chrome DevTools, with no added dependencies."""
import base64,json,math,subprocess,time,urllib.request
from pathlib import Path
import websocket

root=Path(__file__).resolve().parent
profile=root/'.browser-mobile-start'
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
        if r.get('method')=='Log.entryAdded' and r['params']['entry']['level']=='error':print(r['params']['entry']['text'],flush=True)
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
import http.server,threading,struct,zlib
row=b'\x00'+bytes(1600*4)
def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1600,1100,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(row*1100))+chunk(b'IEND',b'')
index_bytes=(root/'mapa-rpg/public/index.html').read_text(encoding='utf-8').replace('<script type="module" src="/app.js"></script>','').encode()
viewer_source=(root/'mapa-rpg/viewer.js').read_text(encoding='utf-8').replace("import { validateProject } from './schema.js';",'').replace('export class MapViewer','class MapViewer')
schema_source=(root/'mapa-rpg/schema.js').read_text(encoding='utf-8').replace('export ','')
project={'format':'aether-atlas','version':1,'width':1600,'height':1100,'title':'Reino de Aurélia','world':{'type':'planet','width':8000,'height':4400,'patches':[],'playerLocation':{'x':4000,'y':2200}},'layers':[{'name':'Oceano','visible':True,'locked':False,'opacity':1,'planet':{'enabled':True},'image':'data:image/png;base64,'+base64.b64encode(png).decode(),'objects':[],'routes':[],'tunnels':[]}]}
project['layers'][0]['structures']=[{'points':[{'x':700,'y':500},{'x':900,'y':500}],'close':False,'fill':False,'width':12,'height':12,'color':'#a99c83','material':'stone','kind':'wall'}]
class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map={**http.server.SimpleHTTPRequestHandler.extensions_map,'.js':'application/javascript','.css':'text/css'}
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(root/'mapa-rpg/public'),**kwargs)
    def log_message(self,*args):pass
    def do_GET(self):
        if self.path=='/':
            self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(index_bytes)));self.end_headers();self.wfile.write(index_bytes);return
        if self.path.startswith('/api/map') or self.path.startswith('/fixture.json'):
            data=project if self.path.startswith('/fixture.json') else {'map':{'projectUrl':'/fixture.json','title':'Reino de Aurélia','note':'Mapa da campanha','updatedAt':'2026-09-27T12:00:00Z'}}
            payload=json.dumps(data).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
        else:super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    for _ in range(100):
        try:
            port=(profile/'DevToolsActivePort').read_text().splitlines()[0]
            pages=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json',timeout=2))
            page=next(p for p in pages if p['type']=='page');break
        except (OSError,StopIteration):time.sleep(.1)
    ws=websocket.create_connection(page['webSocketDebuggerUrl'].replace('localhost','127.0.0.1'),origin='http://localhost',timeout=60)
    call('Page.enable');call('Runtime.enable');call('Log.enable');call('Network.enable');call('Network.setCacheDisabled',{'cacheDisabled':True})
    call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
    call('Page.navigate',{'url':f'http://127.0.0.1:{server.server_port}/'})
    for _ in range(100):
        if js(f"location.port==='{server.server_port}' && document.readyState==='complete' && typeof Terrain!=='undefined' && typeof Terrain.detailTexture==='function' && document.querySelectorAll('.viewer-icon-button').length>=12"):break
        time.sleep(.1)
    js(schema_source+'\n'+viewer_source+'\nwindow.testViewer=new MapViewer(document.getElementById("mapCanvas"),document.getElementById("stage"),(c)=>{document.getElementById("viewStatus").textContent="RELEVO 3D";document.getElementById("zoomRead").textContent=Math.round(c.zoom*100)+"%"});document.getElementById("viewer").hidden=false;document.getElementById("empty").hidden=true;document.getElementById("mapTitle").textContent="Reino de Aurélia";testViewer.load('+json.dumps(project)+')')
    for _ in range(100):
        if js("!!document.getElementById('viewer') && !document.getElementById('viewer').hidden && document.getElementById('viewStatus').textContent.includes('RELEVO 3D')"):break
        time.sleep(.1)
    check("!document.documentElement.classList.contains('ui-loading') && document.body.classList.contains('modern-viewer') && getComputedStyle(document.body).visibility==='visible'",'Primeira abertura mobile revela a interface moderna concluída')
    js("window.callbackStage=document.createElement('div');callbackStage.style.cssText='width:390px;height:500px';document.body.append(callbackStage);window.callbackCanvas=document.createElement('canvas');callbackStage.append(callbackCanvas);window.callbackViewer=new MapViewer(callbackCanvas,callbackStage,null);callbackViewer.layers=testViewer.layers;callbackViewer.texture=testViewer.texture;callbackViewer.scene.update(callbackViewer.texture,callbackViewer.layers,callbackViewer.camera());callbackViewer.draw();callbackStage.remove()")
    check("typeof callbackViewer.onChange==='function'",'Desenho inicial tolera callback ausente sem erro onChange')
    check("!document.getElementById('viewer').hidden && document.querySelectorAll('.viewer-icon-button').length>=12",'Visualizador carrega mapa e botões compactos')
    check("[...document.querySelectorAll('.viewer-icon-button')].every(b=>b.title && b.getAttribute('aria-label'))",'Ícones do visualizador têm nomes e tooltips')
    check("getComputedStyle(document.querySelector('.submap-return')).display==='none'",'Retorno de submapa permanece oculto no planeta')
    js("window.viewerLayers=testViewer.layers;testViewer.regionView.button.click()")
    pos=js("(()=>{const p=testViewer.scene.project(800,550,0,testViewer.camera()),r=testViewer.canvas.getBoundingClientRect();return {x:r.left+p.x,y:r.top+p.y}})()")
    for kind,buttons in [('mousePressed',1),('mouseReleased',0)]:
        call('Input.dispatchMouseEvent',{'type':kind,'x':pos['x'],'y':pos['y'],'button':'left','buttons':buttons,'clickCount':1})
    check("!!testViewer.flatRegion && !testViewer.camera().planet && testViewer.layers===viewerLayers && testViewer.scene.gl.getError()===0",'Jogador seleciona região plana do mesmo mundo sem erros gráficos')
    js("testViewer.regionView.button.click()")
    check("!testViewer.flatRegion && testViewer.camera().planet && testViewer.layers===viewerLayers",'Jogador retorna ao planeta sem recarregar ou substituir as camadas')
    js("(async()=>{window.lockedPatch={kind:'submap',locked:true,name:'Local secreto',image:testViewer.layers[0].c.toDataURL()};window.parentLayers=testViewer.layers;window.parentTexture=testViewer.texture;window.blockResult=await testViewer.openSubmap(lockedPatch)})()")
    check("blockResult===false && testViewer.layers===parentLayers && testViewer.texture===parentTexture && !testViewer.submapMode && !testViewer.blockedMessage.hidden && testViewer.blockedMessage.textContent==='localização bloqueada'",'Submapa bloqueado avisa o jogador e preserva o mapa principal')
    js("(async()=>{lockedPatch.locked=false;window.openResult=await testViewer.openSubmap(lockedPatch)})()")
    check("openResult===true && testViewer.submapMode && testViewer.blockedMessage.hidden",'Submapa destravado permite acesso novamente')
    screenshot('ui-viewer-desktop-preview.png')
    call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
    time.sleep(.3)
    check("document.documentElement.scrollWidth===innerWidth",'Visualizador móvel sem overflow')
    check("(()=>{const a=document.querySelector('.viewer-dock').getBoundingClientRect();return a.left>=0 && a.right<=innerWidth && document.querySelector('.camera-settings').hidden})()",'Barra móvel compacta mantém ajustes de câmera recolhidos')
    js("document.getElementById('cameraToggle').click()")
    check("(()=>{const a=document.querySelector('.viewer-dock').getBoundingClientRect(),c=document.querySelector('.camera-settings').getBoundingClientRect();return c.bottom<=a.top && c.right<=innerWidth})()",'Ajustes de câmera abrem sem cobrir a barra de ferramentas')
    screenshot('ui-viewer-mobile-preview.png')
    if errors:raise AssertionError('Exceções no navegador: '+json.dumps(errors))
    print(json.dumps({'checks':len(results),'browserErrors':errors},ensure_ascii=False),flush=True)
finally:
    if ws:ws.close()
    proc.terminate()
    server.shutdown()

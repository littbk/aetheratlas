"""Browser integration checks using Chrome DevTools, with no added dependencies."""
import base64,json,math,subprocess,time,urllib.request
from pathlib import Path
import websocket

root=Path(__file__).resolve().parent
profile=root/'.browser-ui-review'
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
    check("document.body.classList.contains('compact-ui') && !!scene.gl",'Editor e WebGL carregam com a nova interface')
    check("document.querySelectorAll('[data-tool]').length===33 && [...document.querySelectorAll('[data-tool]')].every(b=>b.getAttribute('aria-label')&&b.dataset.tooltip)",'As 33 ferramentas continuam disponíveis e nomeadas')
    check("document.documentElement.scrollWidth===innerWidth && document.getElementById('viewport').clientWidth>900",'Desktop mantém o mapa amplo e sem overflow')
    js("document.getElementById('ui-tab-terrain').click()")
    check("!document.getElementById('ui-terrain').hidden && !document.querySelector('.ui-common-controls').hidden && document.getElementById('ui-architecture').hidden",'Abas mostram apenas os ajustes do grupo')
    screenshot('ui-desktop-preview.png')
    b=js("(()=>{const r=document.querySelector('[data-tool=raise]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
    mouse('mouseMoved',b['x'],b['y']);time.sleep(.4)
    check("!document.getElementById('uiTooltip').hidden && document.getElementById('uiTooltip').textContent==='Elevar'",'Nome da ferramenta aparece ao manter o mouse sobre o ícone')
    js("document.querySelector('[data-tool=wall]').click()")
    check("tool==='wall' && !document.getElementById('ui-architecture').hidden && document.querySelector('.ui-common-controls').hidden && !!document.getElementById('architectureMaterial')",'Seleção da ferramenta abre o grupo de arquitetura')
    check("[...document.querySelectorAll('.ui-pinned-navigation [data-tool]')].length===4 && [...document.querySelectorAll('.ui-pinned-navigation [data-tool]')].every(b=>b.offsetParent!==null)",'Navegação continua visível ao escolher arquitetura')
    js("document.querySelector('[data-tool=pan]').click()")
    check("tool==='pan' && !document.getElementById('ui-architecture').hidden",'Navegação fixa preserva a categoria aberta')
    js("document.querySelector('[data-tool=wall]').click();document.getElementById('planetMode').click()")
    p1=js("(()=>{const p=scene.project(650,450,0,camera()),r=canvas.getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top}})()")
    p2=js("(()=>{const p=scene.project(950,500,0,camera()),r=canvas.getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top}})()")
    mouse('mousePressed',p1['x'],p1['y'],buttons=1);mouse('mouseMoved',p2['x'],p2['y'],buttons=1);mouse('mouseReleased',p2['x'],p2['y'])
    check("layers[active].structures.length>0 && serializeCurrent().layers[active].structures.length>0",'Desenho e salvamento 3D continuam funcionando')
    js("layers[active].structures=[];ink(layers[active]).getContext('2d').clearRect(0,0,W,H);document.getElementById('color').value='#a79b86';document.getElementById('size').value=24;for(const [k,a,b] of [['floor',[620,390],[950,650]],['room',[630,400],[940,640]],['stairs',[680,500],[790,545]],['pillar',[850,465],[875,490]],['door',[720,640],[780,640]],['window',[940,460],[940,520]]]){tool=k;finishConstruction({x:a[0],y:a[1],inside:true},{x:b[0],y:b[1],inside:true});}tilt=55;zoom=2;textureDirty=true;draw()")
    check("layers[active].structures.some(p=>p.kind==='stairs'&&p.fill&&p.height>10) && layers[active].structures.some(p=>p.material==='wood') && layers[active].structures.some(p=>p.material==='glass')",'Arquitetura possui degraus sólidos e materiais distintos')
    screenshot('ui-architecture-preview.png')
    js("const ground=layers[active].terrain;for(let j=0;j<275;j++)for(let i=0;i<400;i++){const k=j*400+i,x=i*4,y=j*4;if(x>390&&x<1160&&y>260&&y<820){ground.coverage[k]=255;ground.biomes[k]=1;ground.heights[k]=80+10*Math.sin(x*.018)*Math.cos(y*.021);}}ground.dirty=true;for(const [material,color,k,a,b] of [['slate','#697784','floor',[980,430],[1110,640]],['slate','#697784','wall',[1100,430],[1100,640]],['wood','#94704e','floor',[460,470],[595,635]],['wood','#94704e','wall',[470,470],[470,635]]]){document.getElementById('architectureMaterial').value=material;document.getElementById('architectureColor').value=color;tool=k;finishConstruction({x:a[0],y:a[1],inside:true},{x:b[0],y:b[1],inside:true});}yaw=-20;tilt=55;zoom=1.4;textureDirty=true;draw()")
    check("scene.gl.getError()===scene.gl.NO_ERROR && scene.structures.vertices.every(Number.isFinite)",'Materiais, sombras e geometrias sobre o terreno não geram erros WebGL')
    screenshot('architecture-terrain-preview.png')
    js("document.getElementById('paintForest').click()")
    check("tool==='brush' && !document.getElementById('ui-terrain').hidden",'Controles de vegetação continuam selecionando o pincel')
    js("document.getElementById('ui-tab-camera').click()")
    check("!document.getElementById('ui-camera').hidden && document.getElementById('ui-layers').hidden && !!document.getElementById('roll')",'Câmera fica em aba própria e mantém rotação Z')
    call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
    time.sleep(.3)
    check("document.documentElement.scrollWidth===innerWidth && getComputedStyle(document.getElementById('toolsPanel')).display==='none'",'Celular não tem overflow e recolhe os painéis')
    screenshot('ui-mobile-preview.png')
    js("document.getElementById('mobileTools').click()")
    check("getComputedStyle(document.getElementById('toolsPanel')).display==='flex' && document.getElementById('toolsPanel').getBoundingClientRect().right<=innerWidth",'Ferramentas abrem em painel compacto no celular')
    js("window.pinnedTop=document.querySelector('.ui-pinned-navigation').getBoundingClientRect().top;document.getElementById('forestType').closest('details').open=true;document.querySelector('#toolsPanel .ui-scroll').scrollTop=1000")
    check("document.querySelector('.ui-pinned-navigation').getBoundingClientRect().top===window.pinnedTop && [...document.querySelectorAll('.ui-pinned-navigation button')].every(b=>b.offsetParent!==null)",'Navegação permanece fixa durante a rolagem no celular')
    js("document.getElementById('forestType').closest('details').open=false;document.querySelector('#toolsPanel .ui-scroll').scrollTop=0")
    screenshot('ui-mobile-tools-preview.png')
    js("document.getElementById('mobileLayers').click()")
    check("getComputedStyle(document.getElementById('layersPanel')).display==='flex' && !document.body.classList.contains('show-tools')",'Camadas e ferramentas não se sobrepõem no celular')
    if errors:raise AssertionError('Exceções no navegador: '+json.dumps(errors))
    print(json.dumps({'checks':len(results),'browserErrors':errors},ensure_ascii=False),flush=True)
finally:
    if ws:ws.close()
    proc.terminate()

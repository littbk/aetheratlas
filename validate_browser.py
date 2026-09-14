"""Browser integration checks using Chrome DevTools, with no added dependencies."""
import base64,json,subprocess,time,urllib.request
from pathlib import Path
import websocket

root=Path(__file__).resolve().parent
profile=root/'.browser-validation'
proc=subprocess.Popen([
    'C:/Program Files/Google/Chrome/Application/chrome.exe','--headless','--no-first-run',
    '--no-default-browser-check','--allow-file-access-from-files','--remote-debugging-port=0',
    '--remote-allow-origins=http://localhost',f'--user-data-dir={profile}','--window-size=1500,1000','about:blank'
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
            pages=json.load(urllib.request.urlopen(f'http://localhost:{port}/json'))
            page=next(p for p in pages if p['type']=='page');break
        except (OSError,StopIteration):time.sleep(.1)
    ws=websocket.create_connection(page['webSocketDebuggerUrl'],origin='http://localhost',timeout=60)
    call('Page.enable');call('Runtime.enable')
    call('Page.navigate',{'url':(root/'index.html').as_uri()})
    for _ in range(100):
        if js("typeof layers!=='undefined' && layers.length===4 && typeof scene!=='undefined' && scene.projected.length>0"):break
        time.sleep(.1)
    check("!!scene.gl && scene.gl.getError()===0 && layers.length===4",'WebGL inicializa e desenha quatro camadas')
    screenshot('desktop-preview.png')
    check("!document.body.textContent.includes('Ã§') && !document.body.textContent.includes('â—')",'Textos em português sem codificação quebrada')
    js("$('bearing').value=57;$('bearing').oninput();$('tilt').value=58;$('tilt').oninput();")
    check("(()=>{const p=scene.project(620,560,Math.max(0,Terrain.sample(layers,620,560)||0)*.065,camera()),q=scene.pick(p.x,p.y);return q&&Math.abs(q.x-620)<.01&&Math.abs(q.y-560)<.01})()",'Seleção acompanha rotação e perspectiva')
    js("document.querySelector('[data-tool=raise]').click();window.beforeHeight=Terrain.sample(layers,620,560)")
    click_world(620,560)
    check("Terrain.sample(layers,620,560)>beforeHeight",'Escultura por mouse na posição projetada')
    js("undo()")
    check("Math.abs(Terrain.sample(layers,620,560)-beforeHeight)<.01",'Desfazer restaura altitude')
    js("undo(true)")
    check("Terrain.sample(layers,620,560)>beforeHeight",'Refazer restaura escultura')
    js("active=2;document.querySelector('[data-tool=tunnel]').click();window.beforeTunnels=layers[2].tunnels.length")
    click_world(580,520);click_world(800,580)
    check("layers[2].tunnels.length===beforeTunnels+1 && tunnelStart===null",'Túnel construído com dois cliques na vista inclinada')
    js('undo()')
    check('layers[2].tunnels.length===beforeTunnels','Desfazer remove túnel inteiro')
    js('undo(true)')
    check('layers[2].tunnels.length===beforeTunnels+1','Refazer recupera portais e rota')
    js("layers[2].locked=true;window.oldHistory=history.length")
    click_world(500,500)
    check('tunnelStart===null&&history.length===oldHistory','Camada bloqueada impede construir túnel')
    js("layers[2].locked=false;active=1;selectedBuilding='castle';document.querySelector('[data-tool=marker]').click();")
    click_world(620,560)
    check("layers[1].ink!==null&&layers[1].ink.getContext('2d').getImageData(617,557,6,6).data.some((v,i)=>i%4===3&&v>0)",'Construção aparece na pintura acima do relevo')
    check("(()=>{const temp=document.createElement('canvas');temp.width=W;temp.height=H;drawLayer(temp.getContext('2d'),layers[1]);const a=temp.getContext('2d').getImageData(620,560,1,1).data,b=layers[1].ink.getContext('2d').getImageData(620,560,1,1).data;return b[3]>0&&Math.abs(a[0]-b[0])<2})()",'Composição mantém construção visível sobre terreno')
    js("undo()")
    check('layers[1].ink===null','Desfazer remove construção sem apagar terreno')
    js("undo(true)")
    check('layers[1].ink!==null','Refazer restaura construção')
    js("layers[2].locked=false;window.savedFiles=[];download=(blob,ext)=>savedFiles.push({blob,ext});$('save').click();")
    check("(async()=>{window.project=JSON.parse(await savedFiles.at(-1).blob.text());return project.version===3&&project.camera.yaw===57&&project.layers[2].tunnels.length===beforeTunnels+1})()",'Salvar preserva câmera, terreno e túneis')
    js("(async()=>{const f=new File([JSON.stringify(project)],'mapa.json',{type:'application/json'});await $('file').onchange({target:{files:[f],value:''}})})()")
    check('layers[2].tunnels.length===beforeTunnels+1 && yaw===57 && tilt===58','Reabrir projeto restaura túnel e câmera')
    check("layers[1].ink!==null&&layers[1].ink.getContext('2d').getImageData(620,560,1,1).data[3]>0",'Salvar e reabrir preserva construções sobre relevo')
    js("$('export').click();$('viewExport').click();$('heightExport').click()")
    for _ in range(60):
        if js('savedFiles.length>=4'):break
        time.sleep(.1)
    check("savedFiles.length===4&&savedFiles.every(f=>f.blob.size>100)",'Exportação de projeto, PNG, perspectiva e altura')
    check("(async()=>{const f=savedFiles.find(f=>f.ext==='.png');const im=await createImageBitmap(f.blob);return im.width===1600&&im.height===1100})()",'PNG mantém dimensões do mapa')
    js("(async()=>{const legacy=structuredClone(project);legacy.version=2;delete legacy.camera;legacy.layers.forEach(l=>delete l.tunnels);const f=new File([JSON.stringify(legacy)],'antigo.json');await $('file').onchange({target:{files:[f],value:''}})})()")
    check('layers.length===4&&layers.every(l=>l.tunnels.length===0)','Compatibilidade com projetos da versão anterior')
    js("demo();$('viewTop').click();")
    check('tilt===0 && scene.gl.getError()===0','Vista de cima sem relevo projetado')
    call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':2,'mobile':True})
    call('Emulation.setTouchEmulationEnabled',{'enabled':True,'maxTouchPoints':5})
    js("fit();$('view3d').click()")
    check("innerWidth===390 && document.documentElement.scrollWidth===390 && $('viewport').clientWidth===390",'Celular 390px sem rolagem horizontal')
    check("getComputedStyle($('toolsPanel')).display==='none'&&getComputedStyle($('layersPanel')).display==='none'",'Painéis recolhidos deixam mapa livre no celular')
    js("$('mobileTools').click()")
    check("getComputedStyle($('toolsPanel')).display==='block'&&$('mobileTools').getAttribute('aria-expanded')==='true'",'Ferramentas abrem em painel mobile')
    screenshot('mobile-tools-preview.png')
    js("closePanels();$('mobileLayers').click()")
    check("getComputedStyle($('layersPanel')).display==='block'&&$('layersPanel').getBoundingClientRect().right<=390",'Camadas e câmera acessíveis no celular')
    js("closePanels();document.querySelector('[data-tool=brush]').click();window.initialHistory=history.length;window.initialYaw=yaw;window.initialZoom=zoom;")
    touch('touchStart',[(1,130,360)])
    touch('touchStart',[(1,130,360),(2,240,400)])
    touch('touchMove',[(1,95,340),(2,280,445)])
    touch('touchEnd',[])
    check('history.length===initialHistory&&zoom>initialZoom&&Math.abs(yaw-initialYaw)>1','Pinça gira e amplia sem pintar acidentalmente')
    js("document.querySelector('[data-tool=tunnel]').click();active=2;window.beforeMobileTunnel=layers[2].tunnels.length;tilt=0;yaw=0;fit();")
    for x,y in [(620,500),(820,520)]:
        p=js(f"(()=>{{const p=scene.project({x},{y},0,camera()),r=canvas.getBoundingClientRect();return {{x:p.x+r.left,y:p.y+r.top}}}})()")
        touch('touchStart',[(1,p['x'],p['y'])]);touch('touchEnd',[])
    check('layers[2].tunnels.length===beforeMobileTunnel+1','Dois toques constroem túnel no celular')
    js("document.querySelector('[data-tool=pan]').click();$('view3d').click();")
    screenshot('mobile-preview.png')
    call('Emulation.setDeviceMetricsOverride',{'width':844,'height':390,'deviceScaleFactor':1,'mobile':True})
    js('fit()')
    check("document.documentElement.scrollWidth===844 && $('viewport').clientHeight>150",'Celular em paisagem mantém área útil')
    for width in [320,360,768,860,1024]:
        call('Emulation.setDeviceMetricsOverride',{'width':width,'height':800,'deviceScaleFactor':1,'mobile':True})
        js('fit()')
        check(f"document.documentElement.scrollWidth==={width} && $('viewport').clientWidth>0",f'Layout sem overflow em {width}px')
    check('scene.gl.getError()===0','Sem erros WebGL após edição e gestos')
    js("$('add').click()")
    check('layers.length===5','Adicionar camada')
    js('undo()')
    check('layers.length===4','Desfazer criação de camada')
    js('undo(true)')
    check('layers.length===5','Refazer criação de camada')
    js("window.previousVisible=layers[active].visible;document.querySelector('.layer.selected button').click()")
    check('layers[active].visible!==previousVisible','Ocultar camada')
    js('undo()')
    check('layers[active].visible===previousVisible','Restaurar visibilidade')
    call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':2,'mobile':True})
    js("dirty=false")
    call('Page.reload')
    for _ in range(100):
        if js("typeof layers!=='undefined'&&layers.length===4&&scene.projected.length>0"):break
        time.sleep(.1)
    check('yaw===-65&&tilt===28','Câmera inicial aproveita orientação vertical do celular')
    screenshot('mobile-preview.png')
    js("scene.gl=null;draw();")
    check("tilt===0&&$('cameraNote').textContent.includes('indisponível')",'Fallback mantém edição plana quando WebGL fica indisponível')
    check("(()=>{const p=scene.project(620,560,0,camera()),r=canvas.getBoundingClientRect(),q=point({clientX:p.x+r.left,clientY:p.y+r.top});return Math.abs(q.x-620)<.01&&Math.abs(q.y-560)<.01})()",'Seleção continua alinhada no fallback 2D')
    if errors:raise AssertionError('Erros JavaScript: '+json.dumps(errors))
    results.append('Nenhuma exceção JavaScript no navegador')
finally:
    (root/'validation-results.json').write_text(json.dumps({'passed':results,'exceptions':errors},ensure_ascii=False,indent=2),encoding='utf-8')
    if ws:
        try:call('Browser.close')
        except Exception:pass
        ws.close()
    try:proc.wait(timeout=10)
    except subprocess.TimeoutExpired:proc.terminate()

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
    for entry in ['index.html','public/index.html']:
        call('Page.navigate',{'url':(root/entry).as_uri()})
        for _ in range(150):
            if js("document.readyState==='complete'&&typeof sessionRestoring!=='undefined'&&!sessionRestoring"):break
            time.sleep(.2)
        js("end();layers=[layer('Teste de florestas')];active=0;patches=[];layers[0].planet.enabled=false;const t=layers[0].terrain;t.coverage.fill(255);t.heights.fill(830);for(let k=0;k<t.biomes.length;k++)t.biomes[k]=k%3===0?3:k%3===1?18:0;textureDirty=true;fit();window.groundBefore=(Terrain.render(t,{texture:true,shade:true}),t.canvas.toDataURL());window.biomeBefore=Terrain.biomeTexture(t).toDataURL();window.heightBefore=t.heights.slice();document.querySelector('[data-biome=forest]').click();$('forestTreesOnly').click();")
        check("$('forestTreesOnly').getAttribute('aria-pressed')==='true'&&!$('forestTreesOnly').closest('.ui-tree-colors').hidden",entry+' toggle visible and enabled')
        result=js("""(()=>{const tested=[];for(const biome of Terrain.biomes.filter((_,i)=>Terrain.isTreeBiome(i))){document.querySelector('[data-biome="'+biome+'"]').click();paint({x:800,y:550,inside:true},{x:800,y:550,inside:true});const t=layers[0].terrain;if((Terrain.render(t,{texture:true,shade:true}),t.canvas.toDataURL())!==groundBefore||Terrain.biomeTexture(t).toDataURL()!==biomeBefore||!t.heights.every((v,k)=>v===heightBefore[k]))throw Error('Ground changed for '+biome+JSON.stringify({ground:(Terrain.render(t,{texture:true,shade:true}),t.canvas.toDataURL())===groundBefore,biome:Terrain.biomeTexture(t).toDataURL()===biomeBefore,height:t.heights.every((v,k)=>v===heightBefore[k]),enabled:$('forestTreesOnly').getAttribute('aria-pressed'),selectedBiome,tool}));const mesh=Vegetation.build(layers,false);if(!mesh.entries.some(e=>e.type===Terrain.biomes.indexOf(biome)))throw Error('Trees missing for '+biome);const saved=Terrain.serialize(t),restored=Terrain.validate(saved);if(JSON.stringify(restored.treeOverlay)!==JSON.stringify(t.treeOverlay))throw Error('Save lost trees');tested.push(biome);}return tested;})()""")
        check("(async()=>{const {validateProject}=await import("+json.dumps((root/'mapa-rpg/schema.js').as_uri())+");return !!validateProject(projectData());})()",entry+' independent trees accepted by publication schema')
        print('PASS',entry,'unchanged terrain pixels, shader textures, heights, visible trees and save:',result,flush=True)
        js("$('forestTreesOnly').click();document.querySelector('[data-biome=forest]').click();paint({x:800,y:550,inside:true},{x:800,y:550,inside:true});")
        check("(Terrain.render(layers[0].terrain,{texture:true,shade:true}),layers[0].terrain.canvas.toDataURL())!==groundBefore",entry+' disabling toggle restores normal ground painting')
        if 'acacia' in result:
            check("(()=>{for(const species of ['acacia','savannaScrub']){$('forestType').value=species;$('forestType').onchange();if(selectedBiome!==species)return false;paint({x:800,y:550,inside:true},{x:800,y:550,inside:true});if(layers[0].terrain.biomes[Terrain.index(800,550)]!==Terrain.biomes.indexOf(species))return false;const o={kind:'tree',species,x:800,y:550,size:40,rotation:0,text:'',color:'#778a46',trunkColor:'#70503b',seed:.5};if(Billboards.validate([o])[0].species!==species)return false;}return true;})()",entry+' savanna palette, normal painting and editable individual plants')
            check("(async()=>{const {validateProject}=await import("+json.dumps((root/'mapa-rpg/schema.js').as_uri())+");return !!validateProject(projectData());})()",entry+' normal savanna biomes accepted by publication schema')
        js('dirty=false')
    if '--savanna-preview' in sys.argv:
        js("layers[0].terrain.treeOverlay={};layers[0].terrain.coverage.fill(255);layers[0].terrain.heights.fill(120);layers[0].terrain.biomes.fill(23);$('size').value=300;$('strength').value=100;if($('forestTreesOnly').getAttribute('aria-pressed')!=='true')$('forestTreesOnly').click();selectedBiome='acacia';paint({x:660,y:550,inside:true},{x:660,y:550,inside:true});selectedBiome='savannaScrub';paint({x:930,y:550,inside:true},{x:930,y:550,inside:true});yaw=0;tilt=40;roll=0;zoom=2;ox=canvas.clientWidth/2;oy=canvas.clientHeight*.6;textureDirty=true;render();draw();scene.draw(canvas.clientWidth,canvas.clientHeight,1,{...camera(),fullQuality:true});")
        check('scene.gl.getError()===0','savanna models render without GPU errors')
        (root/'savanna-preview.png').write_bytes(base64.b64decode(call('Page.captureScreenshot',{'format':'png'})['data']))
    assert not errors,errors
finally:
    if ws:ws.close()
    proc.terminate()

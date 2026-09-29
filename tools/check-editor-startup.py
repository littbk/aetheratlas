"""Check the real local editor startup and capture browser exceptions."""
import base64, json, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
import websocket

root = Path(__file__).resolve().parents[1]
profile = Path(tempfile.mkdtemp(prefix='atlas-startup-'))
proc = subprocess.Popen([
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '--headless',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run',
    '--no-default-browser-check', '--allow-file-access-from-files',
    '--remote-debugging-port=0', '--remote-allow-origins=http://localhost',
    f'--user-data-dir={profile}', 'about:blank'
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
ws = None
seq = 0
errors = []

def call(method, params=None):
    global seq
    seq += 1
    ident = seq
    ws.send(json.dumps({'id': ident, 'method': method, 'params': params or {}}))
    while True:
        reply = json.loads(ws.recv())
        if reply.get('method') == 'Runtime.exceptionThrown':
            errors.append(reply['params']['exceptionDetails'])
        if reply.get('id') == ident:
            return reply.get('result', {})

def js(expression):
    reply = call('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
    if 'exceptionDetails' in reply:
        return {'evaluationError': reply['exceptionDetails']}
    return reply.get('result', {}).get('value')

try:
    for _ in range(100):
        try:
            port = (profile/'DevToolsActivePort').read_text().splitlines()[0]
            pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json', timeout=2))
            page = next(p for p in pages if p['type'] == 'page')
            break
        except (OSError, StopIteration):
            time.sleep(.1)
    ws = websocket.create_connection(page['webSocketDebuggerUrl'], origin='http://localhost', timeout=30)
    call('Page.enable')
    call('Runtime.enable')
    call('Emulation.setDeviceMetricsOverride', {'width':1440,'height':900,'deviceScaleFactor':1,'mobile':False})
    for entry in ['index.html', 'public/index.html']:
        errors.clear()
        call('Page.navigate', {'url': (root/entry).as_uri()})
        time.sleep(3)
        state = js("({ready:document.body.classList.contains('compact-ui'),loading:document.documentElement.classList.contains('ui-loading'),layers:typeof layers==='undefined'?null:layers.length,buildings:document.querySelectorAll('.building-button').length})")
        controls = js("""(()=>{
            const results=[];
            for(const name of ['marker','text','tunnel','settlement','select','brush']){
                document.querySelector('[data-tool="'+name+'"]').click();
                results.push(tool===name);
            }
            document.querySelector('#buildings .building-button').click();
            results.push(tool==='marker'&&selectedBuilding==='house');
            results.push(!document.getElementById('buildingPalettePicker')&&document.querySelectorAll('#buildings button').length===Object.keys(Buildings.names).length);
            const types=[...document.querySelectorAll('#buildings button')].map(b=>b.dataset.type);
            results.push(new Set(types).size===types.length);
            const object={kind:'building',building:'house',x:800,y:550,size:40,rotation:0,text:'',color:'#ffffff',buildingStyle:0,buildingPalette:0};
            layers[active].objects.push(object);document.querySelector('[data-tool="select"]').click();
            const r=canvas.getBoundingClientRect();billboardHits=[{layer:active,object,box:{x:90,y:90,w:20,h:20}}];
            Selector.pick({clientX:r.left+100,clientY:r.top+100,pointerId:1});Selector.finish();
            const variant=document.getElementById('selectionBuildingVariant'),palette=document.getElementById('selectionBuildingPalette');
            variant.value='2';variant.dispatchEvent(new Event('change'));palette.value='2';palette.dispatchEvent(new Event('change'));
            results.push(object.buildingStyle===2&&object.buildingPalette===2&&!document.getElementById('selectionBuildingStyle').hidden);
            const ctx=document.createElement('canvas').getContext('2d'),angles=[],rotate=ctx.rotate.bind(ctx);ctx.rotate=a=>{angles.push(a);rotate(a);};
            Buildings.draw(ctx,0,0,'castle',40,180);results.push(angles[0]===0);
            angles.length=0;Buildings.draw(ctx,0,0,'house',40,180);results.push(angles[0]===Math.PI);
            return results.every(Boolean);
        })()""")
        print(json.dumps({'entry':entry,'state':state,'controls':controls,'errors':errors}, ensure_ascii=False), flush=True)
        if not state.get('ready') or state.get('loading') or controls is not True or errors:
            raise AssertionError('Editor startup or location controls failed')
        if '--materials-only' in sys.argv:
            materials = js("""(()=>{
                for(const l of layers){l.visible=false;l.planet={enabled:false};}
                const l=layers[active];l.visible=true;l.opacity=1;l.terrain=Terrain.create();l.structures=[];
                const t=l.terrain;t.coverage.fill(255);t.heights.fill(65);t.biomes.fill(1);
                for(let y=0;y<275;y++)for(let x=0;x<400;x++){const k=y*400+x;if(x>245)t.biomes[k]=3;if(y>175&&x>245)t.biomes[k]=4;if(x<125&&y>150){t.waterLevels[k]=90;t.waterColors[k]='#347787';}}
                l.routes=[{kind:'path',width:22,points:[{x:450,y:500},{x:700,y:570},{x:1000,y:450},{x:1200,y:650}]},{kind:'river',width:25,points:[{x:550,y:300},{x:540,y:500},{x:420,y:700}]}];
                l.objects=[{kind:'building',building:'castle',x:850,y:480,size:70,rotation:0,text:'',color:'#ffffff',buildingStyle:0,buildingPalette:1}];
                tilt=35;yaw=0;zoom=2.2;ox=0;oy=0;textureDirty=true;draw();for(let i=0;i<100&&scene.detailStream;i++)draw();
                const r=canvas.getBoundingClientRect(),p=scene.project(810,530,4,camera());ox+=r.width/2-p.x;oy+=r.height/2-p.y;draw();for(let i=0;i<100&&scene.detailStream;i++)draw();
                const v=scene.structures.vertices;let roads=0,rivers=0;for(let i=5;i<v.length;i+=15){if(v[i]===9)roads++;if(v[i]===10)rivers++;}
                const texture=Terrain.detailTexture(),reuse=texture===Terrain.detailTexture(),c=camera();c.fullQuality=true;scene.draw(r.width,r.height,1,c);
                return {roads,rivers,noRaisedRibbons:roads===0&&rivers===0,routesPreserved:l.routes.length===2,finite:v.every(Number.isFinite),water:scene.waterVertices.length>0,gpu:scene.gl.getError()===0,reuse,small:texture.width===512&&texture.height===512,bytes:scene.performanceStats.residentBytes};
            })()""")
            print(json.dumps({'entry':entry,'materials':materials,'errors':errors}, ensure_ascii=False), flush=True)
            if not materials or not all(materials.get(k) for k in ['noRaisedRibbons','routesPreserved','finite','water','gpu','reuse','small']) or errors:
                raise AssertionError('Terrain material/export smoke test failed')
            screenshot=call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (root/('terrain-materials-built-preview.png' if entry.startswith('public') else 'terrain-materials-preview.png')).write_bytes(base64.b64decode(screenshot['data']))
            if entry=='index.html':
                js("zoom=3;const r=canvas.getBoundingClientRect(),p=scene.project(480,670,6,camera());ox+=r.width/2-p.x;oy+=r.height/2-p.y;draw();for(let i=0;i<100&&scene.detailStream;i++)draw();const c=camera();c.fullQuality=true;scene.draw(r.width,r.height,1,c);")
                png=js("scene.canvas.toDataURL('image/png').split(',')[1]")
                (root/'terrain-water-export-preview.png').write_bytes(base64.b64decode(png))
            continue
        if '--menu-only' in sys.argv:
            continue
        architecture = js("""(()=>{
            for(const layer of layers)layer.planet={enabled:false};
            const target=layers[active];
            const footprint=[{x:650,y:450},{x:850,y:450},{x:850,y:650},{x:650,y:650}];
            target.structures=Structures.capture('room',[{points:footprint,fill:'#b6ad98',close:true}],32,{material:'limestone'});
            tilt=48;yaw=0;textureDirty=true;fit();
            document.querySelector('[data-tool="select"]').click();
            const p=scene.project(750,550,.8,camera()),r=canvas.getBoundingClientRect();
            Selector.pick({clientX:r.left+p.x,clientY:r.top+p.y,pointerId:1});Selector.finish();
            if(Selector.selected?.collection!=='structures'||Selector.selected.members.length!==2)return {error:'room selection failed'};
            const before=history.length,shape=JSON.stringify(target.structures.map(o=>o.points));
            const picker=document.getElementById('selectionArchitectureMaterial');
            picker.value='jade';picker.dispatchEvent(new Event('change'));
            const edited=target.structures.every(o=>o.materialPreset==='jade'&&o.color===Structures.materials.jade.color)
                &&history.length===before+1&&JSON.stringify(target.structures.map(o=>o.points))===shape;
            const serialized=serializeCurrent();
            const saved=serialized.layers[active].structures.every(o=>o.materialPreset==='jade');
            const restored=Structures.validate(JSON.parse(JSON.stringify(target.structures)));
            target.locked=true;Selector.setArchitectureMaterial('wood');
            const locked=target.structures.every(o=>o.materialPreset==='jade');target.locked=false;
            undo();const undone=layers[active].structures.every(o=>o.materialPreset==='limestone');
            const keys=Object.keys(Structures.materials);
            const meshes=keys.every(key=>['wall','floor','stairs','pillar','bridgeWood'].every(kind=>{
                const points=kind==='wall'||kind==='bridgeWood'?footprint.slice(0,2):footprint;
                const parts=Structures.capture(kind,[{points,fill:kind==='wall'||kind==='bridgeWood'?undefined:'#aaaaaa',stroke:'#aaaaaa',close:true}],32,{material:key});
                for(const part of parts)Structures.applyMaterial(part,key);
                const mesh=Structures.build([{...layers[active],structures:parts}],false).vertices;
                return mesh.length>0&&mesh.every(Number.isFinite)&&parts.every(part=>Structures.materialOf(part)===key);
            }));
            return {edited,saved,locked,undone,meshes,materials:keys.length,creationOptions:document.getElementById('architectureMaterial').options.length,selectionOptions:picker.options.length,restored:restored.length};
        })()""")
        print(json.dumps({'entry':entry,'architecture':architecture,'errors':errors}, ensure_ascii=False), flush=True)
        if not architecture or not all(architecture.get(key) for key in ['edited','saved','locked','undone','meshes']) or errors:
            raise AssertionError('Architecture material editing failed')
        waterfalls = js("""(()=>{
            const target=layers[active],t=target.terrain;
            for(let y=0;y<275;y++)for(let x=0;x<400;x++){
                const k=y*400+x;t.coverage[k]=255;t.biomes[k]=4;t.heights[k]=x<190?800:x<225?800-(x-190)*22:0;
            }
            t.dirty=true;target.routes=[{kind:'river',width:24,points:[{x:700,y:420},{x:700,y:680}]}];
            document.querySelector('[data-tool="waterfall"]').click();
            const panel=document.getElementById('waterfallWidth').parentElement.parentElement;
            const options=!panel.hidden&&document.getElementById('size').closest('.setting').hidden;
            addWaterfall({x:715,y:550});addWaterfall({x:920,y:550});
            const fall=target.routes.find(r=>r.kind==='waterfall');
            if(!fall)return {error:'Waterfall placement failed'};
            const snap=fall.points[0].x===700&&MapPaths.waterSurface(layers,fall.points.at(-1)).water;
            const first=MapPaths.buildWaterfalls(layers,false).vertices;
            const finite=first.length>0&&first.every(Number.isFinite);
            const maxHeight=mesh=>Math.max(...Array.from({length:mesh.length/15},(_,i)=>mesh[i*15+2]));
            const before=maxHeight(first);for(let k=0;k<t.heights.length;k++)if(t.heights[k]>0)t.heights[k]*=.7;
            const adaptive=maxHeight(MapPaths.buildWaterfalls(layers,false).vertices)<before;
            const saved=serializeCurrent().layers[active].routes.some(r=>r.kind==='waterfall');
            const roundtrip=MapPaths.validate(JSON.parse(JSON.stringify(target.routes))).some(r=>r.kind==='waterfall');
            let flatRejected=false;try{MapPaths.createWaterfall(layers,{x:1000,y:500},{x:1100,y:500},24,false);}catch{flatRejected=true;}
            const lake=t.waterLevels;for(let y=510;y<590;y+=4)for(let x=880;x<940;x+=4)lake[Terrain.index(x,y)]=100;
            const lakeSnap=MapPaths.createWaterfall(layers,{x:700,y:550},{x:895,y:550},24,true);
            const lakeConnected=MapPaths.waterSurface(layers,lakeSnap.points.at(-1)).level===100;
            textureDirty=true;draw();const webgl=scene.gl.getError()===0&&scene.structures.vertices.every(Number.isFinite);
            undo();const undone=!layers[active].routes.some(r=>r.kind==='waterfall');
            return {options,snap,finite,adaptive,saved,roundtrip,flatRejected,lakeConnected,webgl,undone};
        })()""")
        print(json.dumps({'entry':entry,'waterfalls':waterfalls,'errors':errors}, ensure_ascii=False), flush=True)
        if not waterfalls or not all(waterfalls.get(key) for key in ['options','snap','finite','adaptive','saved','roundtrip','flatRejected','lakeConnected','webgl','undone']) or errors:
            raise AssertionError('Waterfall tool integration failed')
        performance_check = js("""(()=>{
            const target=layers[active];target.structures=[];target.routes=[];target.objects=[];
            for(const l of layers)l.planet={enabled:false};
            const t=target.terrain;t.coverage.fill(255);t.biomes.fill(2);t.heights.fill(60);t.waterLevels={};t.dirty=true;
            for(let y=80;y<1080;y+=100)for(let x=80;x<1580;x+=100)target.objects.push({kind:'building',building:'house',buildingStyle:0,buildingPalette:0,x,y,size:50,rotation:0,text:'',color:'#ffffff'});
            const originalCount=target.objects.length;
            const full=Vegetation.build(layers,false).vertices.byteLength+Buildings3D.build(layers,false).vertices.byteLength;
            yaw=0;tilt=35;zoom=5;textureDirty=true;draw();
            const center=(x,y)=>{const p=scene.project(x,y,4,camera()),r=document.getElementById('viewport').getBoundingClientRect();ox+=r.width/2-p.x;oy+=r.height/2-p.y;draw();for(let i=0;i<100&&scene.detailStream;i++)draw();};
            center(180,180);const a=scene.vegetation.vertices,b=scene.buildings.vertices,loaded=scene.buildings.entries.length,bytes=scene.performanceStats.residentBytes;
            const key=scene.detailKey;draw();const reused=scene.detailKey===key&&scene.vegetation.vertices===a&&scene.buildings.vertices===b;
            const lazy=scene.projected.length===0&&!scene.projectedReady;
            const p=scene.project(180,180,3.9,camera()),picked=scene.pick(p.x,p.y);
            const picking=!!picked&&Math.abs(picked.x-180)<1&&Math.abs(picked.y-180)<1;
            center(1380,880);const changed=scene.detailKey!==key&&scene.buildings.entries.some(e=>e.object.x>1100);
            center(180,180);const returned=scene.buildings.entries.some(e=>e.object.x<400);
            const preserved=target.objects.length===originalCount;
            const terrainCulled=scene.terrainRanges.reduce((n,r)=>n+r.count,0)<scene.vertices.length/6;
            const gpu=scene.gl.getError()===0;
            const saved=serializeCurrent().layers[active].objects.length===originalCount;
            const oldHistory=history,oldFuture=future;history=[{bytes:90*1024*1024},{bytes:90*1024*1024},{bytes:40*1024*1024}];future=[];trimHistory();const budget=history.reduce((n,s)=>n+s.bytes,0)<=128*1024*1024;history=oldHistory;future=oldFuture;
            const stats={...scene.performanceStats},r=document.getElementById('viewport').getBoundingClientRect();
            const settle=()=>{draw();for(let i=0;i<100&&scene.detailStream;i++)draw();};
            for(const l of layers)l.planet={enabled:true};yaw=0;tilt=0;zoom=1;ox=r.width/2;oy=r.height/2;textureDirty=true;settle();
            const front=scene.buildings.entries.length;const globePick=scene.pick(r.width/2,r.height/2);
            yaw=180;settle();const rear=scene.buildings.entries.length;const hemisphere=front>0&&rear===0&&!!globePick;
            yaw=0;settle();const globeReturn=scene.buildings.entries.length===front;
            for(const l of layers)l.planet={enabled:false};tilt=35;textureDirty=true;scene.firstPerson={origin:[0,-150,12],forward:[0,1,0],right:[1,0,0],up:[0,0,1],focal:600,width:r.width,height:r.height};settle();
            const walk=scene.gl.getError()===0&&scene.buildings.entries.length>0&&scene.structures.vertices.every(Number.isFinite);scene.firstPerson=null;draw();
            return {reused,lazy,picking,changed,returned,preserved,terrainCulled,gpu,saved,budget,hemisphere,globeReturn,walk,loaded,total:originalCount,fullBytes:full,residentBytes:bytes,reduced:bytes<full*.7,stats};
        })()""")
        print(json.dumps({'entry':entry,'performance':performance_check,'errors':errors}, ensure_ascii=False), flush=True)
        if not performance_check or not all(performance_check.get(key) for key in ['reused','lazy','picking','changed','returned','preserved','terrainCulled','gpu','saved','budget','reduced','hemisphere','globeReturn','walk']) or errors:
            raise AssertionError('Camera streaming or memory safeguards failed')
        if entry=='index.html':
            js("undo(true);for(const l of layers)l.structures=[];yaw=-65;tilt=55;zoom=3;const p=scene.project(820,550,20,camera());ox+=canvas.clientWidth/2-p.x;oy+=canvas.clientHeight/2-p.y;textureDirty=true;draw();")
            screenshot=call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (root/'waterfall-preview.png').write_bytes(base64.b64decode(screenshot['data']))
finally:
    if ws:
        ws.close()
    proc.terminate()

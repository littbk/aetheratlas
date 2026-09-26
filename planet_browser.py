"""Smoke test for the spherical editor in headless Chrome."""
import json
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

import websocket

ROOT = Path(__file__).resolve().parent
with tempfile.TemporaryDirectory(prefix="aether-planet-", ignore_cleanup_errors=True) as profile:
    chrome = subprocess.Popen([
        "C:/Program Files/Google/Chrome/Application/chrome.exe", "--headless",
        "--no-first-run", "--no-default-browser-check", "--allow-file-access-from-files",
        "--remote-debugging-port=0", "--remote-allow-origins=http://localhost",
        f"--user-data-dir={profile}", "--window-size=1500,1000", "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
       creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        for _ in range(100):
            try:
                port = (Path(profile) / "DevToolsActivePort").read_text().splitlines()[0]
                pages = json.load(urllib.request.urlopen(f"http://localhost:{port}/json"))
                page = next(p for p in pages if p["type"] == "page")
                break
            except (OSError, StopIteration):
                time.sleep(.1)
        else:
            raise RuntimeError("Chrome não iniciou")
        ws = websocket.create_connection(page["webSocketDebuggerUrl"], origin="http://localhost", timeout=60)
        sequence = 0

        def call(method, params=None):
            global sequence
            sequence += 1
            ident = sequence
            ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
            while True:
                message = json.loads(ws.recv())
                if message.get("method") == "Runtime.exceptionThrown":
                    print("BROWSER ERROR", message["params"]["exceptionDetails"].get("exception", {}).get("description"), flush=True)
                if message.get("id") == ident:
                    if "error" in message:
                        raise RuntimeError(message["error"])
                    return message.get("result", {})

        def evaluate(expression):
            result = call("Runtime.evaluate", {"expression": expression,
                "returnByValue": True, "awaitPromise": True})
            if "exceptionDetails" in result:
                raise RuntimeError(result["exceptionDetails"])
            return result.get("result", {}).get("value")

        call("Page.enable")
        call("Runtime.enable")
        call("Page.navigate", {"url": (ROOT / "index.html").as_uri()})
        for _ in range(100):
            if evaluate("typeof layers!=='undefined' && layers.length===3 && scene.projected.length>0"):
                break
            time.sleep(.1)
        print(evaluate("({href:location.href,ready:document.readyState,layers:typeof window.layers})"), flush=True)
        assert evaluate("!!scene.gl && camera().planet && scene.gl.getError()===0")
        assert evaluate("scene.project(800,550,0,camera()).visible")
        assert not evaluate("scene.project(800,550,0,{...camera(),yaw:180}).visible")
        assert evaluate("(()=>{const before=scene.project(1000,600,0,camera());roll=90;draw();const after=scene.project(1000,600,0,camera()),picked=scene.pick(after.x,after.y);const turned=Math.abs((after.x-ox)+(before.y-oy))<.01&&Math.abs((after.y-oy)-(before.x-ox))<.01;roll=0;draw();return turned&&picked&&Math.abs(picked.x-1000)<45&&Math.abs(picked.y-600)<45})()")
        assert evaluate("(()=>{const p=scene.project(800,550,0,camera()),q=scene.pick(p.x,p.y);return q&&Math.abs(q.x-800)<45&&Math.abs(q.y-550)<45})()")
        assert evaluate("(()=>{const l=layers[0];l.objects.push({kind:'marker',symbol:'◇',x:800,y:550,size:40,rotation:0,text:'Teste',color:'#ffffff'});draw();const front=billboardHits.length;yaw=180;draw();const back=billboardHits.length;return front>0&&back===0})()")
        assert evaluate("(()=>{yaw=0;tilt=0;fit();zoom=.8;draw();const large=billboardHits[0]?.size;zoom=.4;draw();const small=billboardHits[0]?.size;zoom=5;draw();const capped=billboardHits[0]?.size;tilt=38;fit();return large>small&&small>=6&&small<large*.7&&capped<=56})()")
        assert evaluate("(()=>{document.querySelector('[data-tool=player]').click();yaw=0;tilt=0;draw();const p=scene.project(5200,2200,0,camera(),true),hit=scene.pick(p.x,p.y);beginPaint({...hit,inside:false});return Math.abs(playerLocation.x-5200)<45&&Math.abs(playerLocation.y-2200)<45})()")
        assert evaluate("(async()=>{yaw=0;const c=document.createElement('canvas');c.width=64;c.height=64;c.getContext('2d').fillStyle='#ff0000';c.getContext('2d').fillRect(0,0,64,64);const data=c.toDataURL();const image=new Image();image.src=data;await image.decode();patches.push({id:'test',name:'Importado',x:4800,y:1650,width:1600,height:1100,data,image});textureDirty=true;draw();return scene.planetTexture.width>=2048&&patches.length===1})()")
        assert evaluate("(()=>{roll=45;draw();const d=projectData();return d.world.width===8000&&d.world.height===4400&&d.world.patches.length===1&&d.camera.roll===45&&Math.abs(d.world.playerLocation.x-5200)<45})()")
        assert evaluate("(async()=>{const blob=await(await fetch(patches[0].data)).blob();const file=new File([blob],'mapa-antigo.png',{type:'image/png'});await $('legacyFile').onchange({target:{files:[file],value:''}});return patches.length===2&&$('patchSelect').options.length===3})()")
        assert evaluate("(async()=>{const data=projectData();dirty=false;roll=0;playerLocation={x:4000,y:2200};const file=new File([JSON.stringify(data)],'mundo.json',{type:'application/json'});const result=await $('file').onchange({target:{files:[file],value:''}});return result&&patches.length===2&&roll===45&&Math.abs(playerLocation.x-5200)<45&&scene.gl.getError()===0})()")
        assert evaluate("(async()=>{const {MapViewer}=await import('./mapa-rpg/viewer.js');const stage=document.createElement('div'),element=document.createElement('canvas');stage.style.cssText='width:800px;height:600px;position:absolute;left:-9999px';stage.append(element);document.body.append(stage);const viewer=new MapViewer(element,stage,()=>{});await viewer.load(projectData());const pivot=viewer.scene.project(viewer.playerLocation.x,viewer.playerLocation.y,0,viewer.camera(),true),centered=Math.abs(pivot.x-400)<3&&Math.abs(pivot.y-300)<3;const loaded=viewer.c.roll===45;viewer.rotateRoll(90);const rotated=viewer.c.roll===90&&viewer.scene.gl.getError()===0;stage.remove();return loaded&&rotated&&centered})()")
        assert evaluate("(async()=>{window.saved=[];download=(blob,ext)=>saved.push({blob,ext});$('viewExport').click();for(let i=0;i<100&&!saved.length;i++)await new Promise(r=>setTimeout(r,50));if(!saved.length)return false;const image=await createImageBitmap(saved[0].blob);return image.width>3000&&image.height>2000})()")
        assert evaluate("(async()=>{saved=[];$('export').click();for(let i=0;i<200&&!saved.length;i++)await new Promise(r=>setTimeout(r,50));if(!saved.length)return false;const image=await createImageBitmap(saved[0].blob);return image.width===8000&&image.height===4400})()")
        print("PASS planeta, rotacao Z, zoom dos icones, LOCAL ATUAL, abertura do visualizador, projeto e exportacao")
    finally:
        chrome.terminate()
        chrome.wait(timeout=10)

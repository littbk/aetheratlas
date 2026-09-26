"""Browser integration: immutable tree colors, object selection and layer transfers."""
import json, subprocess, tempfile, time, urllib.request, base64
from pathlib import Path
import websocket
ROOT=Path(__file__).resolve().parent
with tempfile.TemporaryDirectory(prefix='atlas-selector-',ignore_cleanup_errors=True) as profile:
    proc=subprocess.Popen(['C:/Program Files/Google/Chrome/Application/chrome.exe','--headless','--no-first-run','--allow-file-access-from-files','--remote-debugging-port=0','--remote-allow-origins=http://localhost',f'--user-data-dir={profile}','--window-size=1500,1000','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
    ws=None
    try:
        for _ in range(100):
            try:
                port=(Path(profile)/'DevToolsActivePort').read_text().splitlines()[0]
                page=next(p for p in json.load(urllib.request.urlopen(f'http://localhost:{port}/json')) if p['type']=='page');break
            except (OSError,StopIteration):time.sleep(.1)
        ws=websocket.create_connection(page['webSocketDebuggerUrl'],origin='http://localhost',timeout=60);seq=0;errors=[]
        def call(method,params=None):
            global seq
            seq+=1;ident=seq;ws.send(json.dumps({'id':ident,'method':method,'params':params or {}}))
            while True:
                r=json.loads(ws.recv())
                if r.get('method')=='Runtime.exceptionThrown':errors.append(r['params'])
                if r.get('id')==ident:return r.get('result',{})
        def js(expr):
            r=call('Runtime.evaluate',{'expression':expr,'returnByValue':True,'awaitPromise':True})
            if 'exceptionDetails' in r:raise RuntimeError(r['exceptionDetails'])
            return r.get('result',{}).get('value')
        def check(expr,name):
            assert js(expr),(name,errors,js("({errors:scriptErrors,scripts:[...document.scripts].map(s=>s.src),client:typeof AtlasDriveClient,drive:typeof driveToken})"))
            print('PASS',name,flush=True)
        def mouse(kind,p,buttons=0):call('Input.dispatchMouseEvent',{'type':kind,'x':p['x'],'y':p['y'],'button':'left','buttons':buttons,'clickCount':1})
        def click(p):mouse('mousePressed',p,1);mouse('mouseReleased',p)
        call('Runtime.enable');call('Page.enable');call('Page.addScriptToEvaluateOnNewDocument',{'source':"window.scriptErrors=[];window.addEventListener('error',e=>scriptErrors.push(e.message||e.target.src),true)"});call('Page.navigate',{'url':(ROOT/'index.html').as_uri()})
        for _ in range(100):
            if js("typeof Selector!=='undefined'&&layers.length&&scene.projected.length>0"):break
            time.sleep(.1)
        check("typeof AtlasDriveClient==='function'&&!!$('driveBrowse')&&!!$('driveDialog')",'Drive library initialized')
        js("window.prefs=[];window.uploads=[];driveClient.authenticate=async()=>{driveToken='mock';driveServerSession=true;};driveClient.metadata=async id=>({id,name:id+'.aether-atlas.json',capabilities:{canEdit:true}});driveClient.list=async o=>({files:o.folders?[{id:'folder-id',name:'Praias',mimeType:'application/vnd.google-apps.folder'}]:[{id:'first-map-id',name:'Mundo azul'},{id:'second-map-id',name:'Mundo magico'}]});persistDrivePreference=async b=>prefs.push(b);driveClient.download=async()=>new Blob([JSON.stringify({...projectData(),title:'Mapa escolhido'})]);driveClient.upload=async o=>{uploads.push({id:o.id,folder:o.folder,name:o.name});o.onProgress(100);return {id:o.id||'copy-map-id',name:o.name,capabilities:{canEdit:true}}};$('driveAutosave').checked=false;dirty=false;")
        check("(async()=>{await showDriveLibrary();await loadDriveFiles();return $('driveFileList').children.length===3&&driveDialog.open})()",'library displays maps and folders')
        check("(async()=>{await setDriveDefault({id:'first-map-id',name:'Mundo azul'});await openDriveProject('second-map-id');return driveDefaultId==='first-map-id'&&driveFileId==='second-map-id'&&$('title').value==='Mapa escolhido'&&prefs.at(-1).fileId==='second-map-id'})()",'opening another map preserves pinned default')
        check("(async()=>{dirty=true;driveRevision++;await saveToDrive();return uploads.at(-1).id==='second-map-id'&&!dirty&&driveDefaultId==='first-map-id'})()",'save updates only editing target')
        check("(async()=>{await saveToDrive({copy:true,name:'Praia rosa',folder:'folder-id'});return uploads.at(-1).id===''&&uploads.at(-1).folder==='folder-id'&&driveFileId==='copy-map-id'&&driveDefaultId==='first-map-id'})()",'save copy creates file in chosen folder without changing default')
        check("(async()=>{detachDriveProject();dirty=true;await saveToDrive({automatic:true});return uploads.length===2&&driveFileId===''})()",'new or imported map never automatically overwrites prior file')
        check("(async()=>{dirty=false;driveClient.upload=async()=>{throw Error('simulated network failure')};dirty=true;return !await saveToDrive()&&dirty})()",'failed save preserves unsaved changes')
        check("(async()=>{const opening=openDriveProject('first-map-id');await new Promise(r=>setTimeout(r,20));driveUnsaved.querySelector('[data-decision=cancel]').click();return !await opening&&dirty&&driveFileId===''})()",'cancel preserves map with unsaved changes')
        check("(async()=>{dirty=false;await setDriveDefault(null);return driveDefaultId===''&&prefs.at(-1).defaultFileId===null})()",'default can be removed')
        check("(async()=>{dirty=false;driveLocalProject=false;driveDefaultId='first-map-id';await restoreDriveSession();return driveFileId==='first-map-id'})()",'startup opens pinned file')
        check("(async()=>{driveClient.download=async()=>{driveRevision++;dirty=true;return new Blob(['{}'])};return !await openDriveProject('second-map-id')&&driveFileId==='first-map-id'&&dirty})()",'edits during download cancel replacement')
        js("dirty=false;showDriveLibrary(true)")
        shot=call('Page.captureScreenshot',{'format':'png'});(ROOT/'drive-preview.png').write_bytes(base64.b64decode(shot['data']))
        call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
        check("driveDialog.getBoundingClientRect().width<=390&&document.documentElement.scrollWidth<=390",'mobile library fits screen')
        shot=call('Page.captureScreenshot',{'format':'png'});(ROOT/'drive-mobile-preview.png').write_bytes(base64.b64decode(shot['data']))
        assert not errors,errors
    finally:
        if ws:ws.close()
        proc.terminate()



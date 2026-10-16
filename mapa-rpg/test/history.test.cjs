const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
test('history retains twenty actions, restores deletions and clears redo after new edits',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../app.js'),'utf8');
  const c={regionContext:null,history:[],future:[],layers:[],patches:[],playerLocation:{x:0,y:0},active:0,value:0,snapshot(){return this.value;},patchSnapshot(){return[];},restore(s){this.value=s.layers;}};
  c.snapshot=()=>[{value:c.value}];c.restore=s=>{c.value=s.layers[0].value;};vm.createContext(c);
  vm.runInContext(source.slice(source.indexOf('function historySnapshot()'),source.indexOf('function restore(s)'))+'\n'+source.split('\n').find(line=>line.startsWith('function undo(')),c);
  for(let n=1;n<=21;n++){c.remember();c.value=n;}
  assert.equal(c.history.length,20);for(let n=0;n<20;n++)c.undo();assert.equal(c.value,1);c.undo();assert.equal(c.value,1);
  for(let n=0;n<20;n++)c.undo(true);assert.equal(c.value,21);c.undo();c.remember();c.value=99;assert.equal(c.future.length,0);c.undo();assert.equal(c.value,20);
});

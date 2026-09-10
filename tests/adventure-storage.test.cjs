const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
async function moduleWith(data={},lock=true){
 const values=new Map(Object.entries(data));
 global.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 Object.defineProperty(global,'navigator',{configurable:true,value:{locks:{request:async(name,options,callback)=>callback(lock?{}:null)}}});
 const mod=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('src/Handwriting.Client/wwwroot/js/adventure.js','utf8')+'\n//'+Math.random()).toString('base64'));
 return {mod,values};
}
test('legacy is backed up and imported only once; children round trip separately',async()=>{
 const old=JSON.stringify({progress:{'numbers-0':{completed:true,successfulAttempts:2}},muted:true});
 const {mod,values}=await moduleWith({'little-hands-state-v1':old});
 assert.equal(await mod.acquireWriter(),true);
 const loaded=mod.loadAdventure();
 assert.equal(loaded.state.legacyProgress['numbers-0'].successfulAttempts,2);
 assert.equal(values.get('little-hands-state-v1-backup'),old);
 const child=id=>({id,name:id,avatar:'numbers',progress:{},startedCategories:[],challenges:{},awards:{}});
 loaded.state.children=[child('a'),child('b')];loaded.state.activeChildId='a';loaded.state.legacyProgress=null;
 loaded.state.children[0].progress={'numbers-0':{completed:true,successfulAttempts:2}};
 assert.equal(mod.saveAdventure(loaded.state),true);
 const reloaded=mod.loadAdventure().state;
 assert.equal(reloaded.legacyProgress,null);
 assert.deepEqual(reloaded.children[1].progress,{});
 mod.releaseWriter();
 assert.equal(mod.saveAdventure(loaded.state),false);
});
test('second tab cannot write or migrate',async()=>{
 const {mod,values}=await moduleWith({'little-hands-state-v1':'{}'},false);
 assert.equal(await mod.acquireWriter(),false);
 assert.equal(mod.saveAdventure({}),false);
 mod.loadAdventure();
 assert.equal(values.has('little-hands-state-v1-backup'),false);
});
test('malformed nested state is preserved and cannot silently replace progress',async()=>{
 for(const child of [{id:'a',progress:[]},{id:'a',name:'A',avatar:'numbers',progress:{},startedCategories:[],challenges:{bad:{wins:-1}},awards:{}}]){
  const raw=JSON.stringify({version:2,children:[child]});
  const {mod,values}=await moduleWith({'little-hands-state-v2':raw});await mod.acquireWriter();
  assert.equal(mod.loadAdventure().malformed,true);
  assert.equal(values.get('little-hands-state-v2'),raw);
  assert.equal(mod.saveAdventure({version:2,children:[]}),false);
 }
});
test('storage exceptions report failure',async()=>{
 const {mod}=await moduleWith();await mod.acquireWriter();
 global.localStorage.setItem=()=>{throw Error('quota')};
 assert.equal(mod.saveAdventure({version:2,children:[],activeChildId:null,legacyProgress:null}),false);
});
test('calendar-invalid dates cannot reach .NET DateTimeOffset deserialization',async()=>{
 for(const lastPracticed of ['2024-02-30T00:00:00Z','2025-02-29T00:00:00Z','0000-01-01T00:00:00Z','2025-01-01T24:00:00Z']){
  const {mod}=await moduleWith({'little-hands-state-v1':JSON.stringify({progress:{'numbers-0':{completed:true,successfulAttempts:1,lastPracticed}}})});
  await mod.acquireWriter();assert.equal(mod.loadAdventure().malformed,true,lastPracticed);
 }
});

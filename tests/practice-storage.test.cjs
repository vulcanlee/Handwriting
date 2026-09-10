const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('valid JSON with invalid progress shape is recovered without breaking Blazor',async()=>{
 const mod=await import('data:text/javascript;base64,'+fs.readFileSync('src/Handwriting.Client/wwwroot/js/adventure.js').toString('base64'));
 for(const json of ['{"progress":[]}', '{"progress":{"numbers-0":{"lastPracticed":"not-a-date"}}}','{"progress":{"numbers-0":null}}','{"progress":{"numbers-0":{"completed":true,"successfulAttempts":"oops"}}}']){
  global.localStorage={setItem(){},removeItem(){},getItem(key){return key==='little-hands-state-v1'?json:null;}};
  const state=mod.loadAdventure();assert.equal(state.malformed,true);assert.deepEqual(state.state.children,[]);
 }
});

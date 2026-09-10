const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('required cue tolerates blocked audio and cancellation without leaving input locked',async()=>{
 global.document={querySelectorAll:()=>[]};
 global.window={matchMedia:()=>({matches:true})};
 global.Audio=class extends EventTarget {play(){return Promise.reject(Error('blocked'));} pause(){} };
 const mod=await import('data:text/javascript;base64,'+fs.readFileSync('src/Handwriting.Client/wwwroot/js/practice.js').toString('base64'));
 assert.equal(typeof mod.requiredCue,'function');
 assert.equal(await mod.requiredCue(0,['missing.mp3'],0),false);
 mod.cancelOwner(0);
 assert.equal(await mod.requiredCue(0,[],0),true);
});

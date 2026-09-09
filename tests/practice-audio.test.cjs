const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
let suffix=0;
async function moduleUnderTest(){return import('data:text/javascript;base64,'+fs.readFileSync('src/Handwriting.Client/wwwroot/js/practice.js').toString('base64')+'#'+suffix++);}
test('stopping a sequence resolves without starting its next clip or reporting a playback failure',{timeout:2000},async()=>{
 const made=[];
 global.Audio=class extends EventTarget{constructor(src){super();this.src=src;made.push(src);}play(){return Promise.resolve();}pause(){}};
 const mod=await moduleUnderTest();const playing=mod.playSequence(['first.mp3','second.mp3']);
 await new Promise(resolve=>setImmediate(resolve));mod.stopAudio();
 assert.equal(await playing,true);assert.deepEqual(made,['first.mp3']);
});
test('cancelling while play is pending cannot revive the old sequence',{timeout:2000},async()=>{
 let resolvePlay;const made=[];
 global.Audio=class extends EventTarget{constructor(src){super();made.push(src);}play(){return new Promise(resolve=>resolvePlay=resolve);}pause(){}};
 const mod=await moduleUnderTest();const playing=mod.playSequence(['first.mp3','second.mp3']);
 mod.stopAudio();resolvePlay();assert.equal(await playing,true);assert.deepEqual(made,['first.mp3']);
});

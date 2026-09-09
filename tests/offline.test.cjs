const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function worker(failAt=-1) {
 const listeners={}, stored=new Map(), deleted=[]; let fetched=0;
 const manifest={version:'test-v1',assets:[{url:'index.html',hash:'h1'},{url:'audio/a.mp3',hash:'h2'},{url:'audio/b.wav',hash:'h3'},{url:'data/symbols.json',hash:'h4'},{url:'_framework/a.wasm',hash:'h5'}]};
 const cache={put:async(k,v)=>stored.set(typeof k==='string'?k:k.url,v),match:async(k)=>stored.get(typeof k==='string'?k:k.url)};
 cache.addAll=async(requests)=>{for(const request of requests)await cache.put(request,{ok:true});};
 const self={origin:'https://example.test',assetsManifest:manifest,location:{origin:'https://example.test'},registration:{scope:'https://example.test/'},clients:{matchAll:async()=>[],claim:async()=>{}},importScripts(){},addEventListener:(n,cb)=>listeners[n]=cb};
 const context={self,URL,Request:class {constructor(url,options){this.url=url;this.options=options;}},Response:class{constructor(body){this.body=body;}},caches:{open:async()=>cache,keys:async()=>['handwriting-old'],delete:async(k)=>{deleted.push(k);return true;}},fetch:async()=>{if(fetched++===failAt)throw Error('network');return {ok:true,text:async()=>'<script type="importmap">{"imports":{"./data/symbols.json":"./data/symbols.hash.json"}}</script>',clone(){return this;}};},console};
 vm.runInNewContext(fs.readFileSync('src/Handwriting.Client/wwwroot/service-worker.published.js','utf8'),context);
 context.Response=Response;
 return {listeners,stored,deleted,manifest,context};
}
test('complete cache includes audio and commits ready marker only after all resources',async()=>{
 const w=worker();let task;w.listeners.install({waitUntil:p=>task=p});await task;
 assert.equal(w.stored.size,7);
 assert.ok([...w.stored.keys()].some(k=>k.endsWith('.mp3')));
 assert.ok([...w.stored.keys()].some(k=>k.endsWith('.wav')));
 assert.ok([...w.stored.keys()].some(k=>k.endsWith('__ready')));
 assert.ok([...w.stored.keys()].some(k=>k.endsWith('symbols.hash.json')),'import-map aliases must work offline');
});
test('interrupted install is not marked ready and leaves active cache intact',async()=>{
 const w=worker(2);let task;w.listeners.install({waitUntil:p=>task=p});await assert.rejects(task,/network/);
 assert.ok(![...w.stored.keys()].some(k=>k.endsWith('__ready')));assert.deepEqual(w.deleted,[]);
});
test('retry re-registers after a failed first install leaves a stale registration',async()=>{
 let registrations=0;
 const stale={addEventListener(){},update:async()=>{throw new Error('InvalidStateError');}};
 const navigator={serviceWorker:{register:async()=>{registrations++;return stale;},addEventListener(){}}};
 const window={isSecureContext:true};
 vm.runInNewContext(fs.readFileSync('src/Handwriting.Client/wwwroot/js/offline.js','utf8'),{navigator,window,Set,console});
 await new Promise(resolve=>setImmediate(resolve));
 await window.handwritingOffline.retry();
 assert.equal(registrations,2);
});
test('cached media supports byte ranges without requiring a network request',async()=>{
 const w=worker();
 const response=await w.context.rangeResponse(new Response(new Uint8Array([10,20,30,40,50]),{headers:{'content-type':'audio/wav','content-encoding':'gzip'}}),'bytes=1-3');
 assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 1-3/5');
 assert.equal(response.headers.get('content-encoding'),null);
 assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[20,30,40]);
});

self.importScripts('./service-worker-assets.js');
const prefix='handwriting-';
const cacheName=prefix+self.assetsManifest.version;
const base=self.registration.scope;
const readyUrl=new URL('__ready',base).href;
const assets=self.assetsManifest.assets.filter(a=>!/^service-worker(?:\.published)?\.js$/.test(a.url));
async function notify(status){
    for(const client of await self.clients.matchAll({includeUncontrolled:true}))client.postMessage({type:'offline-status',status});
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
    const cache=await caches.open(cacheName);
    try{
        let completed=0;
        for(const asset of assets){
            const request=new Request(new URL(asset.url,base).href,{integrity:asset.hash,cache:'no-cache'});
            const response=await fetch(request);
            if(!response.ok)throw new Error('教材下載失敗：'+asset.url);
            await cache.put(request,response);
            completed++;
            if(completed%20===0)await notify(`正在下載離線教材 ${Math.round(completed/assets.length*100)}%`);
        }
        // .NET 10 maps JS imports to fingerprinted endpoint aliases, while the
        // PWA manifest can still list their original physical filenames.
        const index=await cache.match(new URL('index.html',base).href);
        const html=await index.text();
        const match=html.match(/<script\b[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i);
        if(match){
            const imports=JSON.parse(match[1]).imports || {};
            for(const [source,destination] of Object.entries(imports)){
                const alias=new URL(destination,base).href;
                if(new URL(alias).origin!==new URL(base).origin)continue;
                if(await cache.match(alias))continue;
                const original=await cache.match(new URL(source,base).href);
                if(!original)throw new Error('缺少離線模組：'+source);
                await cache.put(alias,original);
            }
        }
        await cache.put(readyUrl,new Response(self.assetsManifest.version));
        await notify('教材下載完成，關閉所有本網站分頁後可套用');
    }catch(error){await notify('教材下載中斷，請按「檢查離線教材」重試');throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith(prefix)&&key!==cacheName)await caches.delete(key);
    await self.clients.claim();
    await notify('已可離線使用');
})()));
self.addEventListener('message',event=>{
    if(event.data?.type==='status')event.waitUntil((async()=>{
        const cache=await caches.open(cacheName);
        event.source?.postMessage({type:'offline-status',status:await cache.match(readyUrl)?'已可離線使用':'離線教材尚未下載完成'});
    })());
});
self.addEventListener('fetch',event=>{
    if(event.request.method!=='GET'||new URL(event.request.url).origin!==new URL(base).origin)return;
    event.respondWith((async()=>{
        const cache=await caches.open(cacheName);
        const key=event.request.mode==='navigate'?new URL('index.html',base).href:event.request;
        const cached=await cache.match(key,{ignoreVary:true});
        const range=event.request.headers.get('range');
        if(cached&&range&&/\.(wav|mp3)$/i.test(new URL(event.request.url).pathname))
            return rangeResponse(cached,range);
        return cached||fetch(event.request);
    })());
});

// Media elements request byte ranges even when a complete audio file is cached.
async function rangeResponse(response,range){
    const bytes=await response.arrayBuffer();
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${bytes.byteLength}`}});
    const start=match[1]?Number(match[1]):Math.max(0,bytes.byteLength-Number(match[2]));
    const end=match[1]&&match[2]?Math.min(Number(match[2]),bytes.byteLength-1):bytes.byteLength-1;
    if(start>end||start>=bytes.byteLength)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${bytes.byteLength}`}});
    return new Response(bytes.slice(start,end+1),{status:206,headers:{
        'Content-Type':response.headers.get('Content-Type')||'application/octet-stream',
        'Content-Range':`bytes ${start}-${end}/${bytes.byteLength}`,
        'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'
    }});
}

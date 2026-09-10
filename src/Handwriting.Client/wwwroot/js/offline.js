(() => {
    let status='正在檢查離線教材', registration, listeners=new Set();
    function publish(value){status=value;for(const fn of listeners)fn(value);}
    async function register(){
        if(!('serviceWorker' in navigator)||!window.isSecureContext){publish('HTTP 線上模式 · 離線功能需 HTTPS 或 localhost');return;}
        try{
            registration=await navigator.serviceWorker.register('service-worker.js',{updateViaCache:'none'});
            registration.addEventListener('updatefound',()=>{
                const worker=registration.installing;
                publish('正在下載離線教材');
                worker?.addEventListener('statechange',()=>{
                    if(worker.state==='redundant')publish('教材下載中斷，請重新檢查');
                    if(worker.state==='installed'&&registration.waiting)publish('新版教材已備妥，關閉所有本網站分頁後套用');
                });
            });
            if(registration.waiting)publish('新版教材已備妥，關閉所有本網站分頁後套用');
            else if(registration.active)registration.active.postMessage({type:'status'});
            else publish('正在下載離線教材');
        }catch{publish('離線教材尚未就緒，請重新檢查');}
    }
    navigator.serviceWorker?.addEventListener('message',event=>{
        if(event.data?.type==='offline-status')publish(event.data.status);
    });
    navigator.serviceWorker?.addEventListener('controllerchange',()=>navigator.serviceWorker.controller?.postMessage({type:'status'}));
    window.handwritingOffline={
        subscribe(fn){listeners.add(fn);fn(status);return()=>listeners.delete(fn);},
        async retry(){
            publish('正在檢查離線教材');
            try {
                // A failed first install may invalidate the previous registration.
                // Register again before asking the new registration to update.
                await register();
                if(registration)await registration.update();
            }
            catch{publish('無法下載教材，請確認網路後重試');}
        }
    };
    register();
})();

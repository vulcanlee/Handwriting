let canvas,ctx,dotnet,generation=0,active=null,points=[],locked=false,audio=null,audioToken=0,unsubscribe=null,resizeObserver=null;
function size(){if(!canvas)return;const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx=canvas.getContext('2d');ctx.scale(d,d);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#147d76';ctx.lineWidth=Math.max(7,r.width*.025)}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100,time:e.timeStamp}}
function down(e){if(document.hidden||locked||active!==null||!e.isPrimary||!(e.pointerType==='touch'||e.pointerType==='pen'||e.pointerType==='mouse'))return;active=e.pointerId;points=[point(e)];canvas.setPointerCapture(active);dotnet.invokeMethodAsync('DrawingStarted',generation);e.preventDefault()}
function move(e){if(e.pointerId!==active||locked)return;const p=point(e),last=points.at(-1),r=canvas.getBoundingClientRect();points.push(p);ctx.beginPath();ctx.moveTo(last.x/100*r.width,last.y/100*r.height);ctx.lineTo(p.x/100*r.width,p.y/100*r.height);ctx.stroke();e.preventDefault()}
async function up(e){if(e.pointerId!==active||locked)return;if(document.hidden){active=null;points=[];clearInk();return;}points.push(point(e));active=null;locked=true;const sent=generation;try{await dotnet.invokeMethodAsync('SubmitStroke',points,sent)}finally{if(sent===generation)locked=false}}
function cancelled(e){if(e.pointerId===active){active=null;points=[];clearInk()}}
export function initCanvas(id,reference,gen){detach();canvas=document.getElementById(id);if(!canvas)return;dotnet=reference;generation=gen;locked=false;size();canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancelled);resizeObserver=new ResizeObserver(()=>{active=null;points=[];size()});resizeObserver.observe(canvas)}
function detach(){if(!canvas)return;canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancelled);resizeObserver?.disconnect();canvas=null;ctx=null;active=null;points=[]}
export function clearInk(){if(ctx&&canvas){const d=Math.min(devicePixelRatio||1,2);ctx.clearRect(0,0,canvas.width/d,canvas.height/d)}}
export function cancel(gen){generation=gen;locked=false;detach();stopAudio();stopDemo()}
export async function playAudio(src){stopAudio();const token=audioToken;const current=new Audio(src);audio=current;try{await current.play();return true}catch{if(token!==audioToken)return true;audio=null;return false}}
export async function playSequence(sources){
    stopAudio();const token=audioToken;
    try{
        for(const src of sources){
            if(token!==audioToken)return true;
            const current=new Audio(src);audio=current;
            await new Promise((resolve,reject)=>{
                let timeout;
                const finish=error=>{clearTimeout(timeout);current.removeEventListener('ended',ended);current.removeEventListener('error',failed);error?reject(error):resolve();};
                const ended=()=>finish(),failed=()=>finish(new Error('audio'));
                current.addEventListener('ended',ended,{once:true});current.addEventListener('error',failed,{once:true});
                timeout=setTimeout(()=>{current.pause();finish(new Error('audio-timeout'));},20000);
                Promise.resolve(current.play()).catch(finish);
            });
        }
        if(token===audioToken)audio=null;
        return true;
    }catch{if(token!==audioToken)return true;audio=null;return false;}
}
export function stopAudio(){audioToken++;if(audio){audio.pause();audio.dispatchEvent(new Event('ended'));audio.currentTime=0;audio=null}}
let demoAnimations=[];
function stopDemo(){
    for(const animation of demoAnimations)animation.cancel();
    demoAnimations=[];
    for(const path of document.querySelectorAll('.demo-stroke')){
        path.style.strokeDasharray='';path.style.strokeDashoffset='';
    }
}
export function replayDemo(index=-1){
    stopDemo();
    const paths=[...document.querySelectorAll('.demo-stroke')];
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const chosen=index<0?paths:paths.slice(index,index+1);
    chosen.forEach((path,i)=>{
        const length=path.getTotalLength();
        path.style.strokeDasharray=String(length);
        path.style.strokeDashoffset=String(length);
        demoAnimations.push(path.animate([{strokeDashoffset:length},{strokeDashoffset:0}],{
            duration:reduced?1:1150,delay:reduced?0:i*1400,fill:'forwards',easing:'linear'
        }));
    });
}
export function watchOffline(reference){
    let status='離線教材尚未就緒';
    const report=()=>reference.invokeMethodAsync('OfflineChanged',navigator.onLine,navigator.onLine?status:'目前離線 · '+status);
    const stop=window.handwritingOffline?.subscribe(s=>{status=s;report();});
    addEventListener('online',report);addEventListener('offline',report);
    unsubscribe=()=>{stop?.();removeEventListener('online',report);removeEventListener('offline',report)};
    report();
}
export async function retryOffline(){await window.handwritingOffline?.retry?.()}
export function dispose(){detach();stopAudio();stopDemo();unsubscribe?.();unsubscribe=null}

// 必要提示完成後才開放作答；舊元件不能取消新元件的書寫。
export async function requiredCue(index,sources,owner){
    if(owner!==generation)return true;
    locked=true;
    replayDemo(index);
    const animations=Promise.allSettled(demoAnimations.map(a=>a.finished));
    const [ok]=await Promise.all([playSequence(sources),animations]);
    if(owner===generation)locked=false;
    return ok;
}
export function cancelOwner(owner){if(owner===generation)cancel(generation+1);}

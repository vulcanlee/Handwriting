const KEY='little-hands-state-v1';let canvas,ctx,dotnet,generation=0,active=null,points=[],locked=false,audio=null,audioToken=0,unsubscribe=null,resizeObserver=null;
function storage(){try{localStorage.setItem('__hw_test','1');localStorage.removeItem('__hw_test');return true}catch{return false}}
export function loadState(){const available=storage();if(!available)return{progress:{},muted:false,relaxed:true,available:false,malformed:false};try{const value=JSON.parse(localStorage.getItem(KEY)||'{}'),progress=value.progress||{};if(!value||typeof value!=='object'||Array.isArray(value)||typeof progress!=='object'||Array.isArray(progress)||Object.values(progress).some(p=>!p||typeof p!=='object'||Array.isArray(p)||('completed'in p&&typeof p.completed!=='boolean')||('successfulAttempts'in p&&(!Number.isInteger(p.successfulAttempts)||p.successfulAttempts<0||p.successfulAttempts>2147483647))||('lastPracticed'in p&&p.lastPracticed!==null&&(typeof p.lastPracticed!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(p.lastPracticed)||!Number.isFinite(Date.parse(p.lastPracticed))))))throw new Error('invalid state');return{progress,muted:!!value.muted,relaxed:value.relaxed!==false,available:true,malformed:false}}catch{return{progress:{},muted:false,relaxed:true,available:true,malformed:true}}}
export function saveState(value){if(!storage())return false;try{localStorage.setItem(KEY,JSON.stringify({progress:value.progress||{},muted:!!value.muted,relaxed:value.relaxed!==false}));return true}catch{return false}}
function size(){if(!canvas)return;const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx=canvas.getContext('2d');ctx.scale(d,d);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#147d76';ctx.lineWidth=Math.max(7,r.width*.025)}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100,time:e.timeStamp}}
function down(e){if(locked||active!==null||!e.isPrimary||!(e.pointerType==='touch'||e.pointerType==='pen'||e.pointerType==='mouse'))return;active=e.pointerId;points=[point(e)];canvas.setPointerCapture(active);dotnet.invokeMethodAsync('DrawingStarted',generation);e.preventDefault()}
function move(e){if(e.pointerId!==active||locked)return;const p=point(e),last=points.at(-1),r=canvas.getBoundingClientRect();points.push(p);ctx.beginPath();ctx.moveTo(last.x/100*r.width,last.y/100*r.height);ctx.lineTo(p.x/100*r.width,p.y/100*r.height);ctx.stroke();e.preventDefault()}
async function up(e){if(e.pointerId!==active||locked)return;points.push(point(e));active=null;locked=true;const sent=generation;try{await dotnet.invokeMethodAsync('SubmitStroke',points,sent)}finally{if(sent===generation)locked=false}}
function cancelled(e){if(e.pointerId===active){active=null;points=[];clearInk()}}
export function initCanvas(id,reference,gen){detach();canvas=document.getElementById(id);if(!canvas)return;dotnet=reference;generation=gen;locked=false;size();canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancelled);resizeObserver=new ResizeObserver(()=>{active=null;points=[];size()});resizeObserver.observe(canvas)}
function detach(){if(!canvas)return;canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancelled);resizeObserver?.disconnect();canvas=null;ctx=null;active=null;points=[]}
export function clearInk(){if(ctx&&canvas){const d=Math.min(devicePixelRatio||1,2);ctx.clearRect(0,0,canvas.width/d,canvas.height/d)}}
export function cancel(gen){generation=gen;locked=false;detach();stopAudio();stopDemo()}
export async function playAudio(src){stopAudio();const token=audioToken;const current=new Audio(src);audio=current;try{await current.play();return true}catch{if(token!==audioToken)return true;audio=null;return false}}
export async function playSequence(sources){stopAudio();const token=audioToken;try{for(const src of sources){if(token!==audioToken)return true;const current=new Audio(src);audio=current;await current.play();if(token!==audioToken)return true;await new Promise((resolve,reject)=>{current.addEventListener('ended',resolve,{once:true});current.addEventListener('error',reject,{once:true})})}if(token===audioToken)audio=null;return true}catch{if(token!==audioToken)return true;audio=null;return false}}
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

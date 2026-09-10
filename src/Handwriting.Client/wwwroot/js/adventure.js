const KEY='little-hands-state-v2', LEGACY='little-hands-state-v1', LEASE_KEY='little-hands-writer-lease';
const LEASE_MS=6000, LEASE_REFRESH_MS=2000, LEASE_VERIFY_MS=60;
let writer=false, writerMode='none', release=null, leaseToken=null, leaseTimer=null, malformed=false, stopWatch=null;
function readLease(){
    try{const value=JSON.parse(localStorage.getItem(LEASE_KEY)||'null');return object(value)&&typeof value.token==='string'&&Number.isFinite(value.expires)?value:null;}
    catch{return null;}
}
function ownsLease(){return leaseToken!==null&&readLease()?.token===leaseToken;}
function stopLease(){if(leaseTimer!==null)clearInterval(leaseTimer);leaseTimer=null;}
function refreshLease(){
    if(!ownsLease()){writer=false;writerMode='busy';stopLease();return false;}
    try{localStorage.setItem(LEASE_KEY,JSON.stringify({token:leaseToken,expires:Date.now()+LEASE_MS}));return true;}
    catch{writer=false;writerMode='unavailable';stopLease();return false;}
}
async function acquireLease(){
    const current=readLease();
    if(current&&current.expires>Date.now()){writerMode='busy';return false;}
    leaseToken=`${Date.now()}-${Math.random()}`;
    try{localStorage.setItem(LEASE_KEY,JSON.stringify({token:leaseToken,expires:Date.now()+LEASE_MS}));}
    catch{leaseToken=null;writerMode='unavailable';return false;}
    await new Promise(resolve=>setTimeout(resolve,LEASE_VERIFY_MS));
    if(!ownsLease()){leaseToken=null;writerMode='busy';return false;}
    writer=true;writerMode='lease';
    leaseTimer=setInterval(refreshLease,LEASE_REFRESH_MS);
    globalThis.addEventListener?.('pagehide',releaseWriter);
    return true;
}
export async function acquireWriter(){
    if(writer)return true;
    if(!globalThis.navigator?.locks)return acquireLease();
    return new Promise(resolve=>{
        navigator.locks.request('little-hands-writer',{ifAvailable:true},async lock=>{
            if(!lock){writerMode='busy';resolve(false);return;}
            writer=true;writerMode='web-lock';
            await new Promise(done=>{release=done;resolve(true);});
            writer=false;writerMode='none';
        }).catch(async()=>resolve(await acquireLease()));
    });
}
export function getWriterMode(){return writerMode;}
export function releaseWriter(){
    writer=false;
    if(leaseToken!==null){
        try{if(ownsLease())localStorage.removeItem(LEASE_KEY);}catch{}
        leaseToken=null;stopLease();globalThis.removeEventListener?.('pagehide',releaseWriter);
    }
    release?.();release=null;writerMode='none';
}
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const count=x=>Number.isInteger(x)&&x>=0&&x<=2147483647;
function date(x){
    if(x==null)return true;
    if(typeof x!=='string')return false;
    const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,7})?(Z|[+-]\d{2}:\d{2})$/.exec(x);
    if(!m)return false;
    const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number);
    const days=[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
    const offset=m[7]==='Z'?0:Number(m[7].slice(1,3))*60+Number(m[7].slice(4));
    return year>=1&&month>=1&&month<=12&&day>=1&&day<=days[month-1]&&hour<24&&minute<60&&second<60&&offset<=840&&
        (m[7]==='Z'||Number(m[7].slice(4))<60)&&Number.isFinite(Date.parse(x));
}
const progress=x=>object(x)&&Object.values(x).every(p=>object(p)&&
    (p.completed===undefined||typeof p.completed==='boolean')&&
    (p.successfulAttempts===undefined||count(p.successfulAttempts))&&date(p.lastPracticed));
function valid(s){
    return object(s)&&s.version===2&&Array.isArray(s.children)&&
        (s.muted===undefined||typeof s.muted==='boolean')&&(s.relaxed===undefined||typeof s.relaxed==='boolean')&&
        (s.legacyProgress==null||progress(s.legacyProgress))&&
        s.children.every(c=>object(c)&&typeof c.id==='string'&&c.id.length>0&&typeof c.name==='string'&&
            ['numbers','upper','lower','zhuyin'].includes(c.avatar)&&progress(c.progress)&&
            Array.isArray(c.startedCategories)&&c.startedCategories.every(x=>['numbers','upper','lower','zhuyin'].includes(x))&&
            object(c.challenges)&&Object.values(c.challenges).every(x=>object(x)&&count(x.wins)&&Array.isArray(x.completedLengths)&&x.completedLengths.every(n=>[5,10,20].includes(n)))&&
            object(c.awards)&&Object.values(c.awards).every(x=>object(x)&&date(x.earnedAt)&&typeof x.imported==='boolean'))&&
        new Set(s.children.map(c=>c.id)).size===s.children.length&&
        (s.activeChildId==null||s.children.some(c=>c.id===s.activeChildId));
}
export function loadAdventure(){
    const empty={version:2,children:[],activeChildId:null,muted:false,relaxed:true,legacyProgress:null};
    let raw,legacy;
    try{raw=localStorage.getItem(KEY);legacy=localStorage.getItem(LEGACY);}
    catch{return{state:empty,available:false,malformed:false};}
    try{
        if(raw){const state=JSON.parse(raw);if(!valid(state))throw Error('state');return{state,available:true,malformed:false};}
        if(legacy){
            const old=JSON.parse(legacy);
            if(!object(old)||!progress(old.progress??{}))throw Error('legacy');
            empty.legacyProgress=old.progress??{};empty.muted=!!old.muted;empty.relaxed=old.relaxed!==false;
            if(writer){try{if(localStorage.getItem(LEGACY+'-backup')===null)localStorage.setItem(LEGACY+'-backup',legacy);}
                catch{return{state:empty,available:false,malformed:false};}}
        }
        return{state:empty,available:true,malformed:false};
    }catch{malformed=true;return{state:empty,available:true,malformed:true};}
}
export function saveAdventure(state){
    if(writerMode==='lease'&&!ownsLease()){writer=false;writerMode='busy';stopLease();}
    if(!writer||malformed||!valid(state))return false;
    try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{return false;}
}
export function watchVisibility(reference){
    stopWatch?.();
    const handler=()=>{if(document.hidden)reference.invokeMethodAsync('WentToBackground');};
    document.addEventListener('visibilitychange',handler);
    stopWatch=()=>document.removeEventListener('visibilitychange',handler);
    handler();
}
export function dispose(){stopWatch?.();stopWatch=null;releaseWriter();}
export function showDialog(id){const dialog=document.getElementById(id);if(dialog && !dialog.open)dialog.showModal();}

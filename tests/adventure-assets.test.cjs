const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const web='src/Handwriting.Client/wwwroot';
test('all 88 catalog entries have unique SVGs, offline audio and PRD rows',()=>{
 const catalog=JSON.parse(fs.readFileSync(path.join(web,'data/badges.json'),'utf8'));
 const prd=fs.readFileSync('docs/product/動物探險激勵系統PRD.md','utf8');
 assert.equal(catalog.length,88);
 assert.equal(new Set(catalog.map(b=>b.id)).size,88);
 for(const b of catalog){
  const svg=fs.readFileSync(path.join(web,b.image),'utf8');
  assert.ok(svg.startsWith('<svg'),b.id);
  assert.ok(svg.includes(b.name),b.id);
  assert.ok(fs.statSync(path.join(web,b.audio)).size>1000,b.id);
  assert.ok(prd.includes(`| ${b.id} | ${b.name} | ${b.group} | ${b.condition} |`),b.id);
 }
 assert.ok(fs.statSync(path.join(web,'audio/badges/earned.mp3')).size>1000);
});

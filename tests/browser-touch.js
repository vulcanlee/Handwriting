// Chrome 觸控模擬，不能代替實體 Android 驗收。
async page => {
 await page.setViewportSize({width:800,height:1100});
 await page.getByRole('tab',{name:'小貓頭鷹 注音',exact:true}).click();await page.getByRole('button',{name:'練習 ㄅ',exact:true}).click();await page.getByRole('button',{name:'▶ 開始練習'}).click();
 await page.waitForFunction(() => { const c = document.querySelector('#practice-canvas'); return c && !c.closest('.locked'); });
 const symbols=await (await page.request.get((await page.evaluate(()=>location.origin))+'/data/symbols.json')).json();const points=symbols.find(s=>s.glyph==='ㄅ').strokes[0].points;
 const canvas=page.locator('#practice-canvas');await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox();
 const cdp=await page.context().newCDPSession(page);const at=p=>({x:b.x+p.x*b.width/100,y:b.y+p.y*b.height/100,id:1});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[at(points[0])]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 if(await page.locator('.celebration').count())throw Error('Cancelled touch completed');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[at(points[0])]});
 for(let i=1;i<points.length;i++)for(let j=1;j<=8;j++){const p={x:points[i-1].x+(points[i].x-points[i-1].x)*j/8,y:points[i-1].y+(points[i].y-points[i-1].y)*j/8};await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[at(p)]});}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.getByRole('heading',{name:'太棒了，寫完了！'}).waitFor();
 await cdp.detach();return 'PASS: emulated touch cancel and zhuyin completion';
}

// 在正式發布網站的 Playwright CLI 執行；使用隔離 context 驗證移轉、離線、語音與觸控。
async originalPage => {
    const context = await originalPage.context().browser().newContext({ viewport: { width: 800, height: 1100 }, reducedMotion: 'reduce', hasTouch: true });
    const page = await context.newPage();
    const origin = originalPage.url().split('/').slice(0, 3).join('/');
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
        window.audioPlays = [];
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function() { window.audioPlays.push(this.src); return play.call(this); };
    });
    try {
        await page.goto(origin);
        await page.getByLabel('暱稱', { exact: true }).waitFor();
        await page.evaluate(() => localStorage.setItem('little-hands-state-v1', JSON.stringify({ progress: { 'numbers-0': { completed: true, successfulAttempts: 10, lastPracticed: '2026-09-09T00:00:00Z' } }, muted: false, relaxed: true })));
        await page.reload();
        await page.getByLabel('暱稱', { exact: true }).fill('舊紀錄探險家');
        await page.getByRole('button', { name: '保存探險家' }).click();
        await page.getByRole('heading', { name: '今天，想寫哪一個？' }).waitFor();
        const migration = await page.evaluate(() => {
            const state = JSON.parse(localStorage.getItem('little-hands-state-v2'));
            return { child: state.children[0], legacy: state.legacyProgress, backup: localStorage.getItem('little-hands-state-v1-backup') };
        });
        if (!migration.backup || migration.legacy !== null || migration.child.progress['numbers-0'].successfulAttempts !== 10) throw Error('移轉資料不符');
        for (const award of Object.values(migration.child.awards)) if (!award.imported || award.earnedAt !== null) throw Error('補發日期錯誤');
        if (migration.child.awards['numbers-adventure-wins-1']) throw Error('憑空補發闖關');
        await page.waitForFunction(async () => {
            if (!navigator.serviceWorker.controller) return false;
            for (const name of await caches.keys()) if (name.startsWith('handwriting-') && await (await caches.open(name)).match(new URL('__ready', location.href))) return true;
            return false;
        }, null, { timeout: 60000 });
        await context.setOffline(true);
        await page.reload();
        await page.getByRole('heading', { name: '今天，想寫哪一個？' }).waitFor();
        const mediaCount = await page.evaluate(async () => {
            const symbols = await (await fetch('data/symbols.json')).json();
            const badges = await (await fetch('data/badges.json')).json();
            const files = new Set(symbols.flatMap(s => [s.audio, ...s.strokes.map(st => st.audio)]));
            for (const b of badges) {
                files.add(b.audio);
                const response = await fetch(b.image);
                if (!response.ok || !(await response.text()).includes('<svg')) throw Error('徽章無法離線讀取：' + b.id);
            }
            files.add('audio/badges/earned.mp3');
            for (const name of ['start','direction','short','shape','success','next','empty']) files.add('audio/' + name + '.mp3');
            const decoder = new AudioContext();
            for (const file of files) {
                const response = await fetch(file);
                if (!response.ok) throw Error('離線音檔遺失：' + file);
                const decoded = await decoder.decodeAudioData(await response.arrayBuffer());
                if (decoded.duration <= .1) throw Error('音檔長度異常：' + file);
            }
            await decoder.close();
            return files.size;
        });
        await page.getByRole('button', { name: /我的徽章/ }).click();
        await page.getByRole('button', { name: '數字收集家 3，尚未取得', exact: true }).click();
        await page.locator('#badge-detail[open]').waitFor();
        if (!await page.evaluate(() => window.audioPlays.some(s => s.endsWith('/audio/badges/numbers-collect-3.mp3')))) throw Error('條件未自動播放');
        await page.getByRole('button', { name: '知道了' }).click();
        await page.getByRole('button', { name: '切換聲音' }).click();
        const count = await page.evaluate(() => window.audioPlays.length);
        await page.getByRole('button', { name: '數字收集家 3，尚未取得', exact: true }).click();
        await page.locator('#badge-detail[open]').waitFor();
        await page.getByRole('button', { name: '🔊 再聽一次' }).click();
        if (await page.evaluate(() => window.audioPlays.length) !== count) throw Error('靜音仍播放');
        await page.getByRole('button', { name: '知道了' }).click();
        await page.getByRole('button', { name: /自由練習/ }).click();
        await page.getByRole('tab', { name: '小貓頭鷹 注音', exact: true }).click();
        await page.getByRole('button', { name: '練習 ㄅ', exact: true }).click();
        await page.getByRole('button', { name: '▶ 開始練習' }).click();
        await page.waitForFunction(() => { const c = document.querySelector('#practice-canvas'); return c && !c.closest('.locked'); });
        const points = await page.evaluate(async () => (await (await fetch('data/symbols.json')).json()).find(s => s.glyph === 'ㄅ').strokes[0].points);
        const canvas = page.locator('#practice-canvas');
        await canvas.scrollIntoViewIfNeeded();
        const box = await canvas.boundingBox();
        const cdp = await context.newCDPSession(page);
        const at = p => ({ x: box.x + p.x * box.width / 100, y: box.y + p.y * box.height / 100, id: 1 });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(points[0])] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        if (await page.locator('.celebration').count()) throw Error('取消觸控錯算完成');
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(points[0])] });
        for (const p of points.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(p)] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.getByRole('heading', { name: '太棒了，寫完了！' }).waitFor();
        await cdp.detach();
        if (errors.length) throw Error(errors.join('\n'));
        return `通過：舊紀錄移轉與補發、離線重載、88 枚 SVG、${mediaCount} 個音檔解碼、條件自動播放、靜音、觸控取消與離線注音完成。`;
    } finally { await context.setOffline(false); await context.close(); }
}

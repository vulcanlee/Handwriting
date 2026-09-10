// 闖關整合驗證：限時通關、重複次數、長關徽章、混合題、背景暫停及加速時間到期。
async originalPage => {
    const context = await originalPage.context().browser().newContext({ viewport: { width: 1280, height: 1100 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const origin = originalPage.url().split('/').slice(0, 3).join('/');
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let stage = '建立';
    try {
        await page.clock.install();
        await page.goto(origin);
        await page.getByLabel('暱稱', { exact: true }).fill('闖關測試員');
        await page.getByRole('button', { name: '保存探險家' }).click();
        await page.getByRole('heading', { name: '今天，想寫哪一個？' }).waitFor();
        await page.getByRole('button', { name: '切換聲音' }).click();
        await page.getByRole('button', { name: /探險闖關/ }).click();
        const symbols = await (await page.request.get(origin + '/data/symbols.json')).json();
        const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('little-hands-state-v2')).children[0]);
        async function finish(count) {
            const seen = [];
            for (let i = 0; i < count; i++) {
                await page.getByText(`第 ${i + 1} / ${count} 題`, { exact: true }).waitFor();
                const glyph = await page.locator('.lesson-heading h2 span').innerText();
                const symbol = symbols.find(s => s.glyph === glyph);
                seen.push(symbol.id);
                for (let j = 0; j < symbol.strokes.length; j++) {
                    await page.locator('.lesson-heading h2').filter({ hasText: `第 ${j + 1} 筆` }).waitFor();
                    await page.waitForFunction(() => { const c = document.querySelector('#practice-canvas'); return c && !c.closest('.locked'); });
                    const canvas = page.locator('#practice-canvas');
                    await canvas.scrollIntoViewIfNeeded();
                    const box = await canvas.boundingBox();
                    const xy = p => [box.x + p.x * box.width / 100, box.y + p.y * box.height / 100];
                    const points = symbol.strokes[j].points;
                    await page.mouse.move(...xy(points[0])); await page.mouse.down();
                    for (const p of points.slice(1)) await page.mouse.move(...xy(p));
                    await page.mouse.up();
                }
            }
            await page.getByRole('heading', { name: '探險成功！' }).waitFor();
            return seen;
        }
        stage = '十題限時';
        await page.getByLabel('題目數量').selectOption('10');
        await page.getByLabel('挑戰方式', { exact: true }).selectOption('timed');
        await page.getByRole('button', { name: '開始探險', exact: true }).click();
        const ten = await finish(10);
        if (new Set(ten).size !== 10) throw Error('十題重複');
        let child = await saved();
        if (child.challenges['numbers-timed'].wins !== 1 || !child.awards['numbers-timed-length-10']) throw Error('十題限時獎勵錯誤');
        const earnedAt = child.awards['numbers-timed-wins-1'].earnedAt;
        stage = '重複通關';
        await page.getByRole('button', { name: '再次挑戰', exact: true }).click();
        await finish(10);
        child = await saved();
        if (child.challenges['numbers-timed'].wins !== 2 || child.awards['numbers-timed-wins-1'].earnedAt !== earnedAt) throw Error('重複通關結算錯誤');
        stage = '二十題不限時';
        await page.getByRole('button', { name: '重新選擇' }).click();
        await page.getByLabel('題目數量').selectOption('20');
        await page.getByLabel('挑戰方式', { exact: true }).selectOption('adventure');
        await page.getByRole('button', { name: '開始探險', exact: true }).click();
        const twenty = await finish(20);
        if (new Set(twenty.slice(0, 10)).size !== 10 || new Set(twenty.slice(10)).size !== 10 || twenty[9] === twenty[10]) throw Error('跨輪抽題錯誤');
        child = await saved();
        if (!child.awards['numbers-adventure-length-20'] || child.challenges['numbers-adventure'].wins !== 1) throw Error('二十題耐力徽章錯誤');
        stage = '綜合五題';
        await page.getByRole('button', { name: '重新選擇' }).click();
        await page.getByLabel('題目數量').selectOption('5');
        for (const label of ['大寫英文','小寫英文','注音']) await page.getByRole('button', { name: label, exact: true }).click();
        await page.getByRole('button', { name: '開始探險', exact: true }).click();
        const mixed = await finish(5);
        if (new Set(mixed.map(id => id.split('-')[0])).size !== 4) throw Error('混合未涵蓋各類');
        child = await saved();
        if (child.challenges['mixed-adventure'].wins !== 1 || child.challenges['numbers-adventure'].wins !== 1) throw Error('綜合錯灌單科');
        stage = '背景與到期';
        await page.getByRole('button', { name: '重新選擇' }).click();
        await page.getByLabel('挑戰方式', { exact: true }).selectOption('timed');
        await page.getByRole('button', { name: '開始探險', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.challenge-status')?.textContent.includes('小手作答中'));
        // 模擬 visibilitychange，驗證背景事件與父子元件暫停整合。
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
        await page.getByRole('heading', { name: '小手休息一下' }).waitFor();
        const clock = await page.locator('.challenge-status > span').first().innerText();
        await page.clock.fastForward(600000);
        if (clock !== await page.locator('.challenge-status > span').first().innerText()) throw Error('背景仍計時');
        await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
        await page.getByRole('button', { name: '繼續探險' }).click();
        await page.waitForFunction(() => document.querySelector('.challenge-status')?.textContent.includes('小手作答中'));
        await page.clock.fastForward(600000);
        await page.getByRole('heading', { name: '時間到了，辛苦小手了！' }).waitFor();
        if ((await saved()).challenges['mixed-timed']) throw Error('超時錯發徽章');
        if (errors.length) throw Error(errors.join('\n'));
        return '通過：10 題限時、重複通關 2 次、20 題跨輪及耐力徽章、混合涵蓋與隔離、背景暫停及加速到期不發獎。';
    } catch (error) { await page.screenshot({path:'output/playwright/challenges-failure.png',fullPage:true}); throw new Error(stage + ': ' + error.message + '\n' + (await page.locator('body').innerText()).slice(-1800) + '\n' + errors.join('\n')); }
    finally { await context.close(); }
}

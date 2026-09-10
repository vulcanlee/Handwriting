// npx --package @playwright/cli playwright-cli -s=adventure run-code --filename=tests/browser-adventure.js
// 使用隔離瀏覽器 context，不修改目前開啟分頁的孩子資料。
async originalPage => {
    const context = await originalPage.context().browser().newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const origin = originalPage.url().split('/').slice(0, 3).join('/');
    let stage = '建立孩子';
    try {
        await page.goto(origin);
        await page.getByLabel('暱稱', { exact: true }).fill('小兔測試員');
        await page.getByRole('button', { name: '保存探險家' }).click();
        await page.getByRole('heading', { name: '今天，想寫哪一個？' }).waitFor();
        await page.getByRole('button', { name: '切換聲音' }).click();
        const symbols = await (await page.request.get(origin + '/data/symbols.json')).json();
        const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('little-hands-state-v2')));
        const trace = async points => {
            await page.waitForFunction(() => { const c = document.querySelector('#practice-canvas'); return c && !c.closest('.locked'); });
            const canvas = page.locator('#practice-canvas');
            await canvas.scrollIntoViewIfNeeded();
            const box = await canvas.boundingBox();
            const xy = p => [box.x + p.x * box.width / 100, box.y + p.y * box.height / 100];
            await page.mouse.move(...xy(points[0])); await page.mouse.down();
            for (const p of points.slice(1)) await page.mouse.move(...xy(p));
            await page.mouse.up();
        };
        stage = '自由書寫';
        await page.getByRole('button', { name: '練習 0', exact: true }).click();
        await page.getByRole('button', { name: '▶ 開始練習' }).click();
        await trace(symbols.find(s => s.id === 'numbers-0').strokes[0].points);
        await page.getByRole('heading', { name: '太棒了，寫完了！' }).waitFor();
        let state = await saved();
        if (state.children[0].progress['numbers-0'].successfulAttempts !== 1 || !state.children[0].awards['numbers-start-1']) throw Error('自由練習結算失敗');

        stage = '徽章牆';
        await page.getByRole('button', { name: /我的徽章/ }).click();
        if (await page.locator('.badge-tile').count() !== 88) throw Error('不是 88 枚徽章');
        await page.getByLabel('篩選成就分類').selectOption('勇敢開始');
        if (await page.locator('.badge-tile').count() !== 4) throw Error('分類篩選錯誤');
        await page.getByLabel('篩選徽章題型').selectOption('numbers');
        if (await page.locator('.badge-tile').count() !== 1) throw Error('題型篩選錯誤');
        await page.getByLabel('篩選成就分類').selectOption('');
        await page.getByLabel('篩選徽章題型').selectOption('');
        await page.getByRole('button', { name: '數字收集家 3，尚未取得', exact: true }).click();
        await page.locator('#badge-detail[open]').waitFor();
        if (!(await page.locator('#badge-detail').innerText()).includes('進度 1 / 3')) throw Error('徽章進度錯誤');
        await page.getByRole('button', { name: '知道了' }).click();
        await page.screenshot({ path: 'output/playwright/badge-wall-desktop.png', fullPage: true });

        stage = '五題闖關';
        await page.getByRole('button', { name: /探險闖關/ }).click();
        await page.getByRole('button', { name: '開始探險', exact: true }).click();
        for (let i = 0; i < 5; i++) {
            await page.getByText(`第 ${i + 1} / 5 題`, { exact: true }).waitFor();
            const glyph = await page.locator('.lesson-heading h2 span').innerText();
            const symbol = symbols.find(s => s.category === 'numbers' && s.glyph === glyph);
            for (let j = 0; j < symbol.strokes.length; j++) {
                if (j > 0) await page.locator('.lesson-heading h2').filter({ hasText: `第 ${j + 1} 筆` }).waitFor();
                await trace(symbol.strokes[j].points);
            }
        }
        await page.getByRole('heading', { name: '探險成功！' }).waitFor();
        state = await saved();
        if (state.children[0].challenges['numbers-adventure'].wins !== 1) throw Error('通關次數錯誤');
        await page.screenshot({ path: 'output/playwright/challenge-result.png', fullPage: true });

        stage = '限時暫停';
        await page.getByRole('button', { name: '重新選擇' }).click();
        await page.getByLabel('挑戰方式', { exact: true }).selectOption('timed');
        await page.getByRole('button', { name: '開始探險', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.challenge-status')?.textContent.includes('小手作答中'));
        await page.getByRole('button', { name: '暫停', exact: true }).click();
        await page.getByRole('heading', { name: '小手休息一下' }).waitFor();
        const clock = await page.locator('.challenge-status > span').first().innerText();
        await page.waitForTimeout(1200);
        if (clock !== await page.locator('.challenge-status > span').first().innerText()) throw Error('暫停仍計時');
        if (await page.locator('#practice-canvas').isVisible()) throw Error('暫停未遮題');
        await page.getByRole('button', { name: '繼續探險' }).click();
        await page.waitForFunction(() => document.querySelector('.challenge-status')?.textContent.includes('小手作答中'));
        await page.getByRole('button', { name: '結束探險' }).click();
        if ((await saved()).children[0].challenges['numbers-timed']) throw Error('中止錯發通關');

        await page.getByRole('button', { name: '＋ 新增孩子' }).click();
        await page.getByLabel('暱稱', { exact: true }).fill('狐狸測試員');
        await page.getByRole('button', { name: '小狐狸', exact: true }).click();
        await page.getByRole('button', { name: '保存探險家' }).click();
        await page.getByRole('button', { name: /我的徽章/ }).click();
        if (await page.locator('.badge-tile.earned').count() !== 0) throw Error('孩子成果混用');
        await page.getByRole('button', { name: '編輯', exact: true }).click();
        await page.getByLabel('暱稱', { exact: true }).fill('狐狸的新名字');
        await page.getByRole('button', { name: '小貓頭鷹', exact: true }).click();
        await page.getByRole('button', { name: '保存探險家' }).click();
        const edited = (await saved()).children[1];
        if (edited.name !== '狐狸的新名字' || edited.avatar !== 'zhuyin') throw Error('編輯未保存');
        state = await saved();
        await page.getByLabel('切換孩子').selectOption(state.children[0].id);
        if (await page.locator('.badge-tile.earned').count() === 0) throw Error('切換孩子未恢復成果');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: 'output/playwright/badge-wall-mobile.png', fullPage: true });
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('手機畫面水平溢出');

        const second = await context.newPage();
        await second.goto(origin);
        await second.getByRole('heading', { name: '先讓另一個小手完成練習' }).waitFor();
        if (await second.locator('#practice-canvas').count()) throw Error('第二頁可寫入');
        await second.close();
        await page.reload();
        await page.getByRole('heading', { name: '今天，想寫哪一個？' }).waitFor();
        if ((await saved()).children.length !== 2) throw Error('重載遺失孩子');
        if (errors.length) throw Error(errors.join('\n'));
        return '通過：建立、自由書寫、88 枚徽章、進度、5 題通關、暫停遮題、中止、孩子隔離、手機排版、雙分頁寫入鎖及重載。';
    } catch (error) { await page.screenshot({path:'output/playwright/adventure-failure.png',fullPage:true}); throw new Error(stage + ': ' + error.message + '\n' + (await page.locator('body').innerText()).slice(-2400) + '\n' + errors.join('\n')); } finally { await context.close(); }
}

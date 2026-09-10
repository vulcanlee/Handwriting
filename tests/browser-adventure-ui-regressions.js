// 防止限時選項被當成 checkbox 布林繫結，以及初次落筆通知推移畫布。
async originalPage => {
    const context = await originalPage.context().browser().newContext({ viewport: { width: 1280, height: 1100 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
        await page.goto(originalPage.url());
        await page.getByLabel('暱稱', { exact: true }).fill('畫布位置測試');
        await page.getByRole('button', { name: '保存探險家' }).click();
        await page.getByRole('heading', { name: '今天，想寫哪一個？' }).waitFor();
        await page.getByRole('button', { name: '切換聲音' }).click();
        await page.getByRole('button', { name: /探險闖關/ }).click();
        await page.getByLabel('挑戰方式', { exact: true }).selectOption({ label: '限時挑戰' });
        await page.getByRole('button', { name: '開始探險', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.challenge-status')?.textContent.includes('小手作答中'));
        const timed = (await page.locator('.challenge-status').innerText()).includes('剩餘');
        const canvas = page.locator('#practice-canvas');
        await canvas.scrollIntoViewIfNeeded();
        const before = await canvas.boundingBox();
        await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(200);
        const after = await canvas.boundingBox();
        await page.mouse.up();
        if (!timed || Math.abs(before.y - after.y) > 1) throw Error(JSON.stringify({ timed, canvasMovedBy: after.y - before.y }));
        return '通過：限時選項實際啟動倒數；首次落筆發獎不推移畫布。';
    } finally { await context.close(); }
}

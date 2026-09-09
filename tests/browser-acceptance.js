// 在已開啟正式發布網站的 Playwright CLI 專用分頁執行。
// npx --package @playwright/cli playwright-cli run-code --filename=tests/browser-acceptance.js
async page => {
    const origin = await page.evaluate(() => location.origin);
    const symbols = await (await page.request.get(origin + '/data/symbols.json')).json();
    await page.getByRole('heading', { name: '今天，想寫哪一個？' }).waitFor();
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('little-hands-state-v1') || '{}'));
    const trace = async points => {
        const canvas = page.locator('#practice-canvas');
        await canvas.scrollIntoViewIfNeeded();
        const bounds = await canvas.boundingBox();
        const xy = p => [bounds.x + p.x * bounds.width / 100, bounds.y + p.y * bounds.height / 100];
        await page.mouse.move(...xy(points[0]));
        await page.mouse.down();
        for (const p of points.slice(1)) await page.mouse.move(...xy(p));
        await page.mouse.up();
    };
    await page.getByRole('tab', { name: '123 數字', exact: true }).click();
    await page.getByRole('button', { name: '練習 0', exact: true }).click();
    await page.getByRole('button', { name: '▶ 開始練習' }).click();
    await trace(symbols.find(s => s.id === 'numbers-0').strokes[0].points);
    await page.getByRole('heading', { name: '太棒了，寫完了！' }).waitFor();

    await page.getByRole('tab', { name: 'ABC 大寫', exact: true }).click();
    await page.getByRole('button', { name: '練習 A', exact: true }).click();
    await page.getByRole('button', { name: '▶ 開始練習' }).click();
    const a = symbols.find(s => s.id === 'upper-A');
    await trace(a.strokes[0].points);
    await page.getByRole('heading', { level: 2 }).filter({ hasText: '第 2 筆' }).waitFor();
    await trace([...a.strokes[1].points].reverse());
    await page.getByText('方向反囉，從橘色圓點開始。', { exact: true }).waitFor();
    if (await page.locator('.trace-stroke.accepted').count() !== 1) throw Error('重試遺失已成功筆畫');
    await trace(a.strokes[1].points);
    await page.getByRole('heading', { name: '太棒了，寫完了！' }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: '今天，想寫哪一個？' }).waitFor();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('little-hands-state-v1')));
    for (const id of ['numbers-0', 'upper-A']) {
        if (saved.progress[id].successfulAttempts !== (before.progress?.[id]?.successfulAttempts || 0) + 1)
            throw Error('整字計數或重載保存失敗：' + id);
    }
    return '通過：完整描寫、反向拒絕、保留成功筆畫、重試完成及重載保存。';
}

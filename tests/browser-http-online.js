// 在已啟動的網站執行；關閉 Web Locks 以模擬一般 HTTP，驗證租約與畫面流程。
async originalPage => {
    const source = await originalPage.evaluate(() => ({ secure: window.isSecureContext, hasLocks: !!navigator.locks }));
    if (!source.secure) {
        if (source.hasLocks) throw Error('一般 HTTP 不應提供 Web Locks');
        await originalPage.getByText('HTTP 線上模式 · 離線功能需 HTTPS 或 localhost', { exact: true }).waitFor();
    }
    const context = await originalPage.context().browser().newContext({ viewport: { width: 1100, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'locks', { configurable: true, get: () => undefined }));
    const first = await context.newPage();
    const second = await context.newPage();
    const origin = originalPage.url().split('/').slice(0, 3).join('/');
    try {
        await first.goto(origin);
        await first.getByLabel('暱稱', { exact: true }).fill('HTTP 測試');
        await first.getByRole('button', { name: '保存探險家' }).click();
        await first.getByRole('heading', { name: '今天，想寫哪一個？' }).waitFor();

        await second.goto(origin);
        await second.getByRole('heading', { name: '先讓另一個小手完成練習' }).waitFor();
        if (!await second.getByText('另一個分頁正在使用', { exact: false }).count()) throw Error('第二分頁沒有顯示占用訊息');

        await first.close();
        await second.reload();
        await second.getByRole('heading', { name: '今天，想寫哪一個？' }).waitFor();
        const state = await second.evaluate(() => JSON.parse(localStorage.getItem('little-hands-state-v2')));
        if (state.children[0].name !== 'HTTP 測試') throw Error('重新取得租約後未讀到已保存的孩子');
        return `通過：${source.secure ? '模擬' : '非安全來源'} HTTP 第一分頁可保存、第二分頁被阻擋、關閉第一頁後可接手既有成果。`;
    } finally { await context.close(); }
}

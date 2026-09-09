// 在 Playwright CLI 已開啟的正式發布網站執行；結束會恢復網路。
async page => {
    await page.waitForFunction(async () => {
        const names = (await caches.keys()).filter(name => name.startsWith('handwriting-'));
        for (const name of names) if (await (await caches.open(name)).match(new URL('__ready', location.href))) return !!navigator.serviceWorker.controller;
        return false;
    }, { timeout: 60000 });
    await page.context().setOffline(true);
    try {
        await page.reload();
        await page.getByRole('heading', { name: '今天，想寫哪一個？' }).waitFor();
        const count = await page.evaluate(async () => {
            const symbols = await (await fetch('data/symbols.json')).json();
            const files = new Set(symbols.flatMap(s => [s.audio, ...s.strokes.map(st => st.audio)]));
            for (const name of ['start', 'direction', 'short', 'shape', 'success', 'next', 'empty']) files.add('audio/' + name + '.mp3');
            const decoder = new AudioContext();
            for (const file of files) {
                const response = await fetch(file);
                if (!response.ok) throw Error('離線音檔無法取得：' + file);
                const audio = await decoder.decodeAudioData(await response.arrayBuffer());
                if (audio.duration <= .1) throw Error('音檔內容異常：' + file);
            }
            await decoder.close();
            return files.size;
        });
        await page.getByRole('tab', { name: 'ㄅㄆㄇ 注音', exact: true }).click();
        await page.getByRole('button', { name: '練習 ㄅ', exact: true }).click();
        await page.getByRole('button', { name: '▶ 開始練習' }).click();
        await page.locator('#practice-canvas').waitFor();
        const played = await page.evaluate(async () => {
            const audio = new Audio('audio/zhuyin-1.wav');
            await audio.play(); audio.pause(); return true;
        });
        if (!played) throw Error('離線播放失敗');
        return `通過：斷網重新載入、注音練習頁、${count} 個音檔解碼與實際離線播放。`;
    } finally { await page.context().setOffline(false); }
}

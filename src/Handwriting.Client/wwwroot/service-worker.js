// In development, always fetch from the network and do not enable offline support.
// This is because caching would make development more difficult (changes would not
// be reflected on the first load after each change).
self.addEventListener('fetch', () => { });
// 開發模式不啟用快取；請以正式發布版本驗證離線。
self.addEventListener('message', event => {
    if (event.data?.type === 'status') event.source?.postMessage({type:'offline-status', status:'開發模式：離線功能請使用發布版本'});
});

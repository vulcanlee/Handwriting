# 驗收清單

## 自動驗證

- 執行 `dotnet test Handwriting.slnx`：方向、短筆畫、閉合旋向、重試、重設、整字計數與真實教材。
- 執行 `node --test tests/offline.test.cjs tests/practice-audio.test.cjs tests/practice-storage.test.cjs`：音檔快取、全部完成標記與下載中斷。
- 執行 `python scripts/Test-Curriculum.py`：99 個符號、174 筆、所有音檔存在、WAV 可解碼。
- 執行 `pwsh -File scripts/Test-DocsEncoding.ps1`：BOM、嚴格 UTF-8、CRLF。
- 執行 `dotnet publish src/Handwriting.Server -c Release -o artifacts/publish`。

## 瀏覽器與 Android 實機

以下是交付驗收步驟，未勾選項目不代表已驗證。

- [ ] 實體 Android Chrome：手指從圓點沿線描寫，正常抖動仍可完成。
- [ ] 故意反向、缺段、塗鴉，收到一致的文字與語音，前面成功筆畫保留。
- [ ] 多指、取消、拖出格子、旋轉平板時無殘留筆畫；書寫區外可捲動。
- [ ] 完成一次只增加一次整字練習次數，重播不增加；重練後可再增加。
- [ ] 開關語音、反覆切題及重播不重疊；全部 73 種符號讀音與提示經人工聽辨。
- [ ] 正式版本初次下載後斷網，關閉再開可練習所有分類並播放音檔。
- [ ] 初次下載中斷不可標為可離線，重新連網按檢查可恢復。
- [ ] 新版本在練習中不強制重載，關閉全部分頁後套用完整新版本。
- [ ] 無法保存 localStorage 時仍能練習，畫面明確提示。

自動軌跡與桌面觸控模擬不能取代孩子在實體平板的手感測試。人工聽辨與實體 Android 驗收目前待執行。

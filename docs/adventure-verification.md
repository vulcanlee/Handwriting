# 0.1.2 動物探險驗收結果

日期：2026-09-10。驗證平台：Windows、.NET 10.0.401、Playwright Chromium。實作分支：codex/animal-adventure；未自動 commit、未部署外部服務。

## 自動化結果

| 驗證 | 結果 |
|---|---|
| `dotnet test Handwriting.slnx --no-restore` | 通過 26 項核心測試 |
| Node 六組測試 | 通過 14 項 |
| `python scripts/Test-Curriculum.py` | 99 符號、174 筆與音檔檢查通過 |
| Release publish | 成功，發布至 artifacts/release |
| 文件編碼 | 通過 UTF-8 BOM、CRLF 檢查（交付文件共 17 份） |

Node 命令：

```powershell
node --test tests/adventure-assets.test.cjs tests/adventure-cue.test.cjs tests/adventure-storage.test.cjs tests/practice-audio.test.cjs tests/practice-storage.test.cjs tests/offline.test.cjs
```

## 需求與案例對照

| PRD | 驗證案例與證據 |
|---|---|
| 01、10 | AdventureTests、adventure-storage：孩子獨立、舊資料備份與一次移轉、補發日期留空、損毀資料不覆寫、保存失敗；瀏覽器驗證建立、編輯、切換、重載及第二分頁禁止寫入 |
| 02、04 | browser-adventure：三入口、88 枚牆面、灰色條件對話框、進度 1／3、成就分類／題型篩選、手機 390px 不溢出 |
| 03、09 | AdventureTests：88 唯一 ID、每枚門檻前後、重練與不同符號差異、模式隔離與單次結算；素材檢查確認 88 SVG／條件音檔／PRD 表格一致 |
| 05、06 | 核心 100 個隨機種子驗證覆蓋與跨輪不連續重複；瀏覽器實際完成 5／10／20 題、10 題限時重複通關 2 次、耐力徽章與混合題型隔離 |
| 07、08 | 核心驗證提示／暫停不耗時、截止瞬間拒絕、截止前可通過與中止不發獎；瀏覽器驗證暫停遮題、中止、背景事件暫停與加速到期不發獎 |
| 11 | browser-adventure-offline：舊紀錄移轉、離線重載、88 SVG 與 173 音檔解碼、灰色徽章自動播放、靜音及觸控取消／離線注音完成 |

## 瀏覽器重現命令

先啟動正式發布網站，再用 Playwright CLI 開啟 localhost 網址；測試使用獨立 context，不修改原分頁的孩子紀錄。

```powershell
dotnet artifacts/release/Handwriting.Server.dll --contentRoot "$PWD/artifacts/release" --urls http://localhost:5084
npx --package @playwright/cli playwright-cli -s=adventureqa open http://localhost:5084
npx --package @playwright/cli playwright-cli -s=adventureqa run-code --filename=tests/browser-adventure.js
npx --package @playwright/cli playwright-cli -s=adventureqa run-code --filename=tests/browser-adventure-offline.js
npx --package @playwright/cli playwright-cli -s=adventureqa run-code --filename=tests/browser-adventure-ui-regressions.js
npx --package @playwright/cli playwright-cli -s=adventureqa run-code --filename=tests/browser-adventure-challenges.js
```

截圖在 output/playwright，屬本機驗收產物，不納入版控。瀏覽器測試採減少動態效果；背景事件與時間加速測試屬自動化模擬，不能取代作業系統切換實測。

## 修正與回歸證據

- 動態 RunKey 取代固定字串，修正換題仍停留在前題完成畫面。
- 限時模式採字串選項明確轉換，回歸確認實際出現倒數。
- 初次落筆立即保存徽章，但延後顯示通知，回歸確認畫布位移為零。
- 曆法驗證及 C# 例外保護，防止 JavaScript 正規化不存在日期而使 .NET 載入失敗。

## 待人工驗收

- 實體 Android 平板手指書寫、橫直向切換及背景／鎖屏恢復。
- 4–6 歲孩子試玩，校準每題 15 秒加每筆 15 秒的初始時間。
- 新增 89 份語音完整人工聽辨；音檔解碼成功不代表發音、語意與語速已人工驗收。

## 已知產品限制

資料只存本機，清除網站資料會失去紀錄。需要支援 Web Locks 的 HTTPS／localhost 瀏覽器；不支援時顯示說明並停止練習。重整／離開會中止該場，不恢復未完成闖關；已完成符號仍保留。沒有帳號、跨裝置同步、刪除孩子或外部遙測。

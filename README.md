# 小手寫寫

給 4–6 歲小朋友的繁體中文手寫練習網站。以 .NET 10、ASP.NET Core 與 Blazor WebAssembly PWA 開發，提供數字、英文大小寫、注音共 99 個符號、174 筆軌跡。版本：0.1.3。

## 啟動

安裝 .NET 10 SDK 後，在 repo 根目錄執行：

```powershell
dotnet restore Handwriting.slnx
dotnet run --project src/Handwriting.Server --urls http://localhost:5080
```

瀏覽 http://localhost:5080 。開發模式不快取教材，離線驗證須使用下列正式發布版本。

```powershell
dotnet publish src/Handwriting.Server -c Release -o artifacts/publish
dotnet artifacts/publish/Handwriting.Server.dll --contentRoot "$PWD/artifacts/publish" --urls http://localhost:5080
```

## IIS 部署

Windows Server 與 Windows 11 的 IIS 設定、CLI／Visual Studio 2026 Folder Publish、HTTPS、更新與回復流程，請依 [Windows IIS 部署 SOP](docs/operations/Windows-IIS部署SOP.md) 操作。

## 使用方式

選分類與符號，按「開始練習」，看示範、聽讀音，從圓點沿線描寫。放開手指後檢查，失敗只重畫該筆。完成後可重練或前往下一個。進度只存在同一瀏覽器，不上傳筆跡；清除網站資料會移除紀錄。

HTTP 網址可在線練習並將成果保存在目前瀏覽器，但瀏覽器不允許一般 HTTP 使用 Service Worker，因此不能離線開啟。HTTPS 或 localhost 第一次連網下載完全部教材，顯示「已可離線使用」後才可斷網。新版下載完需關閉本網站所有分頁再開啟；不在練習中強制更新。瀏覽器可能回收離線儲存，回收後需要重新連網下載。

## 驗證

```powershell
dotnet test Handwriting.slnx
node --test tests/offline.test.cjs tests/practice-audio.test.cjs tests/practice-storage.test.cjs
python scripts/Test-Curriculum.py
pwsh -File scripts/Test-DocsEncoding.ps1
```

詳見 [文件索引](docs/README.md)、[驗收清單](docs/acceptance.md) 與 [教材來源](docs/materials.md)。實體 Android 觸控與全部讀音的人工聽辨仍需實機驗收；程式測試不能代替這兩項。

## 專案

- `src/Handwriting.Server`：ASP.NET Core 靜態網站主機。
- `src/Handwriting.Client`：Blazor 練習畫面、觸控、音訊、離線快取。
- `src/Handwriting.Core`：不依賴瀏覽器的逐筆判定與練習狀態。
- `tests`：核心回歸測試及離線快取測試。

第一版無帳號、雲端同步、聲調、單字、自然發音課程、關卡鎖定或每日排課。不自動 commit，未部署到外部服務。

## 動物探險激勵系統

支援同一瀏覽器建立多位孩子的獨立背包、88 枚分類徽章及不限時／限時闖關。點灰色徽章可看進度並聽取得條件；通關累積次數與里程碑，完整寫完的符號都計入學習成果。

開始使用請看 [動物探險使用指南](docs/guides/動物探險使用指南.md)；完整需求與徽章條件見 [PRD](docs/product/動物探險激勵系統PRD.md)，資料與計時設計見 [技術設計](docs/architecture/動物探險激勵系統技術設計.md)。成果只存在本機；同時僅一個分頁可練習。HTTPS／localhost 使用 Web Locks，一般 HTTP 使用本機租約鎖。

新增測試：`node --test tests/adventure-storage.test.cjs tests/adventure-cue.test.cjs tests/adventure-assets.test.cjs`。動物探險交付驗證見 [0.1.2 驗收結果](docs/adventure-verification.md)，HTTP 線上模式變更見 [0.1.3 版本紀錄](docs/changelog/2026-09-10-HTTP線上模式.md)。

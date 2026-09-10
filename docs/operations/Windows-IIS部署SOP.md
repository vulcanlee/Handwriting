# Windows IIS 部署 SOP：CLI 與 Visual Studio 2026

本文件適用於小手寫寫 0.1.3，以 Windows Server 2022／2025、IIS 10、64 位元及獨立網站為範例；Windows 11 適合區網驗收。兩種發布方式都必須發布 **Handwriting.Server 專案的完整產物**，再複製到 IIS，不能只部署 Client 的 wwwroot。

本文件已依專案程式與既有 Release 產物核對。以下 IIS 設定、Visual Studio 2026 圖形介面與 Android 實機步驟仍需在目標環境驗證，並非已完成的部署紀錄。本文不需要 Web Deploy，也不包含自動部署或零停機架構。

## 1. 準備與命名

| 項目 | 範例與要求 |
|---|---|
| 開發電腦 | .NET 10 SDK；VS 路線另需 Visual Studio 2026 與「ASP.NET 與網頁程式開發」工作負載 |
| IIS 伺服器 | IIS 10、.NET 10 Hosting Bundle、系統管理員權限；只執行網站不需 SDK |
| 網站／集區名稱 | Handwriting；使用專用集區 |
| 網址 | https://write.example.com/；只需線上使用時也可用 http://伺服器IP:連接埠/ |
| 版本目錄 | C:\Sites\Handwriting\releases\0.1.3；每次交付使用新的目錄 |
| 診斷目錄 | C:\Sites\Handwriting\logs；平常不開啟 stdout 記錄 |
| 傳輸與存取 | 可將完整發布資料夾安全複製到伺服器；用戶端可連 HTTPS 443 或設定的 HTTP 連接埠 |

需要 PWA 安裝或離線使用時，正式主機需具備對應網域的有效 HTTPS 憑證及完整信任鏈；DNS 應指向 IIS 主機。只需保持連線使用時可建立 HTTP Binding，程式會啟用 HTTP 線上模式。本文用 Framework-dependent、Portable 發布，執行時依賴伺服器安裝的 .NET 10 與 ASP.NET Core Runtime。Hosting Bundle 同時提供 IIS 所需的 ASP.NET Core Module，僅安裝一般 Runtime 不足以完成 IIS 託管。

先安裝 IIS，再安裝最新版 .NET 10 Hosting Bundle。若先裝 Bundle 才啟用 IIS，重新執行 Bundle 的 Repair；依安裝提示重新啟動主機或 IIS 服務，安排維護時段，避免影響其他站台。套件請從 [Microsoft .NET 10 下載頁](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) 的 ASP.NET Core Runtime／Hosting Bundle 取得。安裝關係可參考 [Hosting Bundle 說明](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/iis/hosting-bundle?view=aspnetcore-10.0)。

### 1.1 Windows Server 啟用 IIS

開啟 Server Manager → Add Roles and Features → Role-based or feature-based installation → 選目標伺服器 → Web Server (IIS)，包含 Management Tools。角色服務保留基本 HTTP 功能，確認 Static Content、HTTP Errors、HTTP Logging、Request Filtering 與 IIS Management Console。此 ASP.NET Core 應用不要求啟用傳統 ASP.NET 4.x；HTTP Redirection 僅供第 5 節的可選轉址站使用。

### 1.2 Windows 11 區網驗收差異

在「開啟或關閉 Windows 功能」啟用 Internet Information Services → Web Management Tools → IIS Management Console，以及 World Wide Web Services 下的 Common HTTP Features（含 Static Content、HTTP Errors）、Health and Diagnostics 的 HTTP Logging、Security 的 Request Filtering；需要轉址時再加 HTTP Redirection。接著安裝 Hosting Bundle。

平板與電腦須可互通；訪客 Wi-Fi 的用戶端隔離可能阻擋連線。區網 DNS 要將正式測試主機名稱解析到電腦的區網 IP；修改電腦 hosts 檔不會改變平板的 DNS。建議使用自己網域與受信任憑證；使用內部 CA 時需在 Android 安裝並確認其信任鏈。憑證的 SAN 必須包含連線名稱，不可忽略憑證警告當作通過。

在 Windows Defender 防火牆「具有進階安全性」新增輸入規則：HTTPS 使用 TCP 443；HTTP 線上模式開放網站 Binding 所用連接埠，例如 80 或 88。限制必要的來源網段及適用網路設定檔，不要關閉整個防火牆。IIS Express、localhost 開發憑證及電腦本機的信任不會自動提供給 Android。

## 2. 方法 A：CLI Publish

在開發電腦的 PowerShell 進入 repo 根目錄。先確認 `dotnet --list-sdks` 有 10.0 SDK，再執行：

```powershell
Set-Location C:\Vulcan\Github\Handwriting
dotnet restore Handwriting.slnx
dotnet test Handwriting.slnx --no-restore
```

每個命令成功後才繼續；出現非零結束碼或失敗測試應先修正。基本發布命令如下，**僅適用 artifacts/publish 尚不存在，或已另行移走舊內容時**：

```powershell
dotnet publish src/Handwriting.Server/Handwriting.Server.csproj `
  -c Release -f net10.0 --self-contained false `
  -o artifacts/publish
```

`-c Release` 選正式組態；`-f net10.0` 指定框架；`--self-contained false` 不附帶 Runtime；未指定 RID，採 Portable；`-o` 指定完整發布輸出位置。此命令會包含相依 Client 產物，詳見 [dotnet publish 參考](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-publish)。

重複發布建議改用唯一目錄，不直接清空既有或運行中的網站：

```powershell
$publishPath = Join-Path $PWD ('artifacts\publish-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
if (Test-Path -LiteralPath $publishPath) { throw '發布目錄已存在，請改用新目錄。' }
dotnet publish src/Handwriting.Server/Handwriting.Server.csproj `
  -c Release -f net10.0 --self-contained false -o $publishPath
if ($LASTEXITCODE -ne 0) { throw '發布失敗，請勿部署。' }
$publishPath
```

不要把發布失敗的半成品交付。應用程式的新交付建置版本依 [維護規範](維護規範.md) 管理；單純依本文部署既有 0.1.1 產物不任意改版本或教材。

## 3. 方法 B：Visual Studio 2026 IDE Publish

以下以英文介面標籤附中文說明；不同語系或更新版可能稍有位置差異。先在 Visual Studio Installer 選 Visual Studio 2026 → Modify，確認已安裝 **ASP.NET and web development（ASP.NET 與網頁程式開發）**，並在安裝詳細資料或 Individual components 確認 .NET 10 SDK。

1. 使用 Open a project or solution 開啟 `Handwriting.slnx`，等待相依套件還原完成。
2. 在 Test Explorer 執行測試並確認通過；亦可在終端機使用第 2 節的測試命令。
3. 在 Solution Explorer 對 **Handwriting.Server** 按右鍵 → **Publish**；不要選 Client 或整個方案。
4. 第一次建立設定檔時，在 Publish 對話框選 **Folder** → Next；若出現 Specific target 再選 **Folder**，輸入新的空白輸出目錄，例如 `C:\Deploy\Handwriting\publish-0.1.1-20260909`，按 Finish。
5. 在 Publish 頁面的 **Show all settings／Settings** 開啟設定，確認以下值後儲存。
6. 按 **Publish**，查看 View → Output，選取發布相關輸出；確認顯示成功且沒有錯誤，再執行第 4 節檢查。

| 設定 | 指定值 |
|---|---|
| Configuration | Release |
| Target framework | net10.0 |
| Deployment mode | Framework-dependent |
| Target runtime | Portable |
| Target location | 本次專用的全新輸出目錄 |

如果只看到部分設定，展開完整設定；不要為了找 Portable 改成 Self-contained。若出現刪除目標既有檔案的選項，本 SOP 仍採新目錄，避免刪除共用資料。此次文件未在 VS2026 GUI 逐頁實測；Folder、設定及 Publish 的官方工作流程參考 [Visual Studio 發布至資料夾](https://learn.microsoft.com/en-us/visualstudio/deployment/quickstart-deploy-aspnet-web-app?view=visualstudio)。

下次從 Publish 頁面選既有設定檔，再進 Settings 修改 Target location 為新目錄後發布。設定通常放在 Server 專案的 `Properties/PublishProfiles/*.pubxml`；`.pubxml` 可保存非敏感設定供團隊使用，但提交前要移除個人專用路徑等資訊。`.pubxml.user` 為使用者相關設定，不應提交。任何密碼、私鑰、連線憑證都不得放入 Git。此處只產生 Folder 產物，不建立 Web Deploy 遠端帳號。設定欄位可對照 [Visual Studio 發布設定](https://learn.microsoft.com/en-us/visualstudio/deployment/web-deployment-settings?view=visualstudio)。設定檔機制參考 [ASP.NET Core 發布設定檔](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/visual-studio-publish-profiles?view=aspnetcore-10.0)。

## 4. 兩種方法共用：發布產物檢查

將下列 `$publishPath` 換成實際輸出目錄，在開發電腦檢查：

```powershell
$publishPath = 'C:\Vulcan\Github\Handwriting\artifacts\publish'
$required = @(
  'Handwriting.Server.dll', 'Handwriting.Server.deps.json',
  'Handwriting.Server.runtimeconfig.json', 'web.config', 'appsettings.json',
  'wwwroot\index.html', 'wwwroot\service-worker.js',
  'wwwroot\service-worker-assets.js', 'wwwroot\data\symbols.json',
  'wwwroot\audio', 'wwwroot\_framework'
)
foreach ($relative in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $publishPath $relative))) {
    throw "缺少發布產物：$relative"
  }
}
Get-Content -LiteralPath (Join-Path $publishPath 'web.config')
(Get-Content -LiteralPath (Join-Path $publishPath 'appsettings.json') -Raw | ConvertFrom-Json).Version
(Get-ChildItem -LiteralPath (Join-Path $publishPath 'wwwroot\audio') -File |
  Where-Object { $_.Extension -in '.mp3', '.wav' }).Count
```

0.1.1 預期版本是 0.1.1，原始 MP3／WAV 音檔共 84 個（不計壓縮副本）；教材包含 99 個符號、174 筆。未來版本以該版驗收紀錄為準。保留完整輸出中的其餘 DLL、JSON、壓縮與靜態資源，不能只依上述清單挑檔複製。

SDK 產生的 `web.config` 應以 `AspNetCoreModuleV2` 處理請求；本專案既有產物為 `processPath="dotnet"`、`arguments=".\Handwriting.Server.dll"`、`hostingModel="inprocess"`。保留原檔，不套用「獨立靜態 Blazor WASM」的 rewrite 範本；它會破壞本專案的 ASP.NET Core 主機流程。

## 5. IIS 首次部署 SOP

以下操作在伺服器以系統管理員執行；使用 IIS Manager（`inetmgr`）。基本設定概念參考 [ASP.NET Core IIS 託管指引](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/iis/?view=aspnetcore-10.0)。

1. 在伺服器執行 `dotnet --list-runtimes`，確認 `Microsoft.NETCore.App 10.0.x` 與 `Microsoft.AspNetCore.App 10.0.x`。在 IIS 的 Modules 確認 `AspNetCoreModuleV2`；缺少時修復 Hosting Bundle。
2. 建立 `C:\Sites\Handwriting\releases\0.1.1`，把第 4 節確認過的輸出**全部內容**複製到其中，`web.config` 必須直接位於該目錄，不可多包一層 publish 資料夾。保留副檔名及隱藏檔，複製後再核對清單。
3. IIS Manager → Application Pools → Add Application Pool，名稱 `Handwriting`，.NET CLR version 選 **No Managed Code**，Managed pipeline mode 選 **Integrated**。進 Advanced Settings，確認 **Enable 32-Bit Applications = False**、Identity = **ApplicationPoolIdentity**。No Managed Code 是 IIS 集區設定，不代表不需 .NET Runtime。
4. 在版本目錄的內容 → 安全性 → 編輯 → 新增，選本機位置並輸入 `IIS AppPool\Handwriting`，授予「讀取及執行、列出資料夾內容、讀取」，讓子目錄繼承。不要給整站 Modify／Full Control。若父目錄有額外限制，確認該身分可穿越到版本目錄。
5. IIS Manager → Sites → Add Website：Site name `Handwriting`，Application pool 選同名集區，Physical path 選上述版本目錄。HTTP 線上模式選 **http** 與連接埠（例如 **88**），IP address 可選 All Unassigned；確認沒有與其他站台 Binding 衝突。需要離線時改選 **https**、Port **443**、Host name `write.example.com` 及對應 SSL certificate，共用 IP 的多站台使用 SNI（Require Server Name Indication）。
6. HTTPS 才需憑證：若尚未匯入，在伺服器節點 → Server Certificates → Import 匯入含私鑰的 PFX，確認到期日、主機名稱與信任鏈後再設 Binding。HTTP 線上模式略過此步。妥善保存 PFX，不放進網站目錄或 Git。
7. 網站 → Authentication，確認 Anonymous Authentication 啟用；Edit 選 **Application pool identity**，使靜態資源與第 4 步的 ACL 一致。本系統不需 Windows Authentication。
8. 在系統管理員 PowerShell 依下方命令設定專用集區的 Production 環境，再重新啟動該集區。兩個環境變數使用同值，避免繼承設定不一致；不修改 wwwroot 內已發布內容。
9. 啟動集區及網站，從另一台電腦以完整網址開啟。HTTP 應顯示線上模式；HTTPS 應確認憑證沒有警告，再依第 8 節驗收。

第 8 步的初次設定命令如下。先查看目前設定，若同名環境變數已存在，不要重複新增；使用下方更新命令修改值。集區層級環境變數參考 [IIS environmentVariables](https://learn.microsoft.com/en-us/iis/configuration/system.applicationhost/applicationpools/add/environmentvariables/)。

```powershell
$appcmdPath = Join-Path $env:windir 'System32\inetsrv\appcmd.exe'
& $appcmdPath list config -section:system.applicationHost/applicationPools
& $appcmdPath set config -section:system.applicationHost/applicationPools "/+[name='Handwriting'].environmentVariables.[name='DOTNET_ENVIRONMENT',value='Production']" /commit:apphost
if ($LASTEXITCODE -ne 0) { throw '設定 DOTNET_ENVIRONMENT 失敗。' }
& $appcmdPath set config -section:system.applicationHost/applicationPools "/+[name='Handwriting'].environmentVariables.[name='ASPNETCORE_ENVIRONMENT',value='Production']" /commit:apphost
if ($LASTEXITCODE -ne 0) { throw '設定 ASPNETCORE_ENVIRONMENT 失敗。' }
```

已存在的項目改用下列命令，不需再次新增：

```powershell
& $appcmdPath set config -section:system.applicationHost/applicationPools "/[name='Handwriting'].environmentVariables.[name='DOTNET_ENVIRONMENT'].value:Production" /commit:apphost
& $appcmdPath set config -section:system.applicationHost/applicationPools "/[name='Handwriting'].environmentVariables.[name='ASPNETCORE_ENVIRONMENT'].value:Production" /commit:apphost
```

本系統在非 Development 環境啟用 HSTS，但程式沒有 HTTP→HTTPS 轉址中介軟體。需要 HTTP 線上模式時，可直接在 Handwriting 網站新增 HTTP Binding 並開放對應防火牆連接埠；不安裝憑證也能練習與保存，但頁首會提示不能離線。若日後改成 HTTPS，可另建 `Handwriting-Redirect` 網站，使用獨立空目錄及專用集區，只綁定 HTTP 80；安裝 HTTP Redirection 角色功能後，在此轉址站的 HTTP Redirect 設定目標 `https://write.example.com/`、永久轉址 301，勾選轉至完整目的地。此簡單設定統一回首頁，不保留輸入的子路徑；請勿同時在正式 HTTPS 站啟用相同轉址以免循環。確認實際 HTTP 回應為 301 且 Location 正確。

## 6. PWA、快取與資料注意事項

網站預設部署在來源根路徑 `/`。不要直接放入 `/Handwriting/` 虛擬目錄；子路徑需要一起調整 base、manifest、Service Worker 範圍及主機路由，另案修改並測試。

一般 HTTP 顯示「HTTP 線上模式」，可練習、闖關及保存於目前瀏覽器，但重新開啟時必須保持連線。只有 HTTPS／localhost 且所有必要程式、教材與音檔下載成功，介面才顯示「已可離線使用」。略過憑證警告也不等於可可靠使用 PWA。下載失敗時保持連網，按頁尾「檢查離線教材」重試。PWA 安裝及快取生命週期的背景可參考 [Blazor PWA 指引](https://learn.microsoft.com/en-us/aspnet/core/blazor/progressive-web-app/?view=aspnetcore-10.0)。

發布時不可混用不同版本的檔案，也不可直接修改發布後的教材、音檔或 wwwroot 內容；Service Worker 依資源清單進行完整性校驗，任意修改可能導致下載失敗。需要變更內容時回到原始碼重新發布完整版本。

不要在 IIS 額外套用全站長效快取，尤其是 `index.html`、`service-worker.js`、`service-worker-assets.js`。本機快取會保留正在使用的版本：新版本下載完成後，須關閉該來源的**所有瀏覽器分頁及已安裝 PWA 視窗**，再重新開啟才能套用。重新整理單一分頁不保證更新，伺服器停機也不會立刻關閉離線練習。

本機進度存於 localStorage，以網站來源（協定、主機、連接埠）與瀏覽器區隔。改網址不會自動搬移紀錄；清除網站資料會刪除進度與離線教材。不要把清除網站資料列為例行更新步驟；瀏覽器也可能回收離線儲存，屆時需重新下載。本系統不保存或上傳原始筆跡。

## 7. 更新與回復舊版 SOP

### 7.1 更新

1. 記錄現用版本、IIS 實體路徑、集區、Binding、憑證與環境設定，保留可回復的完整舊產物；通知維護時段。
2. 用 CLI 或 VS 發布新版至全新輸出目錄，完成第 4 節檢查，再複製完整內容到新的伺服器版本目錄；沿用讀取／執行 ACL。
3. 在 IIS Manager 停止 **Handwriting 集區**；僅回收集區不足以形成明確的切換窗口。
4. Sites → Handwriting → Basic Settings，將 Physical path 切至新版本目錄；不要逐檔覆蓋正在運行的目錄。
5. 啟動集區，從未快取過該站的測試瀏覽器驗證伺服器新版，再以既有瀏覽器測試 PWA 更新與進度。
6. 既有用戶端連網按「檢查離線教材」，等新版就緒，關閉所有相關分頁／PWA 視窗後重開；核對畫面版本、語音、進度與斷網重開。
7. 記錄驗收結果及切換時間；保留上一版以便回復，不立即刪除。

### 7.2 回復

1. 若新版伺服器啟動或功能驗收失敗，停止專用集區，將 Physical path 切回記錄的舊目錄，啟動集區。
2. 以乾淨測試瀏覽器確認伺服器舊版正常，再測 HTTPS、描寫及語音；不要在失敗版本目錄內局部換 DLL。
3. 已快取新版的用戶端仍可能繼續使用新版；讓其連網重新檢查教材，待舊版資源下載後關閉所有分頁／PWA 視窗並重開，再核對版本。離線裝置要等恢復連線，伺服器回復不會即時撤回它的快取。
4. 紀錄回復原因、時間與實際用戶端版本。若新版本曾改進度格式，部署前就需驗證向後相容；目前 0.1.1 沒有雲端資料庫遷移可代替這項檢查。

## 8. 上線驗收清單

以正常連線的新瀏覽器與已保存進度的既有瀏覽器分別測試。首次上線與更新都要完成；回復時另核對目標舊版本。測試紀錄至少填入日期、部署版本、作業系統、瀏覽器／平板型號、結果與問題。

- [ ] 另一台裝置可連線；HTTPS 網域與憑證正確，或 HTTP Binding、連接埠與防火牆規則正確。若另設轉址站才確認 301 轉址。
- [ ] 採 HTTP 線上模式時，頁首顯示不能離線；第一個分頁可保存，第二個分頁被阻擋，關閉第一頁後可重新取得寫入權。
- [ ] 畫面載入且無瀏覽器 Console 錯誤；四分類共 99 符號可選，版本符合交付。
- [ ] 正確描寫可完成，錯誤筆畫可重試且保留成功筆畫；語音可播放、重播及靜音。
- [ ] 完成一次後重新載入，完成標記與成功次數保持，重播不增加次數。
- [ ] 開發者工具 Network 核對實際請求的 WASM、JavaScript、JSON、WAV／MP3 均成功，回應內容不是 HTML 錯誤頁。
- [ ] 等「已可離線使用」後斷網，關閉再重新開啟，測試各分類及語音；不要只在原頁面斷網後繼續點擊就算通過。
- [ ] 人工中斷首次下載，再連網按「檢查離線教材」，可完成下載與離線重開。
- [ ] 更新後確認舊分頁不在描寫中被強制重載；關閉所有分頁及 PWA 視窗後取得目標版本。
- [ ] Android 實機觸控、旋轉、觸控取消與平板喇叭正常；全部讀音人工聽辨依 [驗收清單](../acceptance.md) 記錄。
- [ ] 回復演練可切回舊目錄；乾淨瀏覽器與既有 PWA 最終都取得預期版本。

WASM 通常應為 `application/wasm`，JSON 為 `application/json`，JavaScript 為 JavaScript MIME，音檔為相容音訊 MIME。用 Network 查看實際 URL，不猜測有雜湊的檔名。本主機由 ASP.NET Core 路由提供資源，遇錯先查請求是否進入應用；不要直接大量新增 IIS MIME 映射或套用靜態 WASM 範本。音訊可能使用 Range，206 屬正常回應。

## 9. 故障排除與日誌

| 現象 | 優先檢查與處理 |
|---|---|
| 500.19 | 查看頁面的錯誤碼與設定行；確認 web.config 完整、Hosting Bundle／AspNetCoreModuleV2 已安裝，沒有重複或鎖定的 IIS 設定 |
| 500.30 | in-process 啟動失敗；查 Application 事件及暫時 stdout，核對相依檔、集區權限與環境設定 |
| 500.31 | 核對 .NET 10 與 ASP.NET Core Runtime、64 位元一致性及 Hosting Bundle；安裝後重啟相關服務 |
| 503 | 確認集區已啟動、Rapid-Fail Protection 是否因持續失敗停用，以及事件記錄中的真正啟動錯誤 |
| 首頁正常但資源 404／白畫面 | 核對完整 Server 發布產物、網站根路徑及請求 MIME；查是否混用新舊檔案、誤用靜態站台 web.config |
| 離線教材下載中斷 | 檢查 Network 的失敗資源／完整性錯誤，確認全版產物一致、網路及空間可用後重試 |
| 始終看到舊版 | 用乾淨瀏覽器先確認伺服器版本，再查 Service Worker waiting；連網檢查教材並關閉所有分頁／PWA 視窗 |
| 語音無聲 | 先按開始以取得使用者互動，確認未靜音、裝置音量、音檔請求及 Range 回應；離線時確認下載完成 |
| Android 無法離線 | 確認受信任 HTTPS、安全來源、下載完成；localhost、開發憑證或桌面 hosts 設定不適用平板 |
| HTTP 顯示另一分頁正在使用 | 關閉同網址、同連接埠的其他分頁後重新載入；異常關閉時等 6 秒再試，不要清除網站資料 |

IIS 存取日誌的位置可在網站 Logging 功能查看，通常位於 `C:\inetpub\logs\LogFiles\W3SVC<網站ID>`；HTTP 狀態、子狀態與 Win32 狀態可協助定位。Event Viewer → Windows Logs → Application 查看 IIS AspNetCore Module V2／.NET 的同時段事件。模組啟動錯誤參考 [ASP.NET Core IIS 疑難排解](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/iis/troubleshoot?view=aspnetcore-10.0)。

需要 stdout 時先備份部署目錄的 `web.config`，建立 `C:\Sites\Handwriting\logs`，只對此目錄授予 `IIS AppPool\Handwriting` Modify；暫時將 `aspNetCore` 的 `stdoutLogEnabled` 改為 `true`，`stdoutLogFile` 指向 `C:\Sites\Handwriting\logs\stdout`。這是診斷例外，不更改 wwwroot 教材或其校驗清單；重現一次後立即還原 `stdoutLogEnabled="false"`，必要時重新啟動專用集區。stdout 不適合作為常態輪替日誌，檔案可能含敏感資訊；依事件處理需要保存後清理，不公開提供下載，也不把紀錄提交到 Git。

## 10. 文件維護

本次只補充部署說明，應用程式版本維持 0.1.1；沒有新增發布設定檔、修改 IIS 或完成目標主機驗收。維護本文件後手動執行 `pwsh -File scripts/Test-DocsEncoding.ps1`，保持繁體中文、UTF-8 BOM 與 CRLF。實際部署人員應保存第 8 節驗收紀錄，並依 [維護規範](維護規範.md) 管理之後的新交付版本。

本次文件核對日期：2026-09-10。已核對 CLI 參數說明、現有 Release 必要檔案、84 個原始音檔及 in-process 設定；未重新建置或操作 IIS、VS2026 GUI、Android。文件編碼、內部連結與 PowerShell 區塊語法另經靜態檢查；語法檢查不代表命令已在伺服器執行成功。

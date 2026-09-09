# 教材與音檔來源

## 注音

來源：[教育部《國語注音符號手冊》](https://language.moe.gov.tw/001/Upload/files/site_content/M0001/juyin/index.html)。

獨立素材：[2017-02-13 開放部件壓縮檔](https://language.moe.gov.tw/001/Upload/files/site_content/M0001/juyin/bopomofo_materials_20170213.zip)。原始 `license.txt` 隨網站保留於 `data/moe-license.txt`。

2017 © 教育部，國語注音符號手冊-開放部件。

此素材依「創用CC 姓名標示 4.0 國際版本」授權條款進行公眾釋出，使用者於遵守本條款各項規定之前提下，得利用之。條款：https://creativecommons.org/licenses/by/4.0/deed.zh_TW 。

改作：取 XML 的 Track 作為依序的中心軌跡，從 2048 單位轉為 0–100 格線座標，保留筆畫順序與比例；不使用字型輪廓作為筆順。女性真人讀音 F1.WAV–F37.WAV 依序對應 ㄅ–ㄩ，改檔名保留音訊內容。素材來自獨立開放包，與整本手冊本體之禁止改作授權分開處理。

## 英文、數字與提示

62 個英文與數字字形由本專案原創固定非連筆路徑組成，數字採單套教學筆順、小寫 a/g 為單層；這是本教材示範，不表示其他字帖的寫法錯誤。

目前英文與數字未採用第三方真人錄音，依核准備案以 edge-tts 7.2.8 預製合成音檔。中文使用 zh-TW-HsiaoChenNeural，英文使用 en-US-JennyNeural，速度 -15%。提示文字與製作程式位於 `scripts/build-audio.py`。所有音檔可離線播放，不在小朋友練習時呼叫雲端語音服務。合成音檔與注音讀音仍待完整人工聽辨，不宣稱已通過真人驗收。

## 重建方式

在根目錄下載上述壓縮檔至 `.cache/materials/bopomofo.zip`，用 `python -m zipfile -e .cache/materials/bopomofo.zip .cache/materials/extracted` 解壓，執行 `python scripts/build-curriculum.py`。音訊重建先安裝 `edge-tts==7.2.8`，再執行 `python scripts/build-audio.py`（需要連網；現有成功音檔會略過）。執行 `python scripts/Test-Curriculum.py` 驗證完整性。

原始參考：[兒童注音練習本整理](https://blog.gtwang.org/children/phonetic-exercise-books-for-children/)。只參考大格子與描線引導概念，沒有複製文章圖片。

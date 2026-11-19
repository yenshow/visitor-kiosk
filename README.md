# YSOP Kiosk 訪客系統

獨立訪客**預約／報到／簽退** Kiosk。資料全在本機（預約、部門／被訪人、在場狀態），不依賴外部門禁平台。

## 快速開始（安裝檔）

```bash
npm install --legacy-peer-deps --cache ./.npm-cache
npm run pack
```

需求：Node.js／npm、**.NET 8 SDK**、[Inno Setup 6](https://jrsoftware.org/isinfo.php)。

產出 `dist/YSOP-Kiosk-setup.exe`（圖示 `installer/assets/YSOP.ico`）。現場執行安裝檔後，用桌面「YSOP Kiosk」捷徑（圖示 `kiosk.ico`）完成授權再「啟動服務」。

說明：[docs/env-setup.md](docs/env-setup.md)。流程／API：[docs/visitor-kiosk-integration-spec.md](docs/visitor-kiosk-integration-spec.md)。

本機開發：複製／編輯專案根 `.env`；授權請用 `YsopKiosk.exe` → **授權設定**（或設 `LICENSE_OPEN_ALL_FEATURES=1`）。部門與被訪人於 `/setting` 新增。

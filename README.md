# YSOP Kiosk 訪客系統

獨立訪客**預約／報到／簽退** Kiosk。後端代理對接 Yenshow Central Professional（**YSCP**）Artemis OpenAPI；可選出口 LPR 事件驅動開閘。

## 快速開始（安裝檔）

```bash
npm install --legacy-peer-deps --cache ./.npm-cache
npm run pack
```

需求：Node.js／npm、**.NET 8 SDK**、[Inno Setup 6](https://jrsoftware.org/isinfo.php)。

產出 `dist/YSOP-Kiosk-setup.exe`（圖示 `installer/assets/YSOP.ico`）。現場執行安裝檔後，用桌面「YSOP Kiosk」捷徑（圖示 `kiosk.ico`）完成 YSCP 設定再「啟動訪客機」。

說明：[docs/env-setup.md](docs/env-setup.md)。流程／API：[docs/visitor-kiosk-integration-spec.md](docs/visitor-kiosk-integration-spec.md)。

本機開發可另跑 `npm run setup:yscp`（只寫專案根 `.env`，不進封裝）。

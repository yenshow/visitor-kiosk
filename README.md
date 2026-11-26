# YSOP Kiosk 訪客系統

獨立訪客**預約／報到／簽退** Kiosk。預約、部門／被訪人與在場狀態儲存在本機。Windows 啟動器支援 YSOP-Kiosk 的 `visitor` 產品授權。

## 快速開始（安裝檔）

```bash
npm install --legacy-peer-deps --cache ./.npm-cache
npm run pack
```

需求：Node.js／npm、**.NET 8 SDK**、[Inno Setup 6](https://jrsoftware.org/isinfo.php)。

產出 `dist/YSOP-Kiosk-setup.exe`。安裝後，從桌面「YSOP Kiosk」開啟**授權設定**及**服務設定**，再啟動服務。

說明：[docs/env-setup.md](docs/env-setup.md)。流程／API：[docs/visitor-kiosk-integration-spec.md](docs/visitor-kiosk-integration-spec.md)。

本機開發：複製／編輯專案根 `.env`（SMTP、`KIOSK_ADMIN_IPS` 等）。部門與被訪人於 `/setting` 新增。外部預約頁：`/book`。

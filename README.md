# 訪客服務機（YSOP / Visitor Kiosk）

獨立訪客**預約／報到／簽退** Web 平台。後端代理對接 Yenshow Central Professional（**YSCP**）Artemis OpenAPI；可選出口 LPR 事件驅動開閘。

## 快速開始

```bash
copy .env.example .env
npm install --legacy-peer-deps --cache ./.npm-cache
npm run setup:yscp
npm run dev
```

瀏覽器開啟 http://localhost:3010。生產：`npm run start`（同樣埠 **3010**）。

- YSCP 設定（HOST／金鑰／Webhook／出口車道）：[docs/env-setup.md](docs/env-setup.md)
- 流程、Kiosk API、Artemis：[docs/visitor-kiosk-integration-spec.md](docs/visitor-kiosk-integration-spec.md)

本機畫面設定在 `/setting`（跑馬燈、主題、logo、是否顯示預約、重置訪客統計），寫入 `data/`。`.env` 勿打包進公開發佈物。

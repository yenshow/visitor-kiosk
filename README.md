# 訪客服務機（Visitor Kiosk）

獨立的訪客**預約**與**報到** Web 平台，透過後端代理對接 HikCentral Professional（HCP）Artemis OpenAPI。

## 環境設定

本專案**只使用 `.env`**。

```bash
copy .env.example .env
# 編輯 .env 填入 HCP_HOST / HCP_AK / HCP_SK
```

| 變數 | 說明 | 預設 |
|------|------|------|
| `HCP_HOST` | Artemis 主機（可含埠 `ip:443`） | `127.0.0.1` |
| `HCP_PORT` | HTTPS 埠 | `443` |
| `HCP_AK` / `HCP_SK` | OpenAPI 金鑰（必填） | — |
| `HCP_REJECT_UNAUTHORIZED` | TLS 驗證（自簽請 `false`） | `false` |
| `HCP_TIMEOUT_MS` | 請求逾時毫秒 | `30000` |
| `NEXT_PUBLIC_KIOSK_IDLE_SECONDS` | 倒數回首頁秒數 | `20` |
| `NEXT_PUBLIC_NOTICE_VIDEO_URL` | 須知影片：YouTube、影片網址、檔案或資料夾 | `/notice.mp4` |
| `PORT` | Next.js 備援埠（scripts 已固定 `--port 3010`） | `3010` |
| `ALLOWED_DEV_ORIGINS` | 開發模式允許的區網主機 | `localhost,127.0.0.1,192.168.2.8` |

## 啟動

```bash
npm install --legacy-peer-deps --cache ./.npm-cache
npm run dev
```

瀏覽器開啟 http://localhost:3010（`npm run dev` / `npm start` 固定使用 3010，避開本機已被佔用的 3000）

## API（前端勿直打 Artemis）

- `GET /api/kiosk/status`：HCP 連線設定狀態
- `GET /api/kiosk/notice`
- `GET /api/kiosk/orgs`：部門清單
- `POST /api/kiosk/hosts`：依部門載入被訪人
- `POST /api/kiosk/appoint`：建立預約（無需須知）
- `POST /api/kiosk/verify`：預約密碼查詢
- `POST /api/kiosk/checkin`：報到（需同意訪客須知）

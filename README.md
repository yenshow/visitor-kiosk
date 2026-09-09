# 訪客服務機（YSOP / Visitor Kiosk）

獨立訪客**預約／報到／簽退** Web 平台。後端代理對接 HikCentral Professional（**YSCP = HCP**）Artemis OpenAPI；可選出口 LPR 事件驅動開閘。

對外敘述稱 **YSCP**；環境變數前綴仍為 `HCP_`。

## 快速開始

```bash
copy .env.example .env
# 編輯 .env：至少填 HCP_HOST / HCP_AK / HCP_SK

npm install --legacy-peer-deps --cache ./.npm-cache
npm run dev
```

瀏覽器開啟 http://localhost:3010（固定埠 **3010**）。

生產啟動：`npm run start`（同樣埠 3010）。

詳細環境變數與 `HCP_EXIT_LANES` 取得方式：[docs/env-setup.md](docs/env-setup.md)  
整合規格：[docs/visitor-kiosk-integration-spec.md](docs/visitor-kiosk-integration-spec.md)

## 環境變數摘要

| 變數 | 說明 |
|------|------|
| `HCP_HOST` / `HCP_PORT` | Artemis 主機與埠 |
| `HCP_AK` / `HCP_SK` | OpenAPI 金鑰（必填） |
| `HCP_REJECT_UNAUTHORIZED` | 自簽憑證設 `false` |
| `HCP_TIMEOUT_MS` | 請求逾時（預設 30000） |
| `HCP_EVENT_DEST` | 事件 Webhook URL（YSCP 須能連到） |
| `HCP_EVENT_TOKEN` | 事件推送校驗 token |
| `HCP_EXIT_LANES` | 出口相機→繼電器 JSON |
| `HCP_GATE_DEDUP_MS` | 開閘去重毫秒（預設 5000） |
| `NEXT_PUBLIC_KIOSK_IDLE_SECONDS` | 無操作回首頁秒數 |
| `NEXT_PUBLIC_KIOSK_MARQUEE` | 首頁跑馬燈 |
| `NEXT_PUBLIC_NOTICE_VIDEO_URL` | 訪客須知影片 |
| `ALLOWED_DEV_ORIGINS` | 開發模式允許的區網主機 |

本機 UI 設定（跑馬燈／主題／logo／是否顯示預約）在 `/setting`，寫入 `data/`。

## 首次設定出口開閘

1. `.env` 填好 `HCP_EVENT_DEST`、`HCP_EVENT_TOKEN`
2. 互動選出口相機與繼電器：

```bash
npm run setup:hcp -- lanes
# 或直接寫入 .env：
npm run setup:hcp -- lanes --write-env
```

3. 訂閱車牌上傳事件 `131622`：

```bash
npm run setup:hcp -- subscribe
```

（kiosk 啟動時也會自動訂閱；亦可 `POST /api/kiosk/hcp/subscribe`）

其他 CLI：`cameras`、`relays --dev <id>`、`open --relay <id> --yes`。說明見 [docs/env-setup.md](docs/env-setup.md)。

## 業務流程（摘要）

| 功能 | 說明 |
|------|------|
| 訪客預約 | 選部門／被訪人，可帶車牌；建立 YSCP 預約 |
| 訪客報到 | 密碼或手機；含臨時外出「確認返回」 |
| 訪客簽退 | `temp` 臨時外出／`final` 正式簽退；只寫本機出場名單，**不在按鈕當下開閘** |
| 出口開閘 | 出口 LPR → YSCP 推 `131622` → `/api/hcp/events` 比對名單 → `alarmOutput` 開閘 |
| 入場 | 仍由 YSCP 預約時段權限控管；本機不控入口閘 |

## API（前端勿直打 Artemis）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/kiosk/status` | YSCP 連線狀態 |
| GET | `/api/kiosk/stats` | 在場／臨時外出／今日離場 |
| GET | `/api/kiosk/records` | 訪客紀錄 |
| GET/PUT | `/api/kiosk/settings` | 本機設定 |
| GET | `/api/kiosk/notice` | 訪客須知 |
| GET | `/api/kiosk/orgs` | 部門 |
| POST | `/api/kiosk/hosts` | 被訪人 |
| POST | `/api/kiosk/appoint` | 建立預約 |
| POST | `/api/kiosk/verify` | 報到查詢 |
| POST | `/api/kiosk/checkin` | 報到 |
| POST | `/api/kiosk/checkout/lookup` | 簽退查詢 |
| POST | `/api/kiosk/checkout` | `mode=temp\|return\|final` |
| POST | `/api/kiosk/hcp/subscribe` | 手動重訂事件 |
| POST | `/api/hcp/events` | HCP Webhook（先回 200，背景開閘） |

## 目錄結構（部署相關）

| 路徑 | 說明 |
|------|------|
| `src/` | 應用程式 |
| `scripts/hcp-setup.ts` | 首次設定 CLI |
| `docs/` | 環境設定與整合規格 |
| `content/visitor-notice.md` | 訪客須知 |
| `data/` | 運行時狀態／設定（現場寫入） |
| `public/` | 靜態資源 |
| `.env` | 現場密鑰（勿打包進公開發佈物） |

開發產物（`node_modules`、`.next`、`.npm-cache`）與 AI agent 檔（`AGENTS.md`／`CLAUDE.md`）不納入免安裝現場包；`next.config.ts` 已設 `agentRules: false` 避免 `next dev` 自動產生。

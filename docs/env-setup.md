# 訪客服務機環境設定

YSCP 連線、事件訂閱、出口相機／繼電器由 **`npm run setup:yscp`** 寫入 `.env`（Node UTF-8）。請勿用 PowerShell `Set-Content` 改中文註解，系統碼頁會變成亂碼。

```bash
copy .env.example .env
npm install --legacy-peer-deps --cache ./.npm-cache
npm run setup:yscp
```

腳本依序寫入並執行：

1. `YSCP_HOST`、`YSCP_AK`、`YSCP_SK`
2. `YSCP_EVENT_DEST`（本機區網 IP 候選）；token 用 `.env` 的 `YSCP_EVENT_TOKEN`（預設 `Aa83124007`，不必詢問）
3. 出口 LPR 相機＋繼電器 → `YSCP_EXIT_LANES`（可多組）
4. 向 YSCP 訂閱車牌事件 `131622`

完成後重啟 kiosk。啟動時會再訂閱一次。腳本：[`scripts/yscp-setup.ts`](../scripts/yscp-setup.ts)。

單一步驟（可選）：

```bash
npm run setup:yscp -- subscribe
npm run setup:yscp -- cameras
npm run setup:yscp -- relays --dev <encodeDevIndexCode>
npm run setup:yscp -- lanes
npm run setup:yscp -- open --relay <alarmOutputIndexCode> --yes
```

---

## 環境變數

### 由腳本寫入

| 變數 | 說明 |
|------|------|
| `YSCP_HOST` | Artemis 主機（可 `ip:埠`，未寫埠則 443） |
| `YSCP_AK` / `YSCP_SK` | OpenAPI 金鑰 |
| `YSCP_EVENT_DEST` | YSCP 可連到的 Webhook，區網請用 `http://192.168.x.x:3010/api/yscp/events` |
| `YSCP_EVENT_TOKEN` | 訂閱／推送校驗，預設 `Aa83124007` |
| `YSCP_EXIT_LANES` | 出口相機 → 繼電器 JSON |

YSCP 必須能連到 `YSCP_EVENT_DEST`。開發機自簽 HTTPS 時，YSCP 推送常 **SSL Handshake Failure（靜默失敗）**；區網請用 **HTTP** 訂閱。

`YSCP_EXIT_LANES` 對照事件裡的 `srcIndex`（≈ `cameraIndexCode`）到該車道 `alarmOutputIndexCode`。只填出口相機。

```env
YSCP_EXIT_LANES=[{"cameraIndexCode":"1213","alarmOutputIndexCode":"1218"}]
```

```
出口 LPR ──encodeDev──► 繼電器 ──► 柵欄機
    │
    ▼  事件 131622（srcIndex）
/api/yscp/events ──查 EXIT_LANES──► alarmOutput/controlling
```

### 寫死於程式（不必放進 `.env`）

HTTPS 443、不驗證 TLS、逾時 30 秒、開閘去重 5 秒、無操作回首頁 20 秒。服務埠 **3010**。

### Kiosk

| 變數 | 說明 |
|------|------|
| `NEXT_PUBLIC_KIOSK_MARQUEE` | 首頁跑馬燈（`/setting` 可覆寫） |
| `NEXT_PUBLIC_NOTICE_VIDEO_URL` | 訪客須知影片 |
| `ALLOWED_DEV_ORIGINS` | 開發模式允許的區網主機 |

---

## 常見問題

| 狀況 | 處理 |
|------|------|
| 事件進來但不開閘 | `srcIndex`＝出口 `cameraIndexCode`；車牌在臨時外出或今日離場 |
| 訂閱失敗／收不到事件 | AK／SK；`YSCP_EVENT_DEST` 用 **http://**（非自簽 https）；`npm run setup:yscp -- subscribe` |
| 開閘打到錯的閘 | `npm run setup:yscp -- lanes` |
| 雙出口 | 設定時再新增一組，或重跑 `lanes` |

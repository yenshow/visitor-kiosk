# 訪客服務機環境設定說明

本專案只使用根目錄 `.env`（範本：`.env.example`）。對外敘述稱 **YSCP**；環境變數前綴仍為 `HCP_`（= HikCentral Professional Artemis）。

```bash
copy .env.example .env
# 編輯 .env 填入 HCP_HOST / HCP_AK / HCP_SK（以及出場相關變數）
```

---

## 0. 首次設定（建議）

安裝並填好連線金鑰後，用與 kiosk **相同簽章**的 CLI 完成訂閱與車道對照：

```bash
npm install --legacy-peer-deps --cache ./.npm-cache

# 訂閱車牌上傳事件 131622（需已設 HCP_EVENT_DEST / HCP_EVENT_TOKEN）
npm run setup:hcp -- subscribe

# 列出攝影機
npm run setup:hcp -- cameras

# 依相機的 encodeDevIndexCode 查繼電器
npm run setup:hcp -- relays --dev <encodeDevIndexCode>

# 互動選出口相機＋繼電器，印出 HCP_EXIT_LANES（可加 --write-env 寫入 .env）
npm run setup:hcp -- lanes
npm run setup:hcp -- lanes --write-env

# 實體開閘測試（必須 --yes）
npm run setup:hcp -- open --relay <alarmOutputIndexCode> --yes
```

腳本：[`scripts/hcp-setup.ts`](../scripts/hcp-setup.ts)，內部呼叫 [`src/lib/hcp/artemis-client.ts`](../src/lib/hcp/artemis-client.ts)。

---

## 1. 變數一覽

### 1.1 YSCP 連線（必填才能打 Artemis）

| 變數 | 說明 | 範例／預設 |
|------|------|------------|
| `HCP_HOST` | Artemis 主機（可含埠） | `192.168.2.2` |
| `HCP_PORT` | HTTPS 埠 | `443` |
| `HCP_AK` / `HCP_SK` | OpenAPI 金鑰 | 於 HCP 後台申請 |
| `HCP_REJECT_UNAUTHORIZED` | 自簽憑證請設 `false` | `false` |
| `HCP_TIMEOUT_MS` | 請求逾時毫秒 | `30000` |

### 1.2 出口 LPR 事件開閘（選填；未設則不訂閱／不開閘）

| 變數 | 說明 | 範例／預設 |
|------|------|------------|
| `HCP_EVENT_DEST` | HCP 可連到的 Webhook 完整 URL | `https://192.168.x.x:3010/api/hcp/events` |
| `HCP_EVENT_TOKEN` | 訂閱與推送校驗用自訂密鑰 | 任意足夠長的字串 |
| `HCP_EXIT_LANES` | 出口相機 → 繼電器對照 JSON | 見下文 |
| `HCP_GATE_DEDUP_MS` | 同車牌＋同相機開閘去重 | `5000` |

**網路前提：** YSCP 伺服器必須能連到 `HCP_EVENT_DEST`。HCP 常要求 HTTPS；現場若僅 HTTP，需反代或確認 HCP 是否允許內網 http。

### 1.3 Kiosk UI

| 變數 | 說明 | 預設 |
|------|------|------|
| `NEXT_PUBLIC_KIOSK_IDLE_SECONDS` | 無操作回首頁秒數 | `20` |
| `NEXT_PUBLIC_KIOSK_MARQUEE` | 首頁跑馬燈（設定頁可覆寫） | 見 `.env.example` |
| `NEXT_PUBLIC_NOTICE_VIDEO_URL` | 訪客須知影片 | `/notice.mp4` |
| `PORT` | 備援埠（scripts 已固定 `--port 3010`） | `3010` |
| `ALLOWED_DEV_ORIGINS` | 開發模式允許的區網主機 | `localhost,127.0.0.1,...` |

---

## 2. `HCP_EXIT_LANES` 是什麼？

出口開閘時，平台會收到車牌事件裡的**攝影機通道 ID**（`srcIndex` ≈ `cameraIndexCode`），再查表得到該車道的**繼電器 ID**（`alarmOutputIndexCode`）去呼叫開閘 API。

格式（JSON 陣列，單行寫進 `.env`）：

```env
HCP_EXIT_LANES=[{"cameraIndexCode":"1213","alarmOutputIndexCode":"1218"}]
```

多出口：

```env
HCP_EXIT_LANES=[{"cameraIndexCode":"1213","alarmOutputIndexCode":"1218"},{"cameraIndexCode":"1214","alarmOutputIndexCode":"1219"}]
```

| 欄位 | 意義 |
|------|------|
| `cameraIndexCode` | 出口 LPR **攝影機邏輯通道 ID**（事件裡的 `srcIndex`） |
| `alarmOutputIndexCode` | 該車道柵欄機綁定的 **警報輸出／繼電器 ID** |

只填出口相機；入場相機不要寫進此清單（本機不控入場開閘）。

---

## 3. 手動以 OpenAPI 取得 ID（備援）

建議優先使用第 0 節 CLI。若需手查：

**是的，必須先找到出口 LPR 攝影機。**  
車牌事件由「攝影機通道」送出 ID；實體開閘繼電器掛在該相機所屬「編碼設備」上。

> API 需帶與 kiosk 相同的 `HCP_AK`／`HCP_SK`（HMAC 簽章）。

### 步驟 1：查攝影機

- `POST /artemis/api/resource/v1/cameras`
- Body：`{ "pageNo": 1, "pageSize": 100 }`
- 記下 `cameraIndexCode`、`encodeDevIndexCode`

### 步驟 2：查繼電器

- `POST /artemis/api/resource/v1/alarmOutput/advance/alarmOutputList`
- Body：`{ "pageNo": 1, "pageSize": 20, "devIndexCode": "<encodeDevIndexCode>", "deviceType": "encodeDevice" }`
- 記下 `alarmOutputIndexCode`

### 步驟 3：寫入 `.env` 並驗證

```env
HCP_EXIT_LANES=[{"cameraIndexCode":"1213","alarmOutputIndexCode":"1218"}]
```

1. 確認 `HCP_EVENT_DEST`、`HCP_EVENT_TOKEN`；HCP 能連到該 URL  
2. `npm run setup:hcp -- subscribe`，或重啟 kiosk／`POST /api/kiosk/hcp/subscribe`  
3. kiosk「臨時外出」或「正式簽退」寫入出場名單  
4. 出口 LPR 拍到車牌應開閘；log 可見 `[hcp-events]`

---

## 4. 對照關係（簡圖）

```
出口 LPR 相機 (cameraIndexCode)
        │  encodeDevIndexCode
        ▼
編碼設備 ──► 警報輸出 (alarmOutputIndexCode) ──► 柵欄機
        │
        ▼  車牌事件 131622（srcIndex = cameraIndexCode）
訪客機 /api/hcp/events
        │  查 HCP_EXIT_LANES
        ▼
POST .../alarmOutput/controlling { alarmOutputIndexCode, action: 1 }
```

---

## 5. 常見問題

| 狀況 | 處理 |
|------|------|
| 事件有進來但不開閘 | 確認 `srcIndex`＝`cameraIndexCode`；車牌在 `tempOut`／當日 `departedToday` |
| 訂閱失敗 | 檢查 AK／SK、`HCP_EVENT_DEST` 可連線、憑證／HTTPS |
| 開閘打到錯的閘 | 重跑 `npm run setup:hcp -- lanes` |
| 雙出口 | `HCP_EXIT_LANES` 陣列加第二組 |
| ID 數字或 GUID | **以 API 回傳字串原樣填入** |

---

## 6. 相關檔案

| 檔案 | 說明 |
|------|------|
| `.env.example` | 變數範本 |
| `scripts/hcp-setup.ts` | 首次設定 CLI |
| `src/lib/hcp/exit-gate.ts` | 相機／繼電器查詢與開閘 |
| `README.md` | 啟動與 API 摘要 |
| `docs/visitor-kiosk-integration-spec.md` | 完整整合規格 |
| `src/lib/kiosk/exit-lanes.ts` | 解析 `HCP_EXIT_LANES` |
| `src/app/api/hcp/events/route.ts` | 事件接收與開閘 |

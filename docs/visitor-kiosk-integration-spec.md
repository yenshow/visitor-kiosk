# 訪客服務機 × HikCentral Professional 整合規格

獨立訪客服務機（**YSOP** / Visitor Kiosk）透過 Next.js 後端代理對接 HikCentral Professional（**YSCP = HCP**）Artemis OpenAPI。前端不可直打 Artemis。

約定：入口 LPR 時段權限由 YSCP（HCP）在預約核准後下發；YSOP **不能**提早作廢入口車牌權限。

## 1. 系統架構

```
[ YSOP 前端 ]  →  [ Next.js /api/kiosk/* ]  →  [ YSCP Artemis HTTPS ]
[ 出口 LPR ]   →  [ YSCP 事件推送 ]       →  [ Next.js /api/hcp/events ] → 比對名單 → alarmOutput 開閘
```

- 金鑰與簽章只存在後端（`.env` 的 `HCP_AK` / `HCP_SK`；環境變數前綴仍為 HCP）。
- 時區一律 `Asia/Taipei`（ISO 8601 `+08:00`）。
- 報到／簽退下一步動作用一次性 token（記憶體、10 分鐘）；前端不帶 `appointID` 直打 Artemis。
- YSOP 本地狀態檔：`data/kiosk-presence.json`（臨時外出、今日離場；亦作為出口開閘允許名單）。
- YSOP 本機設定：`data/kiosk-settings.json`（跑馬燈、訪客預約開關、明暗主題、自訂 logo 檔名）；logo 檔 `data/kiosk-logo.*`。
- 設定頁路由：`/setting`（不在首頁顯示設定按鈕）。主題以 `html.dark` + CSS 變數實作，並以 cookie `theme` 搭配 `public/theme-init.js` 防閃爍。
- **前端對外敘述一律稱 YSCP**；程式碼／環境變數可保留 HCP 前綴。
- **入場** LPR 時段權限由 YSCP 預約核准後下發；YSOP **不**控入場開閘。
- **出場**由 YSOP 訂閱車牌上傳事件（131622），比對本機出場名單後呼叫繼電器開閘。

## 2. 業務流程

首頁入口：**訪客報到**、**訪客簽退**，以及可關閉的**訪客預約**；並顯示統計：目前在場、臨時外出、今日離場。點統計格可開啟訪客紀錄對話框。本機設定請至 `/setting`（跑馬燈、明暗主題、公司 logo、是否顯示現場預約）。

預約可來自 YSCP Web 或現場 Kiosk（若設定開啟）。現場預約送出後不顯示密碼，須等內部確認；確認後訪客再用密碼或手機報到。

### 2.1 訪客預約

1. 選擇部門 → 載入被訪人。
2. 填寫姓或名（二選一）、Email、手機（必填）；公司、車牌、事由、時段（選填／預設當日 09:00–18:00）。
3. 後端建立 YSCP 預約（可帶 `plateNo`），再讀自動審核設定，顯示「等待內部確認」。
4. 不需同意訪客須知。

### 2.2 訪客報到（含臨時外出返回）

1. 數字鍵盤輸入預約密碼或手機號碼。
2. 若該訪客為 **臨時外出中**：回傳在廠記錄，畫面顯示「臨時外出」，可「確認返回」（無需再同意須知、不重打 YSCP 簽到）。
3. 否則查當天前後一日預約，只允許 `appointStatus = 0`（待簽到）。
4. 多筆時由訪客點選；確認後須同意訪客須知。
5. 後端簽到，並非同步呼叫權限重發（失敗不擋報到）。
6. 畫面顯示「報到成功，請等候帶領」；不顯示 QR Code。
7. 若已在場（非臨時外出）：提示改走「訪客簽退」。

### 2.3 訪客簽退（正式／臨時外出）

1. 輸入預約密碼或手機號碼；回傳**全部**符合的在廠者（共乘可勾選）。
2. 每筆含 `presence: "on_site" | "temp_out"` 與選填 `plateNo`。
3. **在場**：可選「臨時外出」或「正式簽退」。
4. **臨時外出中**：僅可「正式簽退」；返回請走訪客報到。
5. 模式：
   - `temp`：只寫 YSOP `TEMP_OUT`（出場允許名單），**不**呼叫 `visitor/out`、**不**在按鈕當下開閘。入口 LPR 維持預約時段。返回須至訪客報到。
   - `return`：由訪客報到呼叫，清除 `TEMP_OUT`；YSCP 不需異動。
   - `final`：呼叫 `visitor/out`、清除 `TEMP_OUT`、記今日離場（出場允許名單）；人員門禁撤銷。入口車牌時段仍由 YSCP 控管至預約結束。按鈕當下不開閘。
6. **出口開閘**：車輛抵達出口 LPR → HCP 推送事件 131622 → YSOP Webhook 比對 `TEMP_OUT`／當日 `departedToday` 車牌 → 呼叫 `alarmOutput/controlling` 開閘。

無操作倒數秒數由 `NEXT_PUBLIC_KIOSK_IDLE_SECONDS` 控制（預設 20）。

### 2.4 人員狀態（YSOP 疊加）

| 狀態 | 來源 |
|------|------|
| 待報到 | YSCP `appointStatus = 0`（首頁統計不顯示） |
| ON_SITE | YSCP 在廠且不在 YSOP 外出清單 |
| TEMP_OUT | YSCP 仍在廠，YSOP 已記臨時外出 |
| CHECKED_OUT | 已呼叫 `visitor/out`，並記入今日離場 |

車輛狀態僅作紀錄欄位顯示車牌；不再另計「場內車／外出車」統計。

### 2.5 本機設定與訪客紀錄

設定（無需登入，寫入本機檔）：

| 項目 | 說明 |
|------|------|
| 跑馬燈 | 空則回退 `NEXT_PUBLIC_KIOSK_MARQUEE`／預設文案 |
| 顯示模式 | `theme`: `light`｜`dark`，預設 `light`；寫入 cookie 供首屏套用 |
| 公司 logo | 上傳至 `data/kiosk-logo.*`；未設定則用 `public/yenshow-logo.svg` |
| 顯示訪客預約 | `showAppoint`，預設 true |

訪客紀錄對話框：上方今日摘要（與 stats 同源）＋明細表（在場／臨時外出／今日離場）。可篩選狀態、搜尋姓名／手機／車牌、分頁。不匯出 CSV、無截圖。

---

## 3. Kiosk API

前端只呼叫下列路由。成功：`{ "code": "0", "msg": "Success", "data": ... }`；失敗：`code` 為 HTTP 狀態字串，`data` 為 `null`。

| 方法 | 路徑 | 用途 |
|------|------|------|
| GET | `/api/kiosk/status` | 是否已設定 YSCP 金鑰 |
| GET | `/api/kiosk/stats` | 在場／臨時外出／今日離場（含車輛數） |
| GET | `/api/kiosk/records` | 訪客紀錄明細（在場／外出／今日離場） |
| GET | `/api/kiosk/settings` | 本機設定視圖（跑馬燈、主題、預約開關、logoUrl）；並 Set-Cookie `theme` |
| PUT | `/api/kiosk/settings` | 更新 `{ marquee?, showAppoint?, theme? }`；並 Set-Cookie `theme` |
| GET | `/api/kiosk/settings/logo` | 自訂 logo 二進位（無則 404） |
| POST | `/api/kiosk/settings/logo` | multipart 上傳 `file`；或 `reset=1` 恢復預設 |
| GET | `/api/kiosk/notice` | 訪客須知 Markdown（`content/visitor-notice.md`） |
| GET | `/api/kiosk/orgs` | 部門清單（含路徑標籤） |
| POST | `/api/kiosk/hosts` | 依部門載入被訪人 `{ orgIndexCode }` |
| POST | `/api/kiosk/appoint` | 建立預約（可含 `plateNo`，無需須知） |
| POST | `/api/kiosk/verify` | 報到查詢 `{ query }`（密碼或手機）；臨時外出中回 `tempOutRecords` |
| POST | `/api/kiosk/checkin` | 報到 `{ token, acceptedNotice: true }` |
| POST | `/api/kiosk/checkout/lookup` | 簽退查詢 `{ query }` → 全部匹配 |
| POST | `/api/kiosk/checkout` | `{ token, mode?: "temp"\|"return"\|"final" }`（`return` 由報到畫面呼叫；只寫名單，不開閘） |
| POST | `/api/kiosk/hcp/subscribe` | 手動向 YSCP 重訂車牌事件 131622 |
| POST | `/api/hcp/events` | HCP 事件 Webhook（校驗 token → 立即 200 → 背景比對開閘） |

### 3.1 預約 `POST /api/kiosk/appoint`

必填：`receptionistId`、`email`、`phoneNo`、`appointStartTime`、`appointEndTime`；`visitorFamilyName`／`visitorGivenName` 至少其一。  
選填：`companyName`、`plateNo`、`visitReasonType`、`gender`。

姓／名在 Kiosk 為二選一；YSCP OpenAPI 建立預約／報到不接受空欄，空的一邊寫入 `-`。畫面不顯示 `-`。  
`visitReasonType === 4`（施工）時帶 `visitReasonDetail: "施工"`。  
車牌正規化後以 `plateNo` 帶入 `VisitorInfo`（若 YSCP 拒收該欄位，需改為僅 YSOP 保存並註記）。  
回傳含黑名單 `watchListInfo` 時回 409。不把 `AppointCode` 回給前端。

### 3.2 報到查詢 `POST /api/kiosk/verify`

`query` 依長度判斷為手機（8–15 位數字，`886` 轉 `0` 開頭）或預約密碼。  
不傳 `appointState`。同時查在廠記錄：若為臨時外出，回 `tempOutRecords`（含 checkout token，供確認返回）。否則本端再比對密碼／手機，並只回待簽到。

回傳待簽到每筆含 `token`、顯示欄位與選填 `plateNo`。

### 3.3 簽退查詢 `POST /api/kiosk/checkout/lookup`

密碼：先查預約取得 `visitorId`／手機／車牌，再對在廠清單過濾。  
手機：直接對在廠清單過濾。  
回傳全部匹配；每筆含 `presence`、`plateNo`、`token`。

### 3.4 簽退 `POST /api/kiosk/checkout`

`mode` 預設 `final`。只更新本機出場允許名單（`tempOut`／`departedToday`）；實際開閘由出口 LPR 事件經 `/api/hcp/events` 觸發。

### 3.5 統計 `GET /api/kiosk/stats`

```json
{
  "onSite": 0,
  "tempOut": 0,
  "departedToday": 0
}
```

公式：YSCP 在廠清單 − TEMP_OUT = onSite；TEMP_OUT 與在廠交集 = tempOut；departedToday 為當日台北日正式簽退筆數。重啟後與 YSCP 在廠清單對帳。車牌於報到／預約時寫入本機快取，因 YSCP 列表常回空 `plateNo`。

### 3.6 訪客紀錄 `GET /api/kiosk/records`

回傳 `{ summary, rows }`。`summary` 同 stats；`rows` 含 `presence`（`on_site`｜`temp_out`｜`departed`）、姓名、手機、車牌、公司、被訪人、時間。在場／外出來自 YSCP 在廠＋presence；離場來自 `departedToday`。

### 3.7 本機設定

- 頁面：`/setting`
- `GET /api/kiosk/settings` → `{ marquee, resolvedMarquee, showAppoint, theme, hasCustomLogo, logoUrl }`（並 Set-Cookie `theme`）
- `PUT /api/kiosk/settings` → 更新文字、預約開關、主題（並 Set-Cookie `theme`）
- `POST /api/kiosk/settings/logo` → 上傳（PNG／JPG／SVG／WebP，≤2MB）或 `reset=1`

---

## 4. YSCP Artemis API

協定：HTTPS POST，`Content-Type: application/json;charset=UTF-8`。  
成功：`code === "0"`。

### 4.1 簽章

```
HMAC-SHA256(SK, "POST\napplication/json\napplication/json;charset=UTF-8\n{path}") → Base64
```

Header：`Accept`、`Content-Type`、`X-Ca-Key`（AK）、`X-Ca-Signature`。不送 `userId`。

### 4.2 實際呼叫

| 用途 | 路徑 |
|------|------|
| 建立預約 | `/artemis/api/visitor/v2/appointment` |
| 自動審核設定 | `/artemis/api/visitor/v1/visitorConfig/automaticApproval` |
| 查預約 | `/artemis/api/visitor/v1/appointment/appointmentlist` |
| 簽到 | `/artemis/api/visitor/v1/registerment` |
| 權限重發 | `/artemis/api/visitor/v1/auth/reapplication` |
| 在廠登記 | `/artemis/api/visitor/v1/register/getVistorRegisterRecord`（官方拼寫少一個 i） |
| 簽退 | `/artemis/api/visitor/v1/visitor/out` |
| 部門 | `/artemis/api/resource/v1/org/orgList` |
| 人員 | `/artemis/api/resource/v1/person/advance/personList` |
| 事件訂閱 | `/artemis/api/eventService/v1/eventSubscriptionByEventTypes`（`eventTypes: [131622]`） |
| 出口開閘 | `/artemis/api/resource/v1/alarmOutput/controlling`（`action: 1`） |

**建立預約** 可含 `VisitorInfo.plateNo`。

**簽退** 僅正式簽退呼叫；臨時外出不呼叫。

### 4.3 出口 LPR 事件開閘

1. 啟動時（`src/instrumentation.ts`）或手動 `POST /api/kiosk/hcp/subscribe`：向 YSCP 訂閱 `131622`，`eventDest`＝`HCP_EVENT_DEST`，`token`＝`HCP_EVENT_TOKEN`。
2. YSCP 推送至 `POST /api/hcp/events`：校驗 token 後立即回 200，背景以 `after()` 處理。
3. 僅處理 `HCP_EXIT_LANES` 內的出口相機；比對 `tempOut`／當日 `departedToday` 車牌。
4. 同車牌＋同相機 `HCP_GATE_DEDUP_MS`（預設 5 秒）內不重複開閘。
5. 比對成功則呼叫對應 `alarmOutputIndexCode` 開閘。

**網路前提：** YSCP 伺服器必須能連到 kiosk 的 `HCP_EVENT_DEST`（多為 HTTPS）。

### 4.4 來訪事由

| 值 | Kiosk 顯示 |
|----|------------|
| 0 | 商務 |
| 1 | 培訓 |
| 2 | 來訪 |
| 3 | 會議 |
| 4 | 施工 |

報到時 `visitPurposeType` 沿用預約的 `visitReasonType`。

---

## 5. 環境變數

只使用 `.env`（見 `.env.example`）。

| 變數 | 說明 |
|------|------|
| `HCP_HOST` | Artemis 主機（可含埠） |
| `HCP_PORT` | HTTPS 埠，預設 443 |
| `HCP_AK` / `HCP_SK` | OpenAPI 金鑰 |
| `HCP_REJECT_UNAUTHORIZED` | 自簽憑證設 `false` |
| `HCP_TIMEOUT_MS` | 逾時毫秒，預設 30000 |
| `HCP_EVENT_DEST` | HCP 推送 Webhook 完整 URL（例：`https://ip:3010/api/hcp/events`） |
| `HCP_EVENT_TOKEN` | 訂閱／推送校驗用自訂 token |
| `HCP_EXIT_LANES` | JSON：`[{"cameraIndexCode":"...","alarmOutputIndexCode":"..."}]` |
| `HCP_GATE_DEDUP_MS` | 開閘去重毫秒，預設 5000 |
| `NEXT_PUBLIC_KIOSK_IDLE_SECONDS` | 倒數回首頁，預設 20 |
| `NEXT_PUBLIC_NOTICE_VIDEO_URL` | 須知影片（YouTube／檔案／資料夾） |
| `NEXT_PUBLIC_KIOSK_MARQUEE` | 首頁跑馬燈 |

開發埠固定 3010。

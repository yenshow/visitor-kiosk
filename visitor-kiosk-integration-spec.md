# 訪客服務機 × HikCentral Professional 整合規格

獨立訪客服務機（**YSOP** / Visitor Kiosk）透過 Next.js 後端代理對接 HikCentral Professional（**YSCP = HCP**）Artemis OpenAPI。前端不可直打 Artemis。

約定：入口 LPR 時段權限由 YSCP（HCP）在預約核准後下發；YSOP **不能**提早作廢入口車牌權限。

## 1. 系統架構

```
[ YSOP 前端 ]  →  [ Next.js /api/kiosk/* ]  →  [ YSCP Artemis HTTPS ]
```

- 金鑰與簽章只存在後端（`.env` 的 `HCP_AK` / `HCP_SK`；環境變數前綴仍為 HCP）。
- 時區一律 `Asia/Taipei`（ISO 8601 `+08:00`）。
- 報到／簽退下一步動作用一次性 token（記憶體、10 分鐘）；前端不帶 `appointID` 直打 Artemis。
- YSOP 本地狀態檔：`data/kiosk-presence.json`（臨時外出、今日離場）。
- **前端對外敘述一律稱 YSCP**；程式碼／環境變數可保留 HCP 前綴。

## 2. 業務流程

首頁三個入口：**訪客報到**、**訪客簽退**、**訪客預約**；並顯示統計：目前在場、臨時外出、今日離場（有車牌時附場內車／外出車）。

預約可來自 YSCP Web 或現場 Kiosk。現場預約送出後不顯示密碼，須等內部確認；確認後訪客再用密碼或手機報到。

### 2.1 訪客預約

1. 選擇部門 → 載入被訪人。
2. 填寫姓或名（二選一）、Email、手機（必填）；公司、車牌、事由、時段（選填／預設當日 09:00–18:00）。
3. 後端建立 YSCP 預約（可帶 `plateNo`），再讀自動審核設定，顯示「等待內部確認」。
4. 不需同意訪客須知。

### 2.2 訪客報到

1. 數字鍵盤輸入預約密碼或手機號碼。
2. 後端查當天前後一日預約，只允許 `appointStatus = 0`（待簽到）。
3. 多筆時由訪客點選；確認後須同意訪客須知。
4. 後端簽到，並非同步呼叫權限重發（失敗不擋報到）。
5. 畫面顯示「報到成功，請等候帶領」；不顯示 QR Code。

### 2.3 訪客簽退（正式／臨時外出／返回）

1. 輸入預約密碼或手機號碼；回傳**全部**符合的在廠者（共乘可勾選）。
2. 每筆含 `presence: "on_site" | "temp_out"` 與選填 `plateNo`。
3. **在場**：可選「臨時外出」或「正式簽退」。
4. **臨時外出中**：可選「確認返回」或「正式簽退」。
5. 模式：
   - `temp`：只寫 YSOP `TEMP_OUT`，嘗試出口一次性放行（adapter，未接 API 時 no-op），**不**呼叫 `visitor/out`。入口 LPR 維持預約時段。
   - `return`：清除 `TEMP_OUT`；YSCP 不需異動。
   - `final`：呼叫 `visitor/out`、清除 `TEMP_OUT`、記今日離場；人員門禁撤銷。入口車牌時段仍由 YSCP 控管至預約結束。

無操作倒數秒數由 `NEXT_PUBLIC_KIOSK_IDLE_SECONDS` 控制（預設 20）。

### 2.4 人員狀態（YSOP 疊加）

| 狀態 | 來源 |
|------|------|
| 待報到 | YSCP `appointStatus = 0`（首頁統計不顯示） |
| ON_SITE | YSCP 在廠且不在 YSOP 外出清單 |
| TEMP_OUT | YSCP 仍在廠，YSOP 已記臨時外出 |
| CHECKED_OUT | 已呼叫 `visitor/out`，並記入今日離場 |

車輛（有車牌才計）：ON_SITE → 場內；TEMP_OUT → 外出中。

---

## 3. Kiosk API

前端只呼叫下列路由。成功：`{ "code": "0", "msg": "Success", "data": ... }`；失敗：`code` 為 HTTP 狀態字串，`data` 為 `null`。

| 方法 | 路徑 | 用途 |
|------|------|------|
| GET | `/api/kiosk/status` | 是否已設定 YSCP 金鑰 |
| GET | `/api/kiosk/stats` | 在場／臨時外出／今日離場（含車輛數） |
| GET | `/api/kiosk/notice` | 訪客須知 Markdown（`content/visitor-notice.md`） |
| GET | `/api/kiosk/orgs` | 部門清單（含路徑標籤） |
| POST | `/api/kiosk/hosts` | 依部門載入被訪人 `{ orgIndexCode }` |
| POST | `/api/kiosk/appoint` | 建立預約（可含 `plateNo`，無需須知） |
| POST | `/api/kiosk/verify` | 報到查詢 `{ query }`（密碼或手機） |
| POST | `/api/kiosk/checkin` | 報到 `{ token, acceptedNotice: true }` |
| POST | `/api/kiosk/checkout/lookup` | 簽退查詢 `{ query }` → 全部匹配 |
| POST | `/api/kiosk/checkout` | `{ token, mode?: "temp"\|"return"\|"final" }` |

### 3.1 預約 `POST /api/kiosk/appoint`

必填：`receptionistId`、`email`、`phoneNo`、`appointStartTime`、`appointEndTime`；`visitorFamilyName`／`visitorGivenName` 至少其一。  
選填：`companyName`、`plateNo`、`visitReasonType`、`gender`。

姓／名在 Kiosk 為二選一；YSCP OpenAPI 建立預約／報到不接受空欄，空的一邊寫入 `-`。畫面不顯示 `-`。  
`visitReasonType === 4`（施工）時帶 `visitReasonDetail: "施工"`。  
車牌正規化後以 `plateNo` 帶入 `VisitorInfo`（若 YSCP 拒收該欄位，需改為僅 YSOP 保存並註記）。  
回傳含黑名單 `watchListInfo` 時回 409。不把 `AppointCode` 回給前端。

### 3.2 報到查詢 `POST /api/kiosk/verify`

`query` 依長度判斷為手機（8–15 位數字，`886` 轉 `0` 開頭）或預約密碼。  
不傳 `appointState`。本端再比對密碼／手機，並只回待簽到。

回傳每筆含 `token`、顯示欄位與選填 `plateNo`。

### 3.3 簽退查詢 `POST /api/kiosk/checkout/lookup`

密碼：先查預約取得 `visitorId`／手機／車牌，再對在廠清單過濾。  
手機：直接對在廠清單過濾。  
回傳全部匹配；每筆含 `presence`、`plateNo`、`token`。

### 3.4 簽退 `POST /api/kiosk/checkout`

`mode` 預設 `final`。出口放行走 `requestVehicleExit(plateNo, mode)`（目前 no-op）。

### 3.5 統計 `GET /api/kiosk/stats`

```json
{
  "onSite": 0,
  "tempOut": 0,
  "departedToday": 0,
  "vehicles": { "onSite": 0, "outing": 0 }
}
```

公式：YSCP 在廠清單 − TEMP_OUT = onSite；TEMP_OUT 與在廠交集 = tempOut；departedToday 為當日台北日正式簽退筆數。重啟後與 YSCP 在廠清單對帳。

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
| 出口 LPR 放行 | （待確認；現由 `vehicle-exit` adapter no-op） |

**建立預約** 可含 `VisitorInfo.plateNo`。

**簽退** 僅正式簽退呼叫；臨時外出不呼叫。

### 4.3 來訪事由

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
| `NEXT_PUBLIC_KIOSK_IDLE_SECONDS` | 倒數回首頁，預設 20 |
| `NEXT_PUBLIC_NOTICE_VIDEO_URL` | 須知影片（YouTube／檔案／資料夾） |
| `NEXT_PUBLIC_KIOSK_MARQUEE` | 首頁跑馬燈 |

開發埠固定 3010。

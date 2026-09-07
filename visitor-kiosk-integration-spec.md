# 訪客服務機 × HikCentral Professional 整合規格

獨立訪客服務機（Visitor Kiosk）透過 Next.js 後端代理對接 HikCentral Professional（HCP）Artemis OpenAPI。前端不可直打 Artemis。

## 1. 系統架構

```
[ Kiosk 前端 ]  →  [ Next.js /api/kiosk/* ]  →  [ HCP Artemis HTTPS ]
```

- 金鑰與簽章只存在後端（`.env` 的 `HCP_AK` / `HCP_SK`）。
- 時區一律 `Asia/Taipei`（ISO 8601 `+08:00`）。
- 報到／簽退不把 `appointID`、`visitorId`、`appointRecordId` 交給前端；查詢成功後發一次性 token（記憶體、10 分鐘）。

## 2. 業務流程

首頁三個入口：**訪客報到**、**訪客簽退**、**訪客預約**。

預約可來自 HCP Web 或現場 Kiosk。現場預約送出後不顯示密碼，須等內部確認；確認後訪客再用密碼或手機報到。

### 2.1 訪客預約

1. 選擇部門 → 載入被訪人。
2. 填寫姓名、Email、手機（必填）；公司、事由、時段（選填／預設當日 09:00–18:00）。
3. 後端建立 HCP 預約，再讀自動審核設定，顯示「等待內部確認」。
4. 不需同意訪客須知。

### 2.2 訪客報到

1. 數字鍵盤輸入預約密碼或手機號碼。
2. 後端查當天前後一日預約，只允許 `appointStatus = 0`（待簽到）。
3. 多筆時由訪客點選；確認後須同意訪客須知。
4. 後端簽到，並非同步呼叫權限重發（失敗不擋報到）。
5. 畫面顯示「報到成功，請等候帶領」；不顯示 QR Code。

### 2.3 訪客簽退

1. 輸入預約密碼或手機號碼。
2. 後端查在廠登記（`visitorStatus = 0`），本端再依訪客／手機過濾。
3. 確認後撤銷門禁／通道／電梯權限。

無操作倒數秒數由 `NEXT_PUBLIC_KIOSK_IDLE_SECONDS` 控制（預設 20）。

---

## 3. Kiosk API

前端只呼叫下列路由。成功：`{ "code": "0", "msg": "Success", "data": ... }`；失敗：`code` 為 HTTP 狀態字串，`data` 為 `null`。

| 方法 | 路徑 | 用途 |
|------|------|------|
| GET | `/api/kiosk/status` | 是否已設定 HCP 金鑰 |
| GET | `/api/kiosk/notice` | 訪客須知 Markdown（`content/visitor-notice.md`） |
| GET | `/api/kiosk/orgs` | 部門清單（含路徑標籤） |
| POST | `/api/kiosk/hosts` | 依部門載入被訪人 `{ orgIndexCode }` |
| POST | `/api/kiosk/appoint` | 建立預約（無需須知） |
| POST | `/api/kiosk/verify` | 報到查詢 `{ query }`（密碼或手機） |
| POST | `/api/kiosk/checkin` | 報到 `{ token, acceptedNotice: true }` |
| POST | `/api/kiosk/checkout/lookup` | 簽退查詢 `{ query }` |
| POST | `/api/kiosk/checkout` | 簽退 `{ token }` |

### 3.1 預約 `POST /api/kiosk/appoint`

必填：`receptionistId`、`visitorName`（或 `visitorGivenName`）、`email`、`phoneNo`、`appointStartTime`、`appointEndTime`。  
選填：`companyName`、`visitReasonType`、`gender`。

姓名整段寫入 HCP 姓；名固定為 `-`（OpenAPI 不接受空名）。  
`visitReasonType === 4`（施工）時帶 `visitReasonDetail: "施工"`。  
回傳含黑名單 `watchListInfo` 時回 409。不把 `AppointCode` 回給前端。

### 3.2 報到查詢 `POST /api/kiosk/verify`

`query` 依長度判斷為手機（8–15 位數字，`886` 轉 `0` 開頭）或預約密碼。  
不傳 `appointState`（此環境數字 `0` 常空回；字串 `"0"` 會混入已結束）。本端再比對密碼／手機，並只回待簽到。

`appointStatus`：`0` 待簽到；`1` 審核中；`2` 未通過；`3`／`4` 已報到或已結束。

回傳每筆含 `token` 與顯示欄位（姓名、電話、公司、事由、被訪人、時段），不含 HCP ID。

### 3.3 簽退查詢 `POST /api/kiosk/checkout/lookup`

密碼：先查預約取得 `visitorId`／手機，再對在廠清單過濾。  
手機：直接對在廠清單的 `phoneNum`／`phoneNo` 過濾。  
HCP 可能忽略電話／訪客 ID 篩選，必須本端再過濾。

---

## 4. HCP Artemis API

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

**建立預約** `receptionistId`、時段、`visitReasonType`、`visitorInfoList[].VisitorInfo`（姓／名／性別／公司／手機／Email）。

**查預約** `pageNo`、`pageSize`、`appointStartTime`／`appointEndTime`（前後一日 00:00–23:59），可加 `appointCode` 或 `phoneNo`。報到／簽退查密碼時不帶 `appointState`。

**簽到** `appointId`（對應查詢的 `appointID`）、`visitorId`、實際 `visitStartTime`、預約結束或當日 23:59:59、`visitPurposeType`、`visitorInfoList`。姓／名不可空。

**權限重發** `{ "personIds": "<visitorId>", "ImmediateDownload": 0 }`，簽到成功後 fire-and-forget。

**在廠登記** `visitStartTime`／`visitEndTime`（前一日 00:00 至當日 23:59）、`visitorStatus: "0"`、`sortField: "visitingTime"`、`orderType: "1"`。實際欄位多在 `visitorBaseInfo`（`fullName`、`phoneNum`）。`recordId` 即簽退用的 `appointRecordId`。

**簽退** `{ "appointRecordId": "<recordId>" }`。

**部門／被訪人** 部門分頁至齊，快取 60 秒，標籤含上層路徑。人員帶 `orgIndexCode` 與 `isSubOrg: true`；部分版本忽略組織篩選，本端再以選定部門及其子孫過濾。

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

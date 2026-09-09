# 訪客服務機 × YSCP 整合規格

獨立訪客服務機（**YSOP**）後端代理對接 Yenshow Central Professional（**YSCP**）Artemis OpenAPI。前端不可直打 Artemis。

入場車牌時段由 YSCP 在預約核准後下發；YSOP **不**控入場開閘、**不能**提早作廢入口權限。出場：簽退／臨時外出寫本機名單 → 出口 LPR 事件 → YSOP 開閘。

設定與環境變數見 [env-setup.md](./env-setup.md)。

## 1. 架構

```
[ YSOP 前端 ]  →  [ /api/kiosk/* ]  →  [ YSCP Artemis HTTPS ]
[ 出口 LPR ]   →  [ YSCP 事件推送 ]  →  [ /api/yscp/events ] → 名單比對 → alarmOutput 開閘
```

- 金鑰與簽章只在後端（`YSCP_AK` / `YSCP_SK`）。時區 `Asia/Taipei`。
- 報到／簽退下一步用一次性 token（記憶體、10 分鐘）；前端不帶 `appointID`。
- 本機：`data/kiosk-presence.json`（臨時外出、今日離場、開閘名單）、`data/kiosk-settings.json`、`data/kiosk-logo.*`。設定頁 `/setting`。
- 無操作 20 秒回首頁。

## 2. 業務流程

首頁：**訪客報到**、**訪客簽退**、可關閉的**訪客預約**；統計格開啟訪客紀錄。預約可來自 YSCP Web 或現場 Kiosk；現場送出後不顯示密碼，待內部確認。

### 2.1 預約

部門 → 被訪人 → 姓或名（二選一）、Email、手機必填；公司、車牌、事由、時段選填（預設當日 09:00–18:00）。建立 YSCP 預約後顯示「等待內部確認」。不需訪客須知。

### 2.2 報到（含臨時外出返回）

密碼或手機。臨時外出中：顯示「臨時外出」，「確認返回」不必再同意須知、不重打 YSCP 簽到。否則只允許當日前後一日、`appointStatus = 0`。多筆由訪客點選；確認後同意須知並簽到（權限重發失敗不擋）。成功畫面不顯示 QR。已在場（非外出）改走簽退。

### 2.3 簽退

回傳全部匹配（共乘可勾選），含 `presence`、`plateNo`。

| 模式 | 行為 |
|------|------|
| `temp` | 只寫本機 `TEMP_OUT`。不呼叫 `visitor/out`、不開閘。入口時段仍由 YSCP 管。返回走報到。 |
| `return` | 報到畫面呼叫，清 `TEMP_OUT`。YSCP 不異動。 |
| `final`（預設） | `visitor/out`、清 `TEMP_OUT`、記今日離場。按鈕當下不開閘。 |

開閘：出口 LPR → YSCP 推 131622 → `/api/yscp/events` 比對 `TEMP_OUT`／當日離場車牌 → `alarmOutput/controlling`。

### 2.4 人員狀態

| 狀態 | 來源 |
|------|------|
| 待報到 | YSCP `appointStatus = 0`（首頁統計不顯示） |
| ON_SITE | YSCP 在廠且不在本機外出清單 |
| TEMP_OUT | YSCP 仍在廠，本機已記臨時外出 |
| CHECKED_OUT | 已 `visitor/out`，記入今日離場 |

車牌僅顯示；不另計場內車／外出車。

### 2.5 本機設定與紀錄

`/setting` 無需登入：跑馬燈（空則 `NEXT_PUBLIC_KIOSK_MARQUEE`）、主題 `light`｜`dark`（cookie + `public/theme-init.js`）、logo（無則 `public/yenshow-logo.svg`）、`showAppoint`。訪客紀錄：今日摘要＋明細，可篩選／搜尋／分頁；不匯出。

## 3. Kiosk API

前端只呼叫下列路由。成功 `{ "code": "0", "msg": "Success", "data": ... }`；失敗 `code` 為 HTTP 狀態字串，`data` 為 `null`。

| 方法 | 路徑 | 用途 |
|------|------|------|
| GET | `/api/kiosk/status` | 是否已設定 YSCP 金鑰 |
| GET | `/api/kiosk/stats` | 在場／臨時外出／今日離場 |
| GET | `/api/kiosk/records` | 訪客紀錄 `{ summary, rows }` |
| GET / PUT | `/api/kiosk/settings` | 跑馬燈、主題、預約開關；Set-Cookie `theme` |
| GET / POST | `/api/kiosk/settings/logo` | 讀取／上傳／`reset=1`（≤2MB） |
| GET | `/api/kiosk/notice` | 訪客須知 Markdown |
| GET | `/api/kiosk/orgs` | 部門（含路徑標籤） |
| POST | `/api/kiosk/hosts` | `{ orgIndexCode }` 載入被訪人 |
| POST | `/api/kiosk/appoint` | 建立預約 |
| POST | `/api/kiosk/verify` | 報到查詢 `{ query }`；外出中回 `tempOutRecords` |
| POST | `/api/kiosk/checkin` | `{ token, acceptedNotice: true }` |
| POST | `/api/kiosk/checkout/lookup` | 簽退查詢 `{ query }` |
| POST | `/api/kiosk/checkout` | `{ token, mode?: "temp"\|"return"\|"final" }`，不開閘 |
| POST | `/api/kiosk/yscp/subscribe` | 重訂事件 131622 |
| POST | `/api/yscp/events` | YSCP Webhook（先 200，背景開閘） |

**預約** 必填 `receptionistId`、`email`、`phoneNo`、時段；姓／名至少其一。空的姓或名寫入 `-`（畫面隱藏）。施工 `visitReasonType === 4` 帶 `visitReasonDetail: "施工"`。車牌正規化後放 `VisitorInfo.plateNo`。黑名單 `watchListInfo` 回 409。不回傳 `AppointCode`。

**verify** `query`：8–15 位數字視為手機（`886` 轉 `0` 開頭），否則為密碼。

**stats**：YSCP 在廠 − TEMP_OUT = `onSite`；TEMP_OUT ∩ 在廠 = `tempOut`；`departedToday` 為當日台北日正式簽退。車牌靠本機快取（YSCP 列表常空）。

## 4. YSCP Artemis

HTTPS POST，`Content-Type: application/json;charset=UTF-8`。成功 `code === "0"`。

簽章：`HMAC-SHA256(SK, "POST\napplication/json\napplication/json;charset=UTF-8\n{path}")` → Base64。Header：`Accept`、`Content-Type`、`X-Ca-Key`、`X-Ca-Signature`。

| 用途 | 路徑 |
|------|------|
| 建立預約 | `/artemis/api/visitor/v2/appointment`（可含 `plateNo`） |
| 自動審核 | `/artemis/api/visitor/v1/visitorConfig/automaticApproval` |
| 查預約 | `/artemis/api/visitor/v1/appointment/appointmentlist` |
| 簽到 | `/artemis/api/visitor/v1/registerment` |
| 權限重發 | `/artemis/api/visitor/v1/auth/reapplication` |
| 在廠登記 | `/artemis/api/visitor/v1/register/getVistorRegisterRecord`（官方少一個 i） |
| 簽退 | `/artemis/api/visitor/v1/visitor/out`（僅正式簽退） |
| 部門／人員 | `/artemis/api/resource/v1/org/orgList`、`.../person/advance/personList` |
| 事件訂閱 | `/artemis/api/eventService/v1/eventSubscriptionByEventTypes`（`131622`） |
| 開閘 | `/artemis/api/resource/v1/alarmOutput/controlling`（`action: 1`） |

出口開閘：啟動或 `POST /api/kiosk/yscp/subscribe` 訂閱 → YSCP 推 `POST /api/yscp/events` → 只處理 `YSCP_EXIT_LANES` 相機、比對出場名單、5 秒去重後開閘。YSCP 須能連到 `YSCP_EVENT_DEST`（區網請用 HTTP，避免自簽 HTTPS 握手失敗）。

來訪事由：0 商務、1 培訓、2 來訪、3 會議、4 施工。報到 `visitPurposeType` 沿用預約 `visitReasonType`。

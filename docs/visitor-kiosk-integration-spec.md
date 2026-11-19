# YSOP Kiosk 獨立訪客機規格

獨立訪客機（**YSOP Kiosk**）本機完成預約／報到／簽退。前端只打 `/api/kiosk/*`。本期**不控門禁、不開閘**。

時區 `Asia/Taipei`。

```
[ Kiosk 前端 ]  →  [ /api/kiosk/* ]  →  [ 本機 JSON ]
```

- 報到／簽退下一步用一次性 token（記憶體、10 分鐘）；前端不帶 `appointID`。
- 本機：`data/kiosk-presence.json`（`visits[]`）、`data/kiosk-appointments.json`、`data/kiosk-directory.json`、`data/kiosk-settings.json`、`data/kiosk-logo.*`、`data/audit.log`。設定頁 `/setting`（僅本機或 `KIOSK_ADMIN_IPS`）。
- 無操作 20 秒回首頁。
- 管理 API／紀錄／設定／人員目錄寫入需管理員 IP。
- 查詢 API 有 rate limit 與失敗鎖定；管理操作寫入 `data/audit.log`（不含個資）。

## 2. 業務流程

首頁：**訪客報到**、**訪客簽退**、可關閉的**訪客預約**；統計「目前在場／臨時外出／今日離場」**僅顯示數字，不開啟明細**（訪客紀錄在設定頁，與重置並排；可篩「全部／逾期在場／所有離場」；**逾期在場不顯示於首頁統計列**）。預約於現場 Kiosk 建立，**自動核准**，成功畫面顯示預約碼。

**查詢（單一輸入框）：** 8～15 碼純數字視為手機（整號比對，共乘可多人）；其餘視為 **4 碼**預約碼（僅精準比對 `appointCode` 或 `appointID`）。預約碼查在場只鎖 `visitorId`，不以同手機帶出他人。逾期不自動簽退。

### 2.1 預約

部門 → 被訪人（來自設定頁人員目錄）→ 姓或名（二選一）、Email、手機必填；公司、車牌、事由選填。**現場預約時段僅限當日**（開始／結束時間不可跨日；預設 09:00–18:00）。建立後立即核准，顯示預約碼。不需訪客須知。

### 2.2 報到（含臨時外出返回）

預約碼或手機。臨時外出中：顯示「臨時外出」；**當日**返回「確認返回」不必再同意須知、不重打簽到；**跨日（翌日）返回須再同意訪客須知**後確認返回。否則查預約窗口為前 30 日～後 30 日、`appointStatus = 0`。多筆由訪客點選；確認後同意須知並簽到。成功畫面不顯示 QR。已在場（非外出）改走簽退。

### 2.3 簽退

回傳全部匹配（共乘可勾選），含 `presence`、`plateNo`。

| 模式 | 行為 |
|------|------|
| `temp` | 本機 visit → `temp_out`（寫 `tempOutAt`，保留完整欄位）。返回走報到。 |
| `return` | 報到畫面呼叫，visit → `on_site`（清 `tempOutAt`）。 |
| `final`（預設） | visit → `departed`（寫 `departedAt`，保留完整欄位）；預約標為已結束。 |

本期不開閘。

### 2.4 人員狀態

| 狀態 | 來源 |
|------|------|
| 待報到 | 本機 `appointStatus = 0`（首頁統計不顯示） |
| on_site（目前在場） | 來訪結束時間未過、本機非 departed；且非逾期分類 |
| temp_out（臨時外出） | 結束時間未過、本機 `status=temp_out` |
| overstay（逾期在場） | 已過來訪結束時間仍 `on_site`／`temp_out`。**不含**在「目前在場」計數；可簽退，UI 提示逾時 |
| departed（已離場） | 正式簽退後本機累積；**首頁「今日離場」**僅計 `departedAt` 為台北今日；「所有離場／全部」含跨日 |

報到成功時本機 visit 寫入 `visitEndTime`（通常＝`appointEndTime`）。

車牌僅顯示；不另計場內車／外出車。

### 2.5 本機設定與紀錄

`/setting` 僅本機或 `KIOSK_ADMIN_IPS`：跑馬燈（空則寫死預設文案）、主題 `light`｜`dark`（cookie + `public/theme-init.js`）、logo（無則 `public/yenshow-logo.svg`）、`showAppoint`、**部門／被訪人**（與訪客紀錄並列的按鈕，dialog 內 CRUD）、**訪客紀錄**、**重置訪客統計**（清空 `kiosk-presence.json` 全部 visits：on_site／temp_out／departed 歸零；不刪目錄與未報到預約）。訪客紀錄：統計摘要＋明細（姓名／手機／車牌／公司／被訪人／時間），可篩全部／目前在場／臨時外出／逾期在場／今日離場／所有離場；不匯出。

本機主檔：`{ visits: VisitorVisit[] }`、`{ appointments: AppointmentItem[] }`、`{ orgs, hosts }`。授權狀態：`data/kiosk-license.json`（產品 `YSOP-Kiosk`、feature `visitor`；由 **安裝精靈** 寫入，非 `/setting`）。

### 2.6 產品授權

向外部授權平台啟用（與 BA 相同契約）。**唯一操作入口：`YsopKiosk.exe` → 授權設定。**

- 線上：`POST {LICENSE_PLATFORM_API_BASE_URL}/activate`，`{ licenseKey, deviceFingerprint }`（經 `yscp-bridge license-activate`）
- 離線：請求檔 → 平台 → 簽名 JSON；本機以 `LICENSE_SIGN_SECRET` 驗簽，且 `product` 須為 `YSOP-Kiosk`
- 未授權：擋預約／報到相關 API 與首頁按鈕；桌面端不可啟動服務；**簽退仍放行**

## 3. Kiosk API

前端只呼叫下列路由。成功 `{ "code": "0", "msg": "Success", "data": ... }`；失敗 `code` 為 HTTP 狀態字串，`data` 為 `null`（授權失敗另見 `FEATURE_NOT_LICENSED`）。

**存取：** `PUT settings`、`POST logo`、`GET records`、`POST records/reset`、`GET/POST directory`、頁面 `/setting` → 須本機或管理員 IP。產品授權僅由桌面精靈經 `yscp-bridge` 操作（無 HTTP `/api/kiosk/license*`）。其餘訪客流程與 `GET settings`／`GET logo` 公開（仍受防火牆遠端 IP 限制）。

| 方法 | 路徑 | 用途 |
|------|------|------|
| GET | `/api/kiosk/status` | `{ licensed }` |
| GET | `/api/kiosk/stats` | `{ onSite, tempOut, overstay, departed, departedTotal }`（departed＝今日離場） |
| GET | `/api/kiosk/records` | 訪客紀錄 `{ summary, rows }`（管理員） |
| POST | `/api/kiosk/records/reset` | 清空本機訪客紀錄（在場／外出／離場歸零）（管理員） |
| GET / PUT | `/api/kiosk/settings` | GET 公開（不含 approverEmails）；PUT 管理員 |
| GET / POST | `/api/kiosk/settings/logo` | GET 公開；POST 上傳／`reset=1`（管理員，≤2MB） |
| GET / POST | `/api/kiosk/directory` | 部門／被訪人（管理員） |
| GET | `/api/kiosk/notice` | 訪客須知 Markdown（需 `visitor` 授權） |
| GET | `/api/kiosk/orgs` | 部門（需授權） |
| POST | `/api/kiosk/hosts` | `{ orgIndexCode }` 載入被訪人（需授權） |
| POST | `/api/kiosk/appoint` | 建立預約（需授權）；成功回 `waitingMessage`、`appointCode` |
| POST | `/api/kiosk/verify` | 報到查詢（需授權）；外出中回 `tempOutRecords`（有限流／失敗鎖定） |
| POST | `/api/kiosk/checkin` | `{ token, acceptedNotice: true }`（需授權）；成功 `data` 為 `{}` |
| POST | `/api/kiosk/checkout/lookup` | 簽退查詢 `{ query }`（有限流／失敗鎖定；**不需**授權） |
| POST | `/api/kiosk/checkout` | `{ token, mode?: "temp"\|"return"\|"final" }`（**不需**授權） |

**預約** 必填 `receptionistId`、`email`、`phoneNo`、時段；姓／名至少其一。施工 `visitReasonType === 4` 帶 `visitReasonDetail: "施工"`。車牌正規化後寫入訪客資料。

**verify** `query`：8–15 位數字視為手機，否則為預約碼（`appointCode`）。查詢時段為前 30 日～後 30 日。

**stats**：本機在場且結束時間未過 − temp_out = `onSite`；temp_out ∩ 未結束 = `tempOut`；`departed`＝本機 `departedAt` 為台北今日之筆數；`departedTotal`＝全部 departed。

來訪事由：0 商務、1 培訓、2 來訪、3 會議、4 施工。報到沿用預約 `visitReasonType`。

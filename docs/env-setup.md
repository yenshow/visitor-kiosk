# YSOP Kiosk 訪客系統｜安裝與環境設定

Windows 安裝檔部署與 `.env` 設定。業務與 API 見 [visitor-kiosk-integration-spec.md](./visitor-kiosk-integration-spec.md)。

**YSOP Kiosk 訪客系統**的預約、人員與在場狀態皆儲存在本機。啟動服務前請啟用 YSOP-Kiosk 的 `visitor` 產品授權。

`.env` 請用 UTF-8（記事本即可）。**勿**用 PowerShell `Set-Content` 改中文註解，系統碼頁會變亂碼。

服務埠可自訂（預設 **3010**，可用 **80**），須綁 `HOSTNAME=0.0.0.0` 才可從區網／外網連入。綁定 80／443 等特權埠時，請以**系統管理員**執行 `YsopKiosk.exe`。

---

## 1. 打包（建置機）

需求：Node.js／npm、**.NET 8 SDK**、[Inno Setup 6](https://jrsoftware.org/isinfo.php)。

```bash
npm install --legacy-peer-deps --cache ./.npm-cache
npm run pack
```

產出 **`dist/YSOP-Kiosk-setup.exe`**（圖示 `installer/assets/YSOP.ico`）。`dist/YsopKiosk/` 僅為編譯中繼，不交付。

安裝後目錄主要內容：

| 項目 | 說明 |
|------|------|
| `YsopKiosk.exe` | 設定／運行＋內嵌訪客畫面 |
| `kiosk.ico` | 桌面「YSOP Kiosk」捷徑／程式圖示 |
| `app\` | Next standalone；`app\.env` 首次樣板（**升級不覆寫**現場 `.env`） |
| `app\data\` | 現場資料（授權／設定／預約／目錄／紀錄；**升級不覆寫**） |
| `node\node.exe` | 內嵌 Node |
| `tools\yscp-bridge.cjs` | 桌面 bridge（服務埠、管理員 IP、外部預約開關） |
| `tools\with-client-ip.cjs` | 注入連線 IP（管理 API／設定頁權限） |

可選：`pack-portable.ps1 -SkipBuild`／`-SkipManagerBuild`。

---

## 2. 現場安裝

現場**不必**安裝 Node.js／npm。需有 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)（Win10/11 多半已具備）。

1. 執行 `YSOP-Kiosk-setup.exe` 完成安裝（會建立桌面「YSOP Kiosk」捷徑，圖示 `kiosk.ico`）。
2. **升級**：直接再跑新版 setup（同 AppId）。**保留**既有 `app\.env`（SMTP 等）與 `app\data\`（畫面設定、訪客紀錄）；僅更新程式與工具。
3. **首次**：開啟捷徑 → **1. 授權設定** → **2. 服務設定** → **3. 運行**中的「啟動服務」。
4. 關閉主窗後仍在系統匣；結束請用系統匣「結束」。訪客全螢幕 **Esc** 僅關畫面、不停服務。
5. 畫面設定：運行區「畫面設定」（寫入 `app\data\`；僅本機或 `KIOSK_ADMIN_IPS` 可開 `/setting`，**無登入**）。請先在設定頁新增**部門與被訪人**，預約才能選人。
6. **防火牆**：套用服務設定時，「YSOP Kiosk」入站規則只允許本機與管理員 IP 存取服務埠。從曾開放所有來源的版本升級後，請重新套用設定並允許 UAC 更新規則。
7. **開機自啟（預設）**：首次執行時寫入目前使用者「啟動」項目（`YSOP-Kiosk`，登入後 `--tray`）。

對外部署可將網域指向可從外部連線的反向代理。代理與 Kiosk 同機時，上游使用 `http://127.0.0.1:<PORT>`。代理在另一台主機時，請設獨立入站規則，只放行代理的來源 IP 到 Kiosk 服務埠。管理員 IP 欄位供管理端使用。

公開代理只轉送下列預約請求，並用實際客戶端 IP 覆寫 `X-Real-IP`：

- 頁面與資源（GET）`/book`、`/_next/static/*`、`/favicon.ico`、`/yenshow-logo.svg`、`/theme-init.js`
- 查詢（GET）`/api/kiosk/status`、`/api/kiosk/settings`、`/api/kiosk/settings/logo`、`/api/kiosk/orgs`
- 送出（POST）`/api/kiosk/hosts`、`/api/kiosk/appoint`

代理可從外部開啟後，在「服務設定」填入並複製完整網址，例如 `https://visit.example.com/book`。訪客預約由畫面設定的「開放外部預約頁」控制。原本直接連到訪客機的部署，若需繼續使用 `http://<訪客機 IP>:<PORT>/book`，請由網管另設允許所需來源的入站規則。

可選：`app\public\notice.mp4`。應用資料：`app\data\`。行程日誌：`runtime\server.log`、`node.pid`。

---

## 3. 服務設定

`YsopKiosk.exe` 主畫面：

| 表單 | 寫入 | 內容 |
|------|------|------|
| **1. 授權設定** | `app\data\kiosk-license.json` | License Key 線上啟用、產生離線請求檔、匯入離線回應檔 |
| **2. 服務設定** | `app\.env`、防火牆 | 服務埠、管理員 IP、外部預約網址 |
| **3. 運行** | — | 啟動／停止服務、開啟畫面設定 |

離線啟用時，在訪客機輸入 License Key 並產生請求檔。將請求檔交給 YSOP 授權平台辦理，再將回應檔匯入同一台訪客機。匯入前須在 `app\.env` 設定授權平台提供的 `LICENSE_SIGN_SECRET`。

實作：[`scripts/yscp-bridge.ts`](../scripts/yscp-bridge.ts) → `tools/yscp-bridge.cjs`。

桌面殼層：`windows/YsopKiosk/`（`dotnet publish` 見 `pack-portable.ps1`）。安裝腳本：`installer/ysop-kiosk.iss`。

本機開發亦可對專案根目錄執行同一套表單（或手動編輯專案根 `.env`）。

---

## 4. 變數歸屬：表單 vs 畫面設定 vs 手動

| 管理方式 | 儲存位置 | 用途 |
|----------|----------|------|
| **服務設定** | `.env` | 埠、管理員 IP、外部預約網址 |
| **畫面設定 `/setting`** | `kiosk-settings.json`、`kiosk-logo.*`、`kiosk-directory.json` | 跑馬燈、須知影片、主題、Logo、現場／外部預約開關、通知信箱、部門／被訪人、訪客紀錄／重置 |
| **手動編輯 `.env`** | `.env` | SMTP 等精靈不寫的項 |

### 4.1 服務設定寫入的 `.env`

| 變數 | 說明 |
|------|------|
| `PORT` | 服務埠（預設 3010；可用 80） |
| `HOSTNAME` | 通常 `0.0.0.0` |
| `KIOSK_ADMIN_IPS` | **瀏覽器連線端** IP（逗號／換行；空白＝僅本機可開 `/setting`） |
| `KIOSK_PUBLIC_BOOKING_URL` | 選填，供分享的完整 HTTP 或 HTTPS 外部預約網址 |

### 4.2 畫面設定 `/setting`（不寫 `.env`）

| 欄位／動作 | 儲存 |
|------------|------|
| 跑馬燈 `marquee` | `kiosk-settings.json` |
| 訪客須知影片 `noticeVideoUrl` | 同上 |
| 主題 `theme`（light／dark） | 同上 |
| 顯示現場預約 `showAppoint` | 同上 |
| 開放外部預約頁 `publicBookingEnabled` | 同上（關則 `/book` 顯示未開放） |
| Logo 上傳／還原 | `kiosk-logo.*`＋設定內檔名 |
| 預約通知信箱 `approverEmails` | 同上（僅管理員 GET；內部備查） |
| 部門／被訪人 | `kiosk-directory.json` |
| 訪客紀錄檢視、重置紀錄 | `kiosk-presence.json` |
| 管理操作稽核 | `audit.log`（JSON Lines，不含個資） |

僅本機或 `KIOSK_ADMIN_IPS` 可開啟。`KIOSK_ADMIN_IPS` 填的是**開瀏覽器那台電腦**的 IPv4，不是訪客機自己的 IP（本機用 `http://127.0.0.1` 時不必填）。

### 4.3 手動 `.env`（精靈不寫）

| 變數 | 說明 |
|------|------|
| `SMTP_HOST` / `SMTP_PORT` | 預設 `smtp.office365.com` / `587` |
| `SMTP_USER` / `SMTP_PASS` | SMTP AUTH |
| `MAIL_FROM` | 可選；未填則用 `SMTP_USER` |
| `LICENSE_PLATFORM_API_BASE_URL` | 可選；預設使用 YSOP 授權平台 |
| `LICENSE_SIGN_SECRET` | 離線回應檔的驗簽金鑰，由授權平台提供 |

預約成功後以同一 SMTP **雙通道**寄信：內部 `approverEmails`＋訪客填寫的 email。無需 Resend。

### 寫死於程式

無操作回首頁 20 秒。外部預約最長 30 日（含當日）。

---

## 5. 常見問題

| 狀況 | 處理 |
|------|------|
| 預約畫面沒有部門 | 於 `/setting` 新增部門與被訪人 |
| 啟動失敗（埠 80） | 以系統管理員執行 `YsopKiosk.exe`；查看 `runtime\server.log` |
| 區網打不開 `/setting` | 將客戶端 IP 加入 `KIOSK_ADMIN_IPS` 並重跑服務設定／重啟 |
| 外部打不開 `/book` | 確認公開網址能連到反向代理，代理能連到 Kiosk 服務埠，再檢查「開放外部預約頁」 |
| 沒有收到備查信 | 確認 `.env` SMTP；設定頁有內部信箱；訪客 email 正確 |
| 訪客畫面空白 | 安裝 WebView2 Runtime；確認服務已啟動 |
| 開機未自動出現 | 確認曾執行過 `YsopKiosk.exe`；登錄編輯程式查看 `HKCU\...\Run\YSOP-Kiosk` |
| 打包失敗無法刪除 dist | 先結束 `YsopKiosk.exe` |
| 打包失敗缺 dotnet | 安裝 .NET 8 SDK |
| 打包失敗缺 ISCC | 安裝 [Inno Setup 6](https://jrsoftware.org/isinfo.php) |

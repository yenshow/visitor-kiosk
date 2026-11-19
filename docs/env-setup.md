# YSOP Kiosk 訪客系統｜安裝與環境設定

Windows 安裝檔部署與 `.env` 設定。業務與 API 見 [visitor-kiosk-integration-spec.md](./visitor-kiosk-integration-spec.md)。

**YSOP Kiosk 訪客系統**＝本訪客機（Kiosk）；預約／人員／在場狀態皆在本機。

`.env` 請用 UTF-8（記事本即可）。**勿**用 PowerShell `Set-Content` 改中文註解，系統碼頁會變亂碼。

服務埠可自訂（預設 **3010**，可用 **80**），須綁 `HOSTNAME=0.0.0.0` 才可從區網開設定頁。綁定 80／443 等特權埠時，請以**系統管理員**執行 `YsopKiosk.exe`。

---

## 1. 打包（建置機）

需求：Node.js／npm、**.NET 8 SDK**、[Inno Setup 6](https://jrsoftware.org/isinfo.php)。現場授權於安裝後用 **授權設定** 精靈寫入。

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
| `tools\yscp-bridge.cjs` | 桌面 bridge（授權、服務埠） |
| `tools\with-client-ip.cjs` | 注入連線 IP（管理 API／設定頁權限） |

可選：`pack-portable.ps1 -SkipBuild`／`-SkipManagerBuild`。

---

## 2. 現場安裝

現場**不必**安裝 Node.js／npm。需有 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)（Win10/11 多半已具備）。

1. 執行 `YSOP-Kiosk-setup.exe` 完成安裝（會建立桌面「YSOP Kiosk」捷徑，圖示 `kiosk.ico`）。
2. **升級**：直接再跑新版 setup（同 AppId）。與 YSOP／BA 相同——**保留**既有 `app\.env`（SMTP／授權平台等）與 `app\data\`（授權檔、畫面設定、訪客紀錄）；僅更新程式與工具。
3. **首次必做**：開啟捷徑 → **1. 授權設定** → 再 **3. 啟動服務**。服務埠／管理員 IP 可於 **2. 服務設定** 調整。
4. 關閉主窗後仍在系統匣；結束請用系統匣「結束」。訪客全螢幕 **Esc** 僅關畫面、不停服務。
5. 畫面設定：運行區「畫面設定」（寫入 `app\data\`；僅本機或 `KIOSK_ADMIN_IPS` 可開 `/setting`）。請先在設定頁新增**部門與被訪人**，現場預約才能選人。
6. **防火牆**：套用服務設定時自動建立規則「YSOP Kiosk」——入站 TCP＝服務埠，遠端僅 **127.0.0.1** + **管理員 IP**。若取消 UAC，請手動：
   ```powershell
   New-NetFirewallRule -DisplayName "YSOP Kiosk" -Direction Inbound -Action Allow -Protocol TCP -LocalPort <PORT> -RemoteAddress 127.0.0.1,<ADMIN_IP>
   ```
7. **開機自啟（預設）**：首次執行時寫入目前使用者「啟動」項目（`YSOP-Kiosk`，登入後 `--tray`）。

可選：`app\public\notice.mp4`。應用資料：`app\data\`（含訪客紀錄、設定、`audit.log`）。行程日誌：`runtime\server.log`、`node.pid`。

---

## 3. 授權設定／服務設定

`YsopKiosk.exe` 主畫面：

| 表單 | 寫入 | 內容 |
|------|------|------|
| **1. 授權設定** | `app\data\kiosk-license.json` | License Key 線上啟用，或離線請求／匯入（**啟動服務必做**） |
| **2. 服務設定** | `app\.env`、防火牆 | 服務埠、管理員 IP；套用後重啟 Node |

實作：[`scripts/yscp-bridge.ts`](../scripts/yscp-bridge.ts) → `tools/yscp-bridge.cjs`。

桌面殼層：`windows/YsopKiosk/`（`dotnet publish` 見 `pack-portable.ps1`）。安裝腳本：`installer/ysop-kiosk.iss`。

本機開發亦可對專案根目錄執行同一套表單（或手動編輯專案根 `.env`）。

---

## 4. 變數歸屬：表單 vs 畫面設定 vs 手動

| 管理方式 | 儲存位置 | 用途 |
|----------|----------|------|
| **服務設定** | `.env` | 埠、管理員 IP |
| **授權設定** | `kiosk-license.json` | 產品授權（visitor） |
| **畫面設定 `/setting`** | `kiosk-settings.json`、`kiosk-logo.*`、`kiosk-directory.json` | 跑馬燈、須知影片、主題、Logo、預約開關、部門／被訪人、訪客紀錄／重置 |
| **手動編輯 `.env`** | `.env` | SMTP、授權平台 URL／簽名金鑰等表單不寫的項 |

### 4.1 服務設定寫入的 `.env`

| 變數 | 說明 |
|------|------|
| `PORT` | 服務埠（預設 3010；可用 80） |
| `HOSTNAME` | 通常 `0.0.0.0` |
| `KIOSK_ADMIN_IPS` | **瀏覽器連線端** IP（逗號／換行；空白＝僅本機可開 `/setting`） |

### 4.2 畫面設定 `/setting`（不寫 `.env`）

| 欄位／動作 | 儲存 |
|------------|------|
| 跑馬燈 `marquee` | `kiosk-settings.json` |
| 訪客須知影片 `noticeVideoUrl` | 同上（YouTube／網址／路徑；空＝`/notice.mp4`） |
| 主題 `theme`（light／dark） | 同上 |
| 顯示現場預約 `showAppoint` | 同上 |
| Logo 上傳／還原 | `kiosk-logo.*`＋設定內檔名 |
| 核准通知信箱 `approverEmails` | `kiosk-settings.json`（API 支援；不出現在公開 GET） |
| 部門／被訪人 | `kiosk-directory.json` |
| 訪客紀錄檢視、重置紀錄 | `kiosk-presence.json`（重置清空在場／外出／離場） |
| 管理操作稽核 | `audit.log`（JSON Lines，不含個資） |

僅本機或 `KIOSK_ADMIN_IPS` 可開啟。`KIOSK_ADMIN_IPS` 填的是**開瀏覽器那台電腦**的 IPv4，不是訪客機自己的 IP（本機用 `http://127.0.0.1` 時不必填）。

### 4.3 手動 `.env`（精靈不寫）

| 變數 | 說明 |
|------|------|
| `SMTP_HOST` / `SMTP_PORT` | 預設 `smtp.office365.com` / `587` |
| `SMTP_USER` / `SMTP_PASS` | SMTP AUTH |
| `MAIL_FROM` | 可選；未填則用 `SMTP_USER` |
| `LICENSE_PLATFORM_API_BASE_URL` | 可選；未設則預設 **與 YSOP 相同** `https://api.yenshow.com/api/license` |
| `LICENSE_SIGN_SECRET` | 離線驗簽（**與 YSOP／BA 同一金鑰**；線上啟用不強制） |
| `LICENSE_PLATFORM_TIMEOUT_MS` | 可選；預設 10000 |
| `LICENSE_OPEN_ALL_FEATURES` | 開發用：`1`／`true` 時略過本機授權、視為 visitor 已授權（正式包請關閉） |

### 4.4 產品授權（YSOP License）

授權打外部授權平台（**與 YSOP／BA 同一套** `LICENSE_PLATFORM_API_BASE_URL`／`LICENSE_SIGN_SECRET`），不經 ba-backend。`pack-portable` 會把建置機 `.env` 的這兩項寫入 `app\.env`；現場服務設定不會覆寫它們。

**入口：`YsopKiosk.exe` → 1. 授權設定。** 畫面設定 `/setting` **不含**授權管理。

| 項目 | 值 |
|------|-----|
| 平台 `product` | `YSOP-Kiosk` |
| Feature | `visitor`（預約／報到買斷開關） |
| 裝置指紋 | `sha256(hostname + ":" + 第一個非內部 IPv4 MAC)`（與 BA 相同） |
| 本地狀態 | `app/data/kiosk-license.json`（或開發時專案根 `data/`） |

流程：授權設定輸入 LK 線上啟用，或產生離線請求檔 → 平台啟用 → 匯入簽名回應檔。主視窗未授權時不可啟動訪客服務。

授權平台後台需能發 `product=YSOP-Kiosk`、`features=["visitor"]` 的主／副 LK（不在本 repo）。Bridge 指令：`license-activate`／`license-offline-request`／`license-offline-import`（見 `scripts/yscp-bridge.ts`）。

### 寫死於程式

無操作回首頁 20 秒。

---

## 5. 常見問題

| 狀況 | 處理 |
|------|------|
| 尚未授權橫幅／報到預約灰色 | 於 `YsopKiosk.exe` 授權設定啟用 LK；或開發設 `LICENSE_OPEN_ALL_FEATURES=1` |
| 預約畫面沒有部門 | 於 `/setting` 新增部門與被訪人 |
| 啟動失敗（埠 80） | 以系統管理員執行 `YsopKiosk.exe`；查看 `runtime\server.log` |
| 區網打不開 `/setting` | 將客戶端 IP 加入 `KIOSK_ADMIN_IPS` 並重跑服務設定／重啟 |
| 訪客畫面空白 | 安裝 WebView2 Runtime；確認服務已啟動 |
| 開機未自動出現 | 確認曾執行過 `YsopKiosk.exe`；登錄編輯程式查看 `HKCU\...\Run\YSOP-Kiosk` |
| 打包失敗無法刪除 dist | 先結束 `YsopKiosk.exe` |
| 打包失敗缺 dotnet | 安裝 .NET 8 SDK |
| 打包失敗缺 ISCC | 安裝 [Inno Setup 6](https://jrsoftware.org/isinfo.php) |

# YSOP Kiosk 訪客系統｜安裝與環境設定

Windows 安裝檔部署與 YSCP／`.env` 設定。業務與 API 見 [visitor-kiosk-integration-spec.md](./visitor-kiosk-integration-spec.md)。

**YSOP Kiosk 訪客系統**＝本訪客機（Kiosk）；**YSCP**＝Yenshow Central Professional（中央平台）。

`.env` 請用 UTF-8（記事本即可）。**勿**用 PowerShell `Set-Content` 改中文註解，系統碼頁會變亂碼。

服務埠可自訂（預設 **3010**，可用 **80**），須綁 `HOSTNAME=0.0.0.0`，YSCP 才能從區網推 Webhook。綁定 80／443 等特權埠時，請以**系統管理員**執行 `YsopKiosk.exe`。

---

## 1. 打包（建置機）

需求：Node.js／npm、**.NET 8 SDK**、[Inno Setup 6](https://jrsoftware.org/isinfo.php)。現場金鑰於安裝後用 **YSCP 設定** 精靈寫入，不必在建置機預先填。

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
| `app\` | Next standalone；`app\.env` 樣板（**不含**金鑰） |
| `node\node.exe` | 內嵌 Node |
| `tools\yscp-bridge.cjs` | YSCP 設定 bridge |
| `tools\with-client-ip.cjs` | 注入連線 IP（管理 API／設定頁權限） |

可選：`pack-portable.ps1 -SkipBuild`／`-SkipManagerBuild`。

---

## 2. 現場安裝

現場**不必**安裝 Node.js／npm。需有 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)（Win10/11 多半已具備）。

1. 執行 `YSOP-Kiosk-setup.exe` 完成安裝（會建立桌面「YSOP Kiosk」捷徑，圖示 `kiosk.ico`）。
2. **首次必做**：開啟捷徑 → **1. YSCP 設定** → 再 **2. 啟動訪客機**。設定精靈會寫入埠、管理員 IP、YSCP 來源 IP，並以 UAC 更新防火牆。
3. 關閉主窗後仍在系統匣；結束請用系統匣「結束」。訪客全螢幕 **Esc** 僅關畫面、不停服務。
4. 畫面設定：運行區「開啟畫面設定」（寫入 `app\data\`；僅本機或 `KIOSK_ADMIN_IPS` 可開 `/setting`）。
5. **防火牆**：套用 YSCP 設定時自動建立規則「YSOP Kiosk」——入站 TCP＝服務埠，遠端僅 **YSCP 來源 IP** + **管理員 IP**（不再 Any）。若取消 UAC，請手動：
   ```powershell
   New-NetFirewallRule -DisplayName "YSOP Kiosk" -Direction Inbound -Action Allow -Protocol TCP -LocalPort <PORT> -RemoteAddress <YSCP_IP>,<ADMIN_IP>
   ```
6. **開機自啟（預設）**：首次執行時寫入目前使用者「啟動」項目（`YSOP-Kiosk`，登入後 `--tray`）。

可選：`app\public\notice.mp4`。日誌：`runtime\server.log`、`runtime\audit.log`、`node.pid`。

---

## 3. YSCP 設定（安裝精靈）

`YsopKiosk.exe` → **YSCP 設定** → 寫入 `.env`（現場為 `app\.env`）、防火牆並重啟 Node。實作：[`scripts/yscp-bridge.ts`](../scripts/yscp-bridge.ts) → `tools/yscp-bridge.cjs`。

欄位：HOST（IPv4）／AK／SK、服務埠、管理員 IP（多行）、Webhook、出口車道。事件 token 若尚未存在會自動產生隨機值。防火牆來源＝HOST。內網固定略過 YSCP HTTPS 自簽憑證驗證。

桌面殼層：`windows/YsopKiosk/`（`dotnet publish` 見 `pack-portable.ps1`）。安裝腳本：`installer/ysop-kiosk.iss`。

本機開發亦可對專案根目錄執行同一套精靈（或手動編輯專案根 `.env`，鍵名須與下表一致）。

---

## 4. 變數歸屬：精靈 vs 畫面設定 vs 手動

| 管理方式 | 儲存位置 | 用途 |
|----------|----------|------|
| **YSCP 設定精靈** | `.env` | 連線、埠、管理員 IP、Webhook、出口車道 |
| **畫面設定 `/setting`** | `data/kiosk-settings.json`、`data/kiosk-logo.*` | 跑馬燈、須知影片、主題、Logo、預約開關、訪客紀錄／重置 |
| **手動編輯 `.env`** | `.env` | SMTP 等精靈不寫的項 |

### 4.1 精靈寫入的 `.env`

| 變數 | 說明 |
|------|------|
| `YSCP_HOST` | Artemis IPv4（可 `ip:埠`；防火牆來源＝此 IP） |
| `YSCP_AK` / `YSCP_SK` | OpenAPI 金鑰 |
| `PORT` | 服務埠（預設 3010；可用 80） |
| `HOSTNAME` | 通常 `0.0.0.0` |
| `KIOSK_ADMIN_IPS` | **瀏覽器連線端** IP（逗號／換行；空白＝僅本機可開 `/setting`） |
| `YSCP_EVENT_DEST` | Webhook，區網 `http://192.168.x.x:<PORT>/api/yscp/events` |
| `YSCP_EVENT_TOKEN` | 訂閱／推送校驗（首次自動產生） |
| `YSCP_EXIT_LANES` | 出口相機 → 繼電器 JSON |

區網請用 **HTTP**。換 IP 後改 `YSCP_EVENT_DEST` 並於精靈重新套用（會重訂閱）。

```env
YSCP_EXIT_LANES=[{"cameraIndexCode":"1213","alarmOutputIndexCode":"1218"}]
```

### 4.2 畫面設定 `/setting`（不寫 `.env`）

| 欄位／動作 | 儲存 |
|------------|------|
| 跑馬燈 `marquee` | `kiosk-settings.json` |
| 訪客須知影片 `noticeVideoUrl` | 同上（YouTube／網址／路徑；空＝`/notice.mp4`） |
| 主題 `theme`（light／dark） | 同上 |
| 顯示現場預約 `showAppoint` | 同上 |
| Logo 上傳／還原 | `kiosk-logo.*`＋設定內檔名 |
| 核准通知信箱 `approverEmails` | `kiosk-settings.json`（API 支援；不出現在公開 GET） |
| 訪客紀錄檢視、重置紀錄 | `kiosk-presence.json`（重置清空） |

僅本機或 `KIOSK_ADMIN_IPS` 可開啟。`KIOSK_ADMIN_IPS` 填的是**開瀏覽器那台電腦**的 IPv4，不是訪客機自己的 IP（本機用 `http://127.0.0.1` 時不必填）。

### 4.3 手動 `.env`（精靈不寫）

| 變數 | 說明 |
|------|------|
| `YSCP_EXIT_GATE_MINUTES` | 離場開閘分鐘數（預設 15） |
| `SMTP_HOST` / `SMTP_PORT` | 預設 `smtp.office365.com` / `587` |
| `SMTP_USER` / `SMTP_PASS` | SMTP AUTH |
| `MAIL_FROM` | 可選；未填則用 `SMTP_USER` |

### 寫死於程式

HTTPS 預設埠 443、逾時 30 秒、開閘去重 5 秒、無操作回首頁 20 秒。對 YSCP 一律略過 HTTPS 自簽憑證驗證（內網產品假設）。

---

## 5. 常見問題

| 狀況 | 處理 |
|------|------|
| 尚未設定金鑰橫幅 | 完成 YSCP 設定後重啟／再按啟動訪客機 |
| 事件進來但不開閘 | `srcIndex`＝出口相機；車牌在時限內為 temp_out／departed |
| 訂閱失敗 | AK／SK／EVENT_TOKEN；Webhook 用 http；防火牆僅 YSCP IP；於 **YSCP 設定** 精靈重新套用 |
| 啟動失敗（埠 80） | 以系統管理員執行 `YsopKiosk.exe`；查看 `runtime\server.log` |
| 區網打不開 `/setting` | 將客戶端 IP 加入 `KIOSK_ADMIN_IPS` 並重跑套用／重啟 |
| 訪客畫面空白 | 安裝 WebView2 Runtime；確認服務已啟動 |
| 換 IP／換機 | YSCP 設定改 Webhook／來源 IP 後套用（會重訂閱與更新防火牆） |
| 開機未自動出現 | 確認曾執行過 `YsopKiosk.exe`；登錄編輯程式查看 `HKCU\...\Run\YSOP-Kiosk` |
| 打包失敗無法刪除 dist | 先結束 `YsopKiosk.exe` |
| 打包失敗缺 dotnet | 安裝 .NET 8 SDK |
| 打包失敗缺 ISCC | 安裝 [Inno Setup 6](https://jrsoftware.org/isinfo.php) |

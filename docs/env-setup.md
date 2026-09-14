# YSOP Kiosk 訪客系統｜安裝與環境設定

Windows 安裝檔部署與 YSCP／`.env` 設定。業務與 API 見 [visitor-kiosk-integration-spec.md](./visitor-kiosk-integration-spec.md)。

**YSOP Kiosk 訪客系統**＝本訪客機（Kiosk）；**YSCP**＝Yenshow Central Professional（中央平台）。

`.env` 請用 UTF-8（記事本即可）。**勿**用 PowerShell `Set-Content` 改中文註解，系統碼頁會變亂碼。

服務埠固定 **3010**，須綁 `HOSTNAME=0.0.0.0`，YSCP 才能從區網推 Webhook。

---

## 1. 打包（建置機）

需求：Node.js／npm、**.NET 8 SDK**、[Inno Setup 6](https://jrsoftware.org/isinfo.php)。現場金鑰**不必**先在建置機跑 `setup:yscp`。

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

可選：`pack-portable.ps1 -SkipBuild`／`-SkipManagerBuild`。

---

## 2. 現場安裝

現場**不必**安裝 Node.js／npm。需有 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)（Win10/11 多半已具備）。

1. 執行 `YSOP-Kiosk-setup.exe` 完成安裝（會建立桌面「YSOP Kiosk」捷徑，圖示 `kiosk.ico`）。
2. **首次必做**：開啟捷徑 → **1. YSCP 設定** → 再 **2. 啟動訪客機**。
3. 關閉主窗後仍在系統匣；結束請用系統匣「結束」。訪客全螢幕 **Esc** 僅關畫面、不停服務。
4. 畫面設定：運行區「開啟畫面設定」（寫入 `app\data\`）。
5. 防火牆放行**入站 TCP 3010**：
   ```powershell
   New-NetFirewallRule -DisplayName "YSOP Kiosk 3010" -Direction Inbound -Protocol TCP -LocalPort 3010 -Action Allow
   ```
6. **開機自啟（預設）**：首次執行時寫入目前使用者「啟動」項目（`YSOP-Kiosk`，登入後 `--tray`）。

可選：`app\public\notice.mp4`。日誌：`runtime\server.log`、`node.pid`。

---

## 3. YSCP 設定

### 現場（主要）

`YsopKiosk.exe` → **YSCP 設定**（單頁）→ 寫入 `app\.env` 並重啟 Node。

### 建置機 CLI（本機開發用）

```bash
npm run setup:yscp
```

只寫入**專案根** `.env`，**不會**打進 portable 封裝。腳本：[`scripts/yscp-setup.ts`](../scripts/yscp-setup.ts)；桌面設定：[`scripts/yscp-bridge.ts`](../scripts/yscp-bridge.ts)。

```bash
npm run setup:yscp -- subscribe
npm run setup:yscp -- cameras
npm run setup:yscp -- relays --dev <encodeDevIndexCode>
npm run setup:yscp -- lanes
npm run setup:yscp -- open --relay <alarmOutputIndexCode> --yes
```

桌面殼層：`windows/YsopKiosk/`（`dotnet publish` 見 `pack-portable.ps1`）。安裝腳本：`installer/ysop-kiosk.iss`。

---

## 4. 環境變數

現場：`app\.env`（設定頁寫入）。建置機開發：專案根 `.env`。

### 由設定寫入

| 變數 | 說明 |
|------|------|
| `YSCP_HOST` | Artemis 主機（可 `ip:埠`，未寫埠則 443） |
| `YSCP_AK` / `YSCP_SK` | OpenAPI 金鑰 |
| `YSCP_EVENT_DEST` | Webhook，區網 `http://192.168.x.x:3010/api/yscp/events` |
| `YSCP_EVENT_TOKEN` | 訂閱／推送校驗，預設 `Aa83124007` |
| `YSCP_EXIT_LANES` | 出口相機 → 繼電器 JSON |

區網請用 **HTTP**。換 IP 後改 `YSCP_EVENT_DEST` 並重訂閱。

```env
YSCP_EXIT_LANES=[{"cameraIndexCode":"1213","alarmOutputIndexCode":"1218"}]
```

### Kiosk／服務

| 變數 | 說明 |
|------|------|
| `PORT` | 預設 3010（樣板／Kiosk 啟動時注入） |
| `HOSTNAME` | `0.0.0.0` |
| `YSCP_EXIT_GATE_MINUTES` | 離場開閘分鐘數（預設 15） |
| `NEXT_PUBLIC_NOTICE_VIDEO_URL` | 須知影片（預設 `/notice.mp4`） |

### SMTP（選用）

| 變數 | 說明 |
|------|------|
| `SMTP_HOST` / `SMTP_PORT` | 預設 `smtp.office365.com` / `587` |
| `SMTP_USER` / `SMTP_PASS` | SMTP AUTH |
| `MAIL_FROM` | 可選 |

核准收件人在 `/setting`，不放 `.env`。

### 寫死於程式

HTTPS 443、不驗證 TLS、逾時 30 秒、開閘去重 5 秒、無操作回首頁 20 秒。

---

## 5. 常見問題

| 狀況 | 處理 |
|------|------|
| 尚未設定金鑰橫幅 | 完成 YSCP 設定後重啟／再按啟動訪客機 |
| 事件進來但不開閘 | `srcIndex`＝出口相機；車牌在時限內為 temp_out／departed |
| 訂閱失敗 | AK／SK；Webhook 用 http；防火牆 3010；於設定頁重跑套用 |
| 啟動失敗 | 確認 `app\.env` 可寫；查看 `runtime\server.log` |
| 訪客畫面空白 | 安裝 WebView2 Runtime；確認服務已啟動 |
| 換 IP／換機 | YSCP 設定改 Webhook 後套用（會重訂閱） |
| 開機未自動出現 | 確認曾執行過 `YsopKiosk.exe`；登錄編輯程式查看 `HKCU\...\Run\YSOP-Kiosk` |
| 打包失敗無法刪除 dist | 先結束 `YsopKiosk.exe` |
| 打包失敗缺 dotnet | 安裝 .NET 8 SDK |
| 打包失敗缺 ISCC | 安裝 [Inno Setup 6](https://jrsoftware.org/isinfo.php) |

YSOP Kiosk 訪客系統｜現場說明
======================================

本程式＝YSOP Kiosk 訪客系統（獨立預約／報到／簽退，資料在本機）。
無產品授權／訂閱；安裝後即可設定並啟動。

需求：Windows 10/11（64 位元）。安裝檔已含 node.exe 與 YsopKiosk.exe。
現場不必安裝 Node.js／npm。訪客畫面為程式內嵌（WebView2）。

一、安裝
執行 YSOP-Kiosk-setup.exe 完成安裝。
桌面會出現「YSOP Kiosk」捷徑（圖示 kiosk.ico）。

二、首次設定
開啟「YSOP Kiosk」：
1）服務設定 — 服務埠（預設 3010，可用 80）、管理員 IP、是否允許外部預約入站
2）啟動服務
服務設定寫入 app\.env 並以 UAC 更新防火牆。

升級：直接安裝新版 setup。會保留既有 app\.env 與 app\data（設定／紀錄），
僅更新程式。

三、日常使用
- 「啟動服務」／「停止服務」／「畫面設定」
- 關閉主窗後仍在系統匣；結束請用系統匣「結束」
- Esc 僅關全螢幕畫面
- 畫面設定（跑馬燈／須知影片／Logo／部門與被訪人／通知信箱）僅本機或管理員 IP 可開啟（無登入）
- 管理員 IP＝開瀏覽器那台電腦的 IPv4（不是訪客機自己的 IP）
- 現場／外部預約前請先在畫面設定新增部門與被訪人
- 外部預約頁：http://<主機>:<埠>/book

四、防火牆
套用服務設定時自動建立「YSOP Kiosk」規則：
- 未開放外部預約：入站 TCP＝服務埠，遠端僅本機（127.0.0.1）+ 管理員 IP
- 有開放外部預約：入站開放；設定頁仍由應用層管理員 IP 保護
若取消 UAC，請手動（將 <PORT>／IP 換成實際值）：
  New-NetFirewallRule -DisplayName "YSOP Kiosk" -Direction Inbound -Action Allow -Protocol TCP -LocalPort <PORT> -RemoteAddress 127.0.0.1,<ADMIN_IP>

五、其他
- 開機自啟：執行過安裝與維護後自動寫入登入啟動（YSOP-Kiosk）
- 應用資料：`app\data\`（訪客紀錄 JSON、設定、`audit.log` 管理稽核）
- 行程日誌：`runtime\server.log`、`node.pid`（WPF 啟動 Node 用）
- 須知影片：於畫面設定填網址，或放 app\public\notice.mp4
- 預約備查信：於 app\.env 設定 SMTP_*；畫面設定填內部通知信箱
- 綁定埠 80 時請以系統管理員執行 YsopKiosk.exe

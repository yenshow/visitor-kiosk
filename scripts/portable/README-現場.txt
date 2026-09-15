YSOP Kiosk 訪客系統｜現場說明
======================================

本程式＝YSOP Kiosk 訪客系統；對接 YSCP（中央平台）。

需求：Windows 10/11（64 位元）。安裝檔已含 node.exe 與 YsopKiosk.exe。
現場不必安裝 Node.js／npm。訪客畫面為程式內嵌（WebView2）。

一、安裝
執行 YSOP-Kiosk-setup.exe 完成安裝。
桌面會出現「YSOP Kiosk」捷徑（圖示 kiosk.ico）。

二、首次設定（必做）
開啟「YSOP Kiosk」→「開啟 YSCP 設定」
一次填寫連線（HOST 須為 YSCP 的 IPv4）、服務埠（預設 3010，可用 80）、
管理員 IP、Webhook、出口車道後套用
（防火牆來源＝HOST；安裝不含金鑰；由精靈寫入 app\.env，並以 UAC 更新防火牆）

三、日常使用
- 「啟動服務」／「停止服務」／「服務設定」
- 關閉主窗後仍在系統匣；結束請用系統匣「結束」
- Esc 僅關全螢幕畫面
- 畫面設定（跑馬燈／須知影片／Logo 等）僅本機或管理員 IP 可開啟
- 管理員 IP＝開瀏覽器那台電腦的 IPv4（不是訪客機自己的 IP）

四、防火牆
套用 YSCP 設定時自動建立「YSOP Kiosk」規則：
入站 TCP＝服務埠，遠端僅 YSCP（HOST）+ 管理員 IP。
若取消 UAC，請手動（將 <PORT>／IP 換成實際值）：
  New-NetFirewallRule -DisplayName "YSOP Kiosk" -Direction Inbound -Action Allow -Protocol TCP -LocalPort <PORT> -RemoteAddress <YSCP_HOST>,<ADMIN_IP>

五、其他
- 開機自啟：執行過安裝與維護後自動寫入登入啟動（YSOP-Kiosk）
- 日誌：runtime\server.log、runtime\audit.log
- 須知影片：於畫面設定填網址，或放 app\public\notice.mp4
- 綁定埠 80 時請以系統管理員執行 YsopKiosk.exe

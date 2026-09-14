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
一次填寫連線、Webhook、出口車道後套用
（安裝不含金鑰；由設定頁寫入 app\.env）

三、日常使用
- 「啟動服務」／「停止服務」／「服務設定」
- 關閉主窗後仍在系統匣；結束請用系統匣「結束」
- Esc 僅關全螢幕畫面

四、防火牆
放行入站 TCP 3010。管理員：
  New-NetFirewallRule -DisplayName "YSOP Kiosk 3010" -Direction Inbound -Protocol TCP -LocalPort 3010 -Action Allow

五、其他
- 開機自啟：執行過安裝與維護後自動寫入登入啟動（YSOP-Kiosk）
- 日誌：runtime\server.log
- 須知影片：app\public\notice.mp4

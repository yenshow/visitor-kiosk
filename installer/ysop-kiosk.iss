; YSOP Kiosk — Inno Setup 6
; SetupIconFile = assets\YSOP.ico；桌面「YSOP Kiosk」= kiosk.ico
; pack-portable.ps1 產出 dist\YsopKiosk\ 後可呼叫 ISCC。
;
; 升級（對齊 YSOP／BA）：
;   - app\.env 僅「不存在時」寫入（onlyifdoesntexist），保留現場 SMTP／授權平台等
;   - 不安裝 app\data\*，保留授權檔、畫面設定、訪客紀錄等
; CloseApplications=force：安裝時關閉占用檔案的程式

#ifndef MyAppVersion
  #define MyAppVersion "1.0.0"
#endif

#define MyAppName "YSOP Kiosk 訪客系統"
#define MyAppPublisher "Yenshow"
#define MyAppExe "YsopKiosk.exe"

[Setup]
AppId={{8F2C9A1B-5D4E-4A6F-9C1D-2E3F4A5B6C7D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\YsopKiosk
DefaultGroupName=YSOP Kiosk
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=YSOP-Kiosk-setup
SetupIconFile=assets\YSOP.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\kiosk.ico
CloseApplications=force
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Dirs]
; 首次安裝建立資料目錄；升級不覆寫既有內容
Name: "{app}\app\data"

[Files]
; 遞迴複製；排除 .env 與 data（升級保留現場設定／授權／紀錄）
Source: "..\dist\YsopKiosk\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "app\.env,app\data\*"
Source: "..\dist\YsopKiosk\app\.env"; DestDir: "{app}\app"; Flags: onlyifdoesntexist ignoreversion

[Icons]
Name: "{autodesktop}\YSOP Kiosk"; Filename: "{app}\{#MyAppExe}"; WorkingDir: "{app}"; IconFilename: "{app}\kiosk.ico"; Comment: "{#MyAppName}"
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; WorkingDir: "{app}"; IconFilename: "{app}\kiosk.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\{#MyAppExe}"; Description: "啟動 YSOP Kiosk"; Flags: nowait postinstall skipifsilent

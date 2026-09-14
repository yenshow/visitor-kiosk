; YSOP Kiosk — Inno Setup 6
; SetupIconFile = assets\YSOP.ico；桌面「YSOP Kiosk」= kiosk.ico
; pack-portable.ps1 產出 dist\YsopKiosk\ 後可呼叫 ISCC。

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

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\dist\YsopKiosk\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autodesktop}\YSOP Kiosk"; Filename: "{app}\{#MyAppExe}"; WorkingDir: "{app}"; IconFilename: "{app}\kiosk.ico"; Comment: "{#MyAppName}"
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; WorkingDir: "{app}"; IconFilename: "{app}\kiosk.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\{#MyAppExe}"; Description: "啟動 YSOP Kiosk"; Flags: nowait postinstall skipifsilent

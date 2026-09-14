using Microsoft.Win32;

namespace YsopKiosk;

/// <summary>登入自動啟動：寫入目前使用者 Run（免系統管理員）。</summary>
internal static class TrayAutostartHelper
{
    internal const string RunValueName = "YSOP-Kiosk";
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";

    internal static bool TryRegister(string installRoot, out string error)
    {
        error = "";
        try
        {
            var exePath = InstallRootResolver.ResolveManagerExe(installRoot);
            if (exePath is null)
            {
                error = $"找不到 {InstallRootResolver.ManagerExeName}";
                return false;
            }

            using var key = Registry.CurrentUser.CreateSubKey(RunKeyPath);
            if (key is null)
            {
                error = "無法開啟開機啟動登錄機碼";
                return false;
            }

            key.SetValue(RunValueName, "\"" + exePath + "\" --tray");
            return true;
        }
        catch (Exception ex)
        {
            error = "無法註冊開機自啟：" + ex.Message;
            return false;
        }
    }
}

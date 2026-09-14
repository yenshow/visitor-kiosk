using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;

namespace YsopKiosk;

/// <summary>桌面「YSOP Kiosk」捷徑（圖示 kiosk.ico）。</summary>
internal static class DesktopShortcutHelper
{
    internal static void Ensure(string installRoot)
    {
        try
        {
            var exePath = InstallRootResolver.ResolveManagerExe(installRoot);
            if (exePath is null) return;

            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            if (string.IsNullOrWhiteSpace(desktop) || !Directory.Exists(desktop)) return;

            var workDir = Path.GetDirectoryName(exePath) ?? installRoot;
            var iconPath = Path.Combine(installRoot, AppBrand.ShortcutIconFileName);
            if (!File.Exists(iconPath)) iconPath = exePath;

            CreateShortcut(
                Path.Combine(desktop, AppBrand.ShortcutFileName),
                exePath,
                workDir,
                iconPath);
        }
        catch
        {
            /* 捷徑失敗不阻擋主流程 */
        }
    }

    private static void CreateShortcut(string linkPath, string targetPath, string workingDir, string iconPath)
    {
        var shellType = Type.GetTypeFromProgID("WScript.Shell");
        if (shellType is null) return;

        object? shell = Activator.CreateInstance(shellType);
        if (shell is null) return;

        try
        {
            object shortcut = shellType.InvokeMember(
                "CreateShortcut",
                BindingFlags.InvokeMethod,
                null,
                shell,
                [linkPath])!;

            SetProp(shortcut, "TargetPath", targetPath);
            SetProp(shortcut, "WorkingDirectory", workingDir);
            SetProp(shortcut, "WindowStyle", 1);
            SetProp(shortcut, "Description", AppBrand.ProductName);
            SetProp(shortcut, "IconLocation", iconPath + ",0");
            shortcut.GetType().InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
            Marshal.FinalReleaseComObject(shortcut);
        }
        finally
        {
            Marshal.FinalReleaseComObject(shell);
        }
    }

    private static void SetProp(object target, string name, object value) =>
        target.GetType().InvokeMember(name, BindingFlags.SetProperty, null, target, [value]);
}

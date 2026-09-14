using System.Drawing;
using System.Windows.Forms;
using WpfApplication = System.Windows.Application;

namespace YsopKiosk;

internal sealed class TrayIconService : IDisposable
{
    private readonly MainWindow _main;
    private readonly NotifyIcon _notifyIcon;
    private readonly Icon _appIcon;
    private bool _disposed;

    internal TrayIconService(MainWindow main)
    {
        _main = main;
        _appIcon = LoadAppIcon();
        var menu = new ContextMenuStrip();
        menu.Items.Add("顯示主視窗", null, (_, _) => InvokeUi(() => _main.ShowFromTray()));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("啟動服務", null, (_, _) => InvokeUi(() => _ = StartKioskSafeAsync()));
        menu.Items.Add("停止服務", null, (_, _) => InvokeUi(() => _ = _main.StopServiceAsync()));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("結束", null, (_, _) => InvokeUi(() =>
        {
            Dispose();
            _main.RequestExit();
        }));

        _notifyIcon = new NotifyIcon
        {
            Visible = true,
            Text = Truncate(AppBrand.ProductName),
            ContextMenuStrip = menu,
            Icon = _appIcon,
        };
        _notifyIcon.DoubleClick += (_, _) => InvokeUi(() => _main.ShowFromTray());
    }

    private async Task StartKioskSafeAsync()
    {
        try { await _main.StartKioskAsync(); }
        catch { /* shown in UI when visible */ }
    }

    internal void UpdateTooltip(string text)
    {
        if (_disposed) return;
        try { _notifyIcon.Text = Truncate(text); } catch { /* ignore */ }
    }

    internal void ShowBalloon(string title, string text)
    {
        if (_disposed) return;
        try
        {
            _notifyIcon.BalloonTipTitle = title;
            _notifyIcon.BalloonTipText = text;
            _notifyIcon.ShowBalloonTip(5_000);
        }
        catch { /* ignore */ }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        try
        {
            _notifyIcon.Visible = false;
            _notifyIcon.Dispose();
        }
        catch { /* ignore */ }
        try { _appIcon.Dispose(); } catch { /* ignore */ }
    }

    private static Icon LoadAppIcon()
    {
        try
        {
            var uri = new Uri(AppBrand.IconPackUri, UriKind.Absolute);
            var info = WpfApplication.GetResourceStream(uri);
            if (info?.Stream is { } stream)
                return new Icon(stream);
        }
        catch { /* fall through */ }
        return (Icon)SystemIcons.Application.Clone();
    }

    private static string Truncate(string text) =>
        string.IsNullOrEmpty(text) ? AppBrand.ProductName : (text.Length <= 63 ? text : text[..60] + "...");

    private static void InvokeUi(Action action)
    {
        var d = WpfApplication.Current?.Dispatcher;
        if (d is null || d.CheckAccess()) action();
        else d.BeginInvoke(action);
    }
}

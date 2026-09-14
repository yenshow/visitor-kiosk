using System.Windows;

namespace YsopKiosk;

public partial class App : Application
{
    private Mutex? _mutex;
    private EventWaitHandle? _showEvent;
    private CancellationTokenSource? _showWatchCts;
    internal MainWindow? MainWin { get; private set; }
    internal TrayIconService? Tray { get; private set; }

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        if (!SingleInstance.TryBecomePrimary(out _mutex))
        {
            SingleInstance.SignalShowMain();
            Shutdown();
            return;
        }

        _showEvent = SingleInstance.CreateShowEvent();
        _showWatchCts = new CancellationTokenSource();
        StartShowWatch(_showWatchCts.Token);

        var trayOnly = e.Args.Any(a => string.Equals(a, "--tray", StringComparison.OrdinalIgnoreCase));
        MainWin = new MainWindow();
        Tray = new TrayIconService(MainWin);
        MainWin.SetTray(Tray);

        if (trayOnly)
        {
            MainWin.Hide();
            _ = MainWin.BootTrayAsync();
        }
        else
        {
            MainWin.Show();
        }
    }

    private void StartShowWatch(CancellationToken ct)
    {
        var ev = _showEvent;
        if (ev is null) return;

        _ = Task.Run(() =>
        {
            var handles = new WaitHandle[] { ev, ct.WaitHandle };
            while (!ct.IsCancellationRequested)
            {
                var i = WaitHandle.WaitAny(handles);
                if (i != 0) break;
                Dispatcher.BeginInvoke(() => MainWin?.ShowFromTray());
            }
        }, ct);
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _showWatchCts?.Cancel();
        _showWatchCts?.Dispose();
        _showEvent?.Dispose();
        Tray?.Dispose();
        try { _mutex?.ReleaseMutex(); } catch { /* ignore */ }
        _mutex?.Dispose();
        base.OnExit(e);
    }
}

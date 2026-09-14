using System.Windows;

namespace YsopKiosk;

/// <summary>Singleton host for WebView2 kiosk / setting windows.</summary>
internal sealed class KioskUiHost
{
    private readonly int _port;
    private KioskWindow? _kiosk;
    private SettingWindow? _setting;

    internal KioskUiHost(int port) => _port = port;

    internal string KioskUrl => $"http://127.0.0.1:{_port}/";
    internal string SettingUrl => $"http://127.0.0.1:{_port}/setting";

    internal void OpenKiosk()
    {
        if (_kiosk is { IsLoaded: true })
        {
            _kiosk.Activate();
            return;
        }

        _kiosk = new KioskWindow(KioskUrl);
        _kiosk.Closed += (_, _) => _kiosk = null;
        _kiosk.Show();
        _kiosk.Activate();
    }

    internal void OpenSetting()
    {
        if (_setting is { IsLoaded: true })
        {
            _setting.Activate();
            return;
        }

        _setting = new SettingWindow(SettingUrl);
        _setting.Closed += (_, _) => _setting = null;
        _setting.Show();
        _setting.Activate();
    }

    internal void CloseAll()
    {
        try { _kiosk?.Close(); } catch { /* ignore */ }
        try { _setting?.Close(); } catch { /* ignore */ }
        _kiosk = null;
        _setting = null;
    }
}

using System.Windows;

namespace YsopKiosk;

public partial class MainWindow : Window
{
    private readonly string _root;
    private readonly KioskProcessService _kiosk;
    private readonly KioskUiHost _ui;
    private TrayIconService? _tray;
    private bool _allowExit;
    private bool _hasCredentials;

    public MainWindow()
    {
        InitializeComponent();
        _root = InstallRootResolver.Resolve();
        _kiosk = new KioskProcessService(_root);
        _ui = new KioskUiHost(() => _kiosk.Port);
        Loaded += async (_, _) =>
        {
            EnsureInstallHooks();
            await RefreshStatusAsync();
        };
    }

    internal void SetTray(TrayIconService tray) => _tray = tray;

    internal void ShowFromTray()
    {
        Show();
        if (WindowState == WindowState.Minimized)
            WindowState = WindowState.Normal;
        Activate();
        Topmost = true;
        Topmost = false;
        Focus();
        _ = RefreshStatusAsync();
    }

    internal void RequestExit()
    {
        _allowExit = true;
        _ui.CloseAll();
        _kiosk.Stop();
        Application.Current.Shutdown();
    }

    /// <summary>--tray：藏匣後自動起服務並開訪客畫面。</summary>
    internal async Task BootTrayAsync()
    {
        EnsureInstallHooks();
        await RefreshStatusAsync();
        if (!_hasCredentials)
        {
            _tray?.ShowBalloon(AppBrand.ProductName, "尚未完成 YSCP 設定，請開啟主視窗設定。");
            return;
        }
        try
        {
            await StartKioskAsync(showErrors: false);
            if (!await _kiosk.IsRunningAsync())
                _tray?.ShowBalloon(AppBrand.ProductName, "自動啟動失敗，請開啟主視窗查看狀態。");
        }
        catch
        {
            _tray?.ShowBalloon(AppBrand.ProductName, "自動啟動失敗，請開啟主視窗查看狀態。");
        }
        await RefreshStatusAsync();
    }

    private void OnClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (_allowExit) return;
        e.Cancel = true;
        Hide();
        _ = UpdateTrayTooltipAsync();
    }

    private async Task UpdateTrayTooltipAsync()
    {
        var running = await _kiosk.IsRunningAsync();
        _tray?.UpdateTooltip(running
            ? $"{AppBrand.ProductName} 運行中 :{_kiosk.Port}"
            : $"{AppBrand.ProductName} 已停止");
    }

    internal async Task RefreshStatusAsync()
    {
        TxtStatus.Text = "偵測中…";
        var running = await _kiosk.IsRunningAsync();

        var bridge = await YscpBridgeClient.RunAsync(_root, "status");
        if (!bridge.Ok)
        {
            _hasCredentials = false;
            TxtStatus.Text = running ? "服務運行中（設定讀取失敗）" : "請先完成 YSCP 設定";
            BtnStartKiosk.IsEnabled = false;
            BtnStop.IsEnabled = running;
            BtnSetting.IsEnabled = running;
            await UpdateTrayTooltipAsync();
            return;
        }

        _hasCredentials = bridge.GetBool("hasCredentials");
        if (!_hasCredentials)
        {
            TxtStatus.Text = running
                ? "服務運行中 · 尚未完成 YSCP 設定"
                : "尚未完成 YSCP 設定 — 請先開啟 YSCP 設定";
        }
        else
        {
            TxtStatus.Text = running ? "服務運行中" : "已設定 · 服務已停止";
        }

        BtnStartKiosk.IsEnabled = _hasCredentials;
        BtnStop.IsEnabled = running;
        BtnSetting.IsEnabled = _hasCredentials;
        await UpdateTrayTooltipAsync();
    }

    internal async Task StartKioskAsync(bool showErrors = true)
    {
        if (!_hasCredentials)
        {
            if (showErrors)
                MessageBox.Show("請先完成 YSCP 設定。", AppBrand.ProductName, MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }

        try
        {
            TxtStatus.Text = "正在啟動…";
            await _kiosk.StartAsync();
            if (await _kiosk.IsRunningAsync())
                _ui.OpenKiosk();
            else if (showErrors)
                MessageBox.Show("服務未就緒，無法開啟訪客畫面。", AppBrand.ProductName,
                    MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        catch (Exception ex)
        {
            if (showErrors)
                MessageBox.Show(ex.Message, "啟動失敗", MessageBoxButton.OK, MessageBoxImage.Error);
            throw;
        }
        finally
        {
            await RefreshStatusAsync();
        }
    }

    internal async Task StopServiceAsync()
    {
        _ui.CloseAll();
        _kiosk.Stop();
        await RefreshStatusAsync();
    }

    private async void OnStartKiosk(object sender, RoutedEventArgs e)
    {
        try { await StartKioskAsync(); }
        catch { /* already shown */ }
    }

    private async void OnStop(object sender, RoutedEventArgs e) => await StopServiceAsync();

    private async void OnOpenSetting(object sender, RoutedEventArgs e)
    {
        if (!_hasCredentials)
        {
            MessageBox.Show("請先完成 YSCP 設定。", AppBrand.ProductName, MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        try
        {
            if (!await _kiosk.IsRunningAsync())
                await _kiosk.StartAsync();
            if (await _kiosk.IsRunningAsync())
                _ui.OpenSetting();
            else
                MessageBox.Show("服務未就緒。", AppBrand.ProductName, MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "無法開啟", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        await RefreshStatusAsync();
    }

    private async void OnOpenWizard(object sender, RoutedEventArgs e)
    {
        var wiz = new SetupWizardWindow(_root) { Owner = this };
        wiz.ShowDialog();
        if (wiz.Applied)
        {
            _ui.CloseAll();
            _kiosk.Stop();
            try { await _kiosk.StartAsync(); }
            catch (Exception ex)
            {
                MessageBox.Show($"設定已儲存，但重啟服務失敗：{ex.Message}", AppBrand.ProductName,
                    MessageBoxButton.OK, MessageBoxImage.Warning);
            }
            EnsureInstallHooks(showAutostartError: true);
        }
        await RefreshStatusAsync();
    }

    private void EnsureInstallHooks(bool showAutostartError = false)
    {
        DesktopShortcutHelper.Ensure(_root);
        if (TrayAutostartHelper.TryRegister(_root, out var err)) return;
        if (showAutostartError && !string.IsNullOrEmpty(err))
            MessageBox.Show(err, AppBrand.ProductName, MessageBoxButton.OK, MessageBoxImage.Warning);
    }
}

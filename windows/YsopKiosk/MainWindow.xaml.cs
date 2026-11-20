using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace YsopKiosk;

public partial class MainWindow : Window
{
    private readonly string _root;
    private readonly KioskProcessService _kiosk;
    private readonly KioskUiHost _ui;
    private TrayIconService? _tray;
    private bool _allowExit;

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
            TxtStatus.Text = running ? "服務運行中（設定讀取失敗）" : "服務已停止";
            ApplySetupBadges(listenPort: 3010, allowPublic: false);
            BtnStartKiosk.IsEnabled = true;
            BtnStop.IsEnabled = running;
            BtnSetting.IsEnabled = true;
            await UpdateTrayTooltipAsync();
            return;
        }

        var allowPublic = bridge.GetBool("allowPublicBooking");
        ApplySetupBadges(bridge.GetInt("listenPort", 3010), allowPublic);

        TxtStatus.Text = running
            ? (allowPublic ? "服務運行中 · 已開放外部預約入站" : "服務運行中")
            : "服務已停止";

        BtnStartKiosk.IsEnabled = true;
        BtnStop.IsEnabled = running;
        BtnSetting.IsEnabled = true;
        await UpdateTrayTooltipAsync();
    }

    private void ApplySetupBadges(int listenPort, bool allowPublic)
    {
        var port = listenPort is >= 1 and <= 65535 ? listenPort : 3010;
        var label = allowPublic ? $"埠 {port} · 公開" : $"埠 {port}";
        // 服務設定就緒即顯示成功色；「公開」僅文案提示
        ApplyBadge(BadgeService, TxtServiceBadge, true, label, label);
        BtnOpenService.Content = "檢視／修改服務設定…";
        CardService.BorderBrush = (Brush)FindResource("CardBorderBrush");
    }

    private static void ApplyBadge(Border badge, TextBlock label, bool ok, string okText, string pendingText)
    {
        label.Text = ok ? okText : pendingText;
        if (ok)
        {
            badge.Background = (Brush)badge.FindResource("SuccessBackgroundBrush");
            badge.BorderBrush = (Brush)badge.FindResource("SuccessBorderBrush");
            label.Foreground = (Brush)badge.FindResource("SuccessTextBrush");
        }
        else
        {
            badge.Background = (Brush)badge.FindResource("PendingBackgroundBrush");
            badge.BorderBrush = (Brush)badge.FindResource("PendingBorderBrush");
            label.Foreground = (Brush)badge.FindResource("PendingTextBrush");
        }
    }

    internal async Task StartKioskAsync(bool showErrors = true)
    {
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

    private async void OnOpenServiceWizard(object sender, RoutedEventArgs e)
    {
        var wiz = new SetupWizardWindow(_root) { Owner = this };
        wiz.ShowDialog();
        if (wiz.Applied)
            await RestartAfterConfigAsync(startIfStopped: true);
        await RefreshStatusAsync();
    }

    private async Task RestartAfterConfigAsync(bool startIfStopped)
    {
        var wasRunning = await _kiosk.IsRunningAsync();
        _ui.CloseAll();
        _kiosk.Stop();
        if (!wasRunning && !startIfStopped)
        {
            EnsureInstallHooks(showAutostartError: true);
            return;
        }
        try { await _kiosk.StartAsync(); }
        catch (Exception ex)
        {
            MessageBox.Show($"設定已儲存，但重啟服務失敗：{ex.Message}", AppBrand.ProductName,
                MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        EnsureInstallHooks(showAutostartError: true);
    }

    private void EnsureInstallHooks(bool showAutostartError = false)
    {
        DesktopShortcutHelper.Ensure(_root);
        if (TrayAutostartHelper.TryRegister(_root, out var err)) return;
        if (showAutostartError && !string.IsNullOrEmpty(err))
            MessageBox.Show(err, AppBrand.ProductName, MessageBoxButton.OK, MessageBoxImage.Warning);
    }
}

using System.Windows;
using System.Windows.Media;

namespace YsopKiosk;

public partial class LicenseWizardWindow : Window
{
    private readonly string _root;
    private bool _busy;

    public LicenseWizardWindow(string root)
    {
        InitializeComponent();
        _root = root;
        Loaded += async (_, _) => await RunOperationAsync(LoadStatusAsync);
    }

    private async Task LoadStatusAsync()
    {
        var st = await YscpBridgeClient.RunAsync(_root, "status");
        if (!st.Ok)
        {
            SetLicenseBanner(
                ok: false,
                title: "無法讀取授權狀態",
                detail: "請確認 tools\\yscp-bridge.cjs 與 app\\.env 是否存在。");
            return;
        }
        ApplyLicenseStatus(st);
    }

    private void ApplyLicenseStatus(BridgeResult st)
    {
        var licensed = st.GetBool("licensed");
        if (licensed)
        {
            var sn = st.GetString("serialNumber");
            var method = st.GetString("activationMethod");
            var snText = string.IsNullOrWhiteSpace(sn) ? "—" : sn.Trim();
            var methodText = string.IsNullOrWhiteSpace(method) ? "" : $"（{method.Trim()}）";
            SetLicenseBanner(
                ok: true,
                title: "✓ 已授權 visitor",
                detail: $"序號 {snText}{methodText}\n可關閉此視窗，或輸入新 Key 再次啟用／匯入。");
        }
        else
        {
            SetLicenseBanner(
                ok: false,
                title: "尚未授權",
                detail: "請輸入 License Key 線上啟用，或使用離線請求／匯入。");
        }
    }

    private void SetLicenseBanner(bool ok, string title, string detail)
    {
        TxtLicenseTitle.Text = title;
        TxtLicenseDetail.Text = detail;
        if (ok)
        {
            BannerLicense.Background = (Brush)FindResource("SuccessBackgroundBrush");
            BannerLicense.BorderBrush = (Brush)FindResource("SuccessBorderBrush");
            TxtLicenseTitle.Foreground = (Brush)FindResource("SuccessTextBrush");
        }
        else
        {
            BannerLicense.Background = (Brush)FindResource("PendingBackgroundBrush");
            BannerLicense.BorderBrush = (Brush)FindResource("PendingBorderBrush");
            TxtLicenseTitle.Foreground = (Brush)FindResource("PendingTextBrush");
        }
    }

    private async Task RunOperationAsync(Func<Task> operation)
    {
        _busy = true;
        LicenseActions.IsEnabled = false;
        BtnClose.IsEnabled = false;
        try { await operation(); }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, Title, MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            _busy = false;
            LicenseActions.IsEnabled = true;
            BtnClose.IsEnabled = true;
        }
    }

    private async Task ApplyLicenseAsync(string command, params string[] args)
    {
        var res = await YscpBridgeClient.RunAsync(_root, [command, .. args]);
        if (!res.Ok)
        {
            MessageBox.Show(this, res.Error, Title, MessageBoxButton.OK, MessageBoxImage.Error);
            return;
        }
        ApplyLicenseStatus(res);
        TxtLicenseKey.Clear();
    }

    private async void OnLicenseActivate(object sender, RoutedEventArgs e)
    {
        var key = TxtLicenseKey.Text.Trim();
        if (key.Length == 0)
        {
            MessageBox.Show(this, "請輸入 License Key。", Title, MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        await RunOperationAsync(() => ApplyLicenseAsync("license-activate", "--key", key));
    }

    private async void OnLicenseOfflineRequest(object sender, RoutedEventArgs e)
    {
        var key = TxtLicenseKey.Text.Trim();
        if (string.IsNullOrEmpty(key))
        {
            MessageBox.Show("請先在 License Key 欄輸入 LK，再產生離線請求檔。", "授權設定",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        var dlg = new Microsoft.Win32.SaveFileDialog
        {
            Title = "儲存離線授權請求檔",
            Filter = "JSON (*.json)|*.json",
            FileName = $"ysop-kiosk-license-request-{DateTime.Now:yyyyMMddHHmmss}.json",
        };
        if (dlg.ShowDialog(this) != true) return;

        await RunOperationAsync(async () =>
        {
            var res = await YscpBridgeClient.RunAsync(
                _root, "license-offline-request", "--key", key);
            if (!res.Ok)
            {
                MessageBox.Show(res.Error ?? "產生請求檔失敗", "授權設定",
                    MessageBoxButton.OK, MessageBoxImage.Error);
                return;
            }
            var b64 = res.GetString("requestFileBase64");
            if (string.IsNullOrEmpty(b64))
            {
                MessageBox.Show("bridge 未回傳請求檔內容。", "授權設定",
                    MessageBoxButton.OK, MessageBoxImage.Error);
                return;
            }
            var bytes = Convert.FromBase64String(b64);
            await System.IO.File.WriteAllBytesAsync(dlg.FileName, bytes);
            MessageBox.Show(
                $"已儲存請求檔：\n{dlg.FileName}\n\n請交授權平台離線啟用後，再匯入回應檔。",
                "授權設定", MessageBoxButton.OK, MessageBoxImage.Information);
        });
    }

    private async void OnLicenseOfflineImport(object sender, RoutedEventArgs e)
    {
        var dlg = new Microsoft.Win32.OpenFileDialog
        {
            Title = "選擇離線授權回應檔",
            Filter = "JSON (*.json)|*.json|所有檔案 (*.*)|*.*",
        };
        if (dlg.ShowDialog(this) != true) return;

        await RunOperationAsync(() => ApplyLicenseAsync("license-offline-import", "--file", dlg.FileName));
    }

    private void OnClosing(object? sender, System.ComponentModel.CancelEventArgs e) => e.Cancel = _busy;

    private void OnClose(object sender, RoutedEventArgs e) => Close();
}

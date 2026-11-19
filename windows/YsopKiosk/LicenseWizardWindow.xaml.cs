using System.Windows;
using System.Windows.Media;

namespace YsopKiosk;

public partial class LicenseWizardWindow : Window
{
    private readonly string _root;
    private bool _licensed;

    /// <summary>本次有成功啟用／匯入授權時為 true（主視窗可重啟服務以載入授權）。</summary>
    public bool Applied { get; private set; }

    public LicenseWizardWindow(string root)
    {
        InitializeComponent();
        _root = root;
        Loaded += async (_, _) => await LoadStatusAsync();
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
        _licensed = licensed;
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

    private async Task<bool> ActivateLicenseKeyAsync(string key, bool showSuccess)
    {
        BtnLicenseActivate.IsEnabled = false;
        try
        {
            var res = await YscpBridgeClient.RunAsync(_root, "license-activate", "--key", key);
            if (!res.Ok)
            {
                MessageBox.Show(res.Error ?? "授權啟用失敗", "授權設定",
                    MessageBoxButton.OK, MessageBoxImage.Error);
                return false;
            }
            ApplyLicenseStatus(res);
            if (!_licensed)
            {
                MessageBox.Show("啟用完成，但未含 visitor 功能。", "授權設定",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }
            Applied = true;
            TxtLicenseKey.Text = "";
            if (showSuccess)
            {
                MessageBox.Show("產品授權啟用成功。", "授權設定",
                    MessageBoxButton.OK, MessageBoxImage.Information);
            }
            return true;
        }
        finally
        {
            BtnLicenseActivate.IsEnabled = true;
        }
    }

    private async void OnLicenseActivate(object sender, RoutedEventArgs e)
    {
        var key = TxtLicenseKey.Text.Trim();
        if (string.IsNullOrEmpty(key))
        {
            MessageBox.Show("請輸入 License Key。", "授權設定",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        try
        {
            await ActivateLicenseKeyAsync(key, showSuccess: true);
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "授權設定", MessageBoxButton.OK, MessageBoxImage.Error);
        }
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

        BtnLicenseActivate.IsEnabled = false;
        try
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
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "授權設定", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            BtnLicenseActivate.IsEnabled = true;
        }
    }

    private async void OnLicenseOfflineImport(object sender, RoutedEventArgs e)
    {
        var dlg = new Microsoft.Win32.OpenFileDialog
        {
            Title = "選擇離線授權回應檔",
            Filter = "JSON (*.json)|*.json|所有檔案 (*.*)|*.*",
        };
        if (dlg.ShowDialog(this) != true) return;

        BtnLicenseActivate.IsEnabled = false;
        try
        {
            var res = await YscpBridgeClient.RunAsync(
                _root, "license-offline-import", "--file", dlg.FileName);
            if (!res.Ok)
            {
                MessageBox.Show(res.Error ?? "匯入失敗", "授權設定",
                    MessageBoxButton.OK, MessageBoxImage.Error);
                return;
            }
            ApplyLicenseStatus(res);
            if (!_licensed)
            {
                MessageBox.Show("已匯入，但未含 visitor 功能。", "授權設定",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            Applied = true;
            MessageBox.Show("離線授權匯入成功。", "授權設定",
                MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "授權設定", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            BtnLicenseActivate.IsEnabled = true;
        }
    }

    private void OnClose(object sender, RoutedEventArgs e)
    {
        DialogResult = Applied;
        Close();
    }
}

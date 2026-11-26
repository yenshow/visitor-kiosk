using System.Windows;

namespace YsopKiosk;

public partial class SetupWizardWindow : Window
{
    private readonly string _root;
    private int _listenPort = 3010;
    public bool Applied { get; private set; }

    public SetupWizardWindow(string root)
    {
        InitializeComponent();
        _root = root;
        Loaded += async (_, _) => await LoadInitialAsync();
    }

    private bool TryParseListenPort(out int port, out string error)
    {
        error = "";
        port = 3010;
        if (!int.TryParse(TxtListenPort.Text.Trim(), out port) || port < 1 || port > 65535)
        {
            error = "服務埠須為 1–65535（可用 80）。";
            return false;
        }
        return true;
    }

    private async Task LoadInitialAsync()
    {
        var st = await YscpBridgeClient.RunAsync(_root, "status");
        if (!st.Ok) return;
        var port = st.GetInt("listenPort");
        if (port is >= 1 and <= 65535)
        {
            _listenPort = port;
            TxtListenPort.Text = port.ToString();
        }
        TxtAdminIps.Text = st.GetString("adminIps") ?? "";
        TxtPublicBookingUrl.Text = st.GetString("publicBookingUrl");
    }

    private async Task<bool> SaveServiceAsync()
    {
        if (!TryParseListenPort(out var port, out var err))
        {
            MessageBox.Show(err, "服務設定", MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }
        _listenPort = port;
        var save = await YscpBridgeClient.RunAsync(
            _root,
            "save-service",
            "--port",
            port.ToString(),
            "--admin-ips",
            TxtAdminIps.Text,
            "--public-booking-url",
            TxtPublicBookingUrl.Text.Trim());
        if (save.Ok) return true;
        MessageBox.Show(save.Error ?? "儲存失敗", "服務設定",
            MessageBoxButton.OK, MessageBoxImage.Error);
        return false;
    }

    private async void OnApply(object sender, RoutedEventArgs e)
    {
        BtnApply.IsEnabled = false;
        try
        {
            if (!await SaveServiceAsync()) return;

            var (fwOk, fwMsg) = FirewallHelper.ApplyInboundAllow(
                _listenPort,
                TxtAdminIps.Text);

            Applied = true;
            var msg = "服務設定已套用。";
            if (fwOk)
                msg += $"\n{fwMsg}";
            else
                msg += $"\n\n防火牆規則尚未更新：{fwMsg}\n請重新套用並在 UAC 按「是」。";

            MessageBox.Show(
                msg,
                AppBrand.ProductName,
                MessageBoxButton.OK,
                fwOk ? MessageBoxImage.Information : MessageBoxImage.Warning);
            DialogResult = true;
            Close();
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "錯誤", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            BtnApply.IsEnabled = true;
        }
    }

    private void OnCancel(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private void OnCopyPublicBookingUrl(object sender, RoutedEventArgs e)
    {
        var url = TxtPublicBookingUrl.Text.Trim();
        if (url.Length == 0)
        {
            TxtPublicBookingUrl.Focus();
            return;
        }

        try
        {
            Clipboard.SetText(url);
            MessageBox.Show(this, "已複製外部預約網址。", Title);
        }
        catch (System.Runtime.InteropServices.ExternalException)
        {
            MessageBox.Show(this, "無法存取剪貼簿，請稍後再試。", Title,
                MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }
}

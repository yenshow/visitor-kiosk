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
        ChkAllowPublic.IsChecked = st.GetBool("allowPublicBooking");
    }

    private async Task<bool> SaveServiceAsync()
    {
        if (!TryParseListenPort(out var port, out var err))
        {
            MessageBox.Show(err, "服務設定", MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }
        _listenPort = port;
        var allowPublic = ChkAllowPublic.IsChecked == true;
        var save = await YscpBridgeClient.RunAsync(
            _root,
            "save-service",
            "--port",
            port.ToString(),
            "--admin-ips",
            TxtAdminIps.Text,
            "--allow-public",
            allowPublic ? "1" : "0");
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

            var allowPublic = ChkAllowPublic.IsChecked == true;
            var (fwOk, fwMsg) = FirewallHelper.ApplyInboundAllow(
                _listenPort,
                TxtAdminIps.Text,
                allowPublic);

            Applied = true;
            var msg = "服務設定已套用。將重啟訪客機服務。";
            if (fwOk)
                msg += $"\n{fwMsg}";
            else
                msg += $"\n\n注意：防火牆未更新 — {fwMsg}\n請重新套用並在 UAC 按「是」，或以系統管理員手動放行入站 TCP {_listenPort}。";

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
}

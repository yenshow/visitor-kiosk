using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;

namespace YsopKiosk;

public partial class SetupWizardWindow : Window
{
    private readonly string _root;
    private readonly List<ExitLaneItem> _lanes = new();
    private int _listenPort = 3010;
    public bool Applied { get; private set; }

    public SetupWizardWindow(string root)
    {
        InitializeComponent();
        _root = root;
        Loaded += async (_, _) => await LoadInitialAsync();
    }

    private string DestTemplate => $"http://192.168.x.x:{_listenPort}/api/yscp/events";

    private void RefreshDestHint()
    {
        TxtDestHint.Text =
            $"範本：http://本機區網IP:{_listenPort}/api/yscp/events（YSCP 須能連到，請用 http）";
    }

    private static bool LooksLikeIpv4(string raw)
    {
        var host = raw.Trim();
        if (host.Contains(':')) host = host.Split(':')[0];
        return IPAddress.TryParse(host, out var addr) &&
               addr.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork;
    }

    private static string ExtractIpv4(string raw)
    {
        var host = raw.Trim().Replace("https://", "", StringComparison.OrdinalIgnoreCase)
            .Replace("http://", "", StringComparison.OrdinalIgnoreCase)
            .Split('/')[0];
        if (host.Contains(':')) host = host.Split(':')[0];
        return LooksLikeIpv4(host) ? host : "";
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

    private void SyncDestPortIfNeeded()
    {
        if (!TryParseListenPort(out var port, out _)) return;
        _listenPort = port;
        RefreshDestHint();
        var dest = TxtEventDest.Text.Trim();
        if (string.IsNullOrEmpty(dest)) return;
        // 替換本機 webhook URL 的埠號
        var updated = Regex.Replace(
            dest,
            @"(https?://[^/:\s]+):(\d+)(/api/yscp/events)",
            $"$1:{port}$3",
            RegexOptions.IgnoreCase);
        if (updated != dest) TxtEventDest.Text = updated;
    }

    private void OnListenPortLostFocus(object sender, RoutedEventArgs e) => SyncDestPortIfNeeded();

    private async Task LoadInitialAsync()
    {
        var st = await YscpBridgeClient.RunAsync(_root, "status");
        if (st.Ok)
        {
            var host = st.GetString("host");
            if (!string.IsNullOrEmpty(host)) TxtHost.Text = host;
            TxtAk.Text = st.GetString("accessKey");
            TxtSk.Text = st.GetString("secretKey");
            var listen = st.GetInt("listenPort", 3010);
            if (listen is >= 1 and <= 65535)
            {
                _listenPort = listen;
                TxtListenPort.Text = listen.ToString();
            }
            TxtAdminIps.Text = st.GetString("adminIps").Replace(",", "\n");

            _lanes.Clear();
            if (st.Raw.ValueKind == JsonValueKind.Object &&
                st.Raw.TryGetProperty("exitLanes", out var lanes) &&
                lanes.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in lanes.EnumerateArray())
                {
                    var cam = el.TryGetProperty("cameraIndexCode", out var c) ? c.GetString() ?? "" : "";
                    var relay = el.TryGetProperty("alarmOutputIndexCode", out var r) ? r.GetString() ?? "" : "";
                    if (string.IsNullOrEmpty(cam) || string.IsNullOrEmpty(relay)) continue;
                    _lanes.Add(new ExitLaneItem
                    {
                        CameraIndexCode = cam,
                        AlarmOutputIndexCode = relay,
                    });
                }
            }
            RefreshLanesLabel();
        }

        RefreshDestHint();

        var ips = await YscpBridgeClient.RunAsync(_root, "lan-ips");
        var current = ips.GetString("currentDest");
        if (!string.IsNullOrEmpty(current))
        {
            TxtEventDest.Text = current;
            SyncDestPortIfNeeded();
            return;
        }
        if (ips.Ok && ips.Raw.ValueKind == JsonValueKind.Object &&
            ips.Raw.TryGetProperty("dests", out var dests) &&
            dests.ValueKind == JsonValueKind.Array)
        {
            var first = dests.EnumerateArray().Select(d => d.GetString())
                .FirstOrDefault(s => !string.IsNullOrEmpty(s));
            if (!string.IsNullOrEmpty(first))
            {
                TxtEventDest.Text = first;
                SyncDestPortIfNeeded();
                return;
            }
        }
        TxtEventDest.Text = DestTemplate;
    }

    private void RefreshLanesLabel()
    {
        if (_lanes.Count == 0)
        {
            TxtLanes.Text = "尚未加入車道。請載入裝置後選取並按「加入此組車道」。";
            return;
        }
        TxtLanes.Text = string.Join("\n",
            _lanes.Select((l, i) =>
                $"{i + 1}. 相機 {l.CameraIndexCode}  →  繼電器 {l.AlarmOutputIndexCode}"));
    }

    private string ResolveDest() => TxtEventDest.Text.Trim();

    private bool TryValidateConnection(out string error)
    {
        error = "";
        if (string.IsNullOrWhiteSpace(TxtHost.Text))
        {
            error = "HOST 必填。";
            return false;
        }
        if (string.IsNullOrWhiteSpace(TxtAk.Text) || string.IsNullOrWhiteSpace(TxtSk.Text))
        {
            error = "請填入 AK、SK。";
            return false;
        }
        if (!TryParseListenPort(out _listenPort, out error)) return false;

        var hostIp = ExtractIpv4(TxtHost.Text);
        if (string.IsNullOrEmpty(hostIp) || !LooksLikeIpv4(hostIp))
        {
            error = "HOST 須為 YSCP 的 IPv4（防火牆來源＝HOST）。";
            return false;
        }

        var dest = ResolveDest();
        if (string.IsNullOrWhiteSpace(dest) || dest.Contains("192.168.x.x", StringComparison.Ordinal))
        {
            error = "請填入實際 Webhook URL（將範本中的 IP 改為本機區網 IP）。";
            return false;
        }
        if (!dest.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !dest.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            error = "Webhook 須為完整 URL（建議 http://…）。";
            return false;
        }
        return true;
    }

    private async Task<bool> SaveConnectionAsync()
    {
        if (!TryParseListenPort(out var port, out var err))
        {
            MessageBox.Show(err, "YSCP", MessageBoxButton.OK, MessageBoxImage.Warning);
            return false;
        }
        _listenPort = port;
        SyncDestPortIfNeeded();

        var save = await YscpBridgeClient.RunAsync(_root,
            "save-connection",
            "--host", TxtHost.Text.Trim(),
            "--ak", TxtAk.Text.Trim(),
            "--sk", TxtSk.Text.Trim(),
            "--event-dest", ResolveDest(),
            "--port", port.ToString(),
            "--admin-ips", TxtAdminIps.Text.Trim());
        if (!save.Ok)
        {
            MessageBox.Show(save.Error ?? "儲存連線失敗", "YSCP", MessageBoxButton.OK, MessageBoxImage.Error);
            return false;
        }
        return true;
    }

    private async void OnLoadDevices(object sender, RoutedEventArgs e)
    {
        if (!TryValidateConnection(out var err))
        {
            MessageBox.Show(err, "YSCP", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        BtnLoadDevices.IsEnabled = false;
        BtnApply.IsEnabled = false;
        try
        {
            if (!await SaveConnectionAsync()) return;
            await LoadCamerasAsync();
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "錯誤", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            BtnLoadDevices.IsEnabled = true;
            BtnApply.IsEnabled = true;
        }
    }

    private async Task LoadCamerasAsync()
    {
        ListCams.Items.Clear();
        ListRelays.Items.Clear();
        var res = await YscpBridgeClient.RunAsync(_root, "cameras");
        if (!res.Ok)
        {
            MessageBox.Show(res.Error ?? "無法列出相機", "YSCP", MessageBoxButton.OK, MessageBoxImage.Error);
            return;
        }
        if (res.Raw.TryGetProperty("cameras", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            foreach (var c in arr.EnumerateArray())
            {
                ListCams.Items.Add(new CamItem
                {
                    CameraIndexCode = c.GetProperty("cameraIndexCode").GetString() ?? "",
                    CameraName = c.TryGetProperty("cameraName", out var n) ? n.GetString() ?? "" : "",
                    EncodeDevIndexCode = c.TryGetProperty("encodeDevIndexCode", out var d) ? d.GetString() ?? "" : "",
                    LikelyLpr = c.TryGetProperty("likelyLpr", out var l) && l.ValueKind == JsonValueKind.True,
                });
            }
        }
        if (ListCams.Items.Count == 0)
            MessageBox.Show("未取得相機清單。", "YSCP", MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private async void OnCamSelected(object sender, SelectionChangedEventArgs e)
    {
        ListRelays.Items.Clear();
        if (ListCams.SelectedItem is not CamItem cam) return;
        if (string.IsNullOrEmpty(cam.EncodeDevIndexCode))
        {
            MessageBox.Show("此相機缺少 encodeDevIndexCode", "YSCP", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        var res = await YscpBridgeClient.RunAsync(_root, "relays", "--dev", cam.EncodeDevIndexCode);
        if (!res.Ok)
        {
            MessageBox.Show(res.Error ?? "無法列出繼電器", "YSCP", MessageBoxButton.OK, MessageBoxImage.Error);
            return;
        }
        if (res.Raw.TryGetProperty("relays", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            foreach (var r in arr.EnumerateArray())
            {
                ListRelays.Items.Add(new RelayItem
                {
                    AlarmOutputIndexCode = r.GetProperty("alarmOutputIndexCode").GetString() ?? "",
                    AlarmOutputName = r.TryGetProperty("alarmOutputName", out var n) ? n.GetString() ?? "" : "",
                });
            }
        }
    }

    private void OnAddLane(object sender, RoutedEventArgs e)
    {
        if (ListCams.SelectedItem is not CamItem cam || ListRelays.SelectedItem is not RelayItem relay)
        {
            MessageBox.Show("請選擇出口 LPR 與繼電器後再加入。", "YSCP",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        if (_lanes.Any(l =>
                l.CameraIndexCode == cam.CameraIndexCode &&
                l.AlarmOutputIndexCode == relay.AlarmOutputIndexCode))
        {
            MessageBox.Show("此組車道已加入。", "YSCP", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        _lanes.Add(new ExitLaneItem
        {
            CameraIndexCode = cam.CameraIndexCode,
            AlarmOutputIndexCode = relay.AlarmOutputIndexCode,
        });
        RefreshLanesLabel();
    }

    private void OnClearLanes(object sender, RoutedEventArgs e)
    {
        _lanes.Clear();
        RefreshLanesLabel();
    }

    private async void OnApply(object sender, RoutedEventArgs e)
    {
        if (!TryValidateConnection(out var err))
        {
            MessageBox.Show(err, "YSCP", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        if (_lanes.Count == 0)
        {
            MessageBox.Show("請至少加入一組出口車道。", "YSCP",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        BtnApply.IsEnabled = false;
        try
        {
            if (!await SaveConnectionAsync()) return;

            var lanesJson = JsonSerializer.Serialize(_lanes.Select(l => new
            {
                cameraIndexCode = l.CameraIndexCode,
                alarmOutputIndexCode = l.AlarmOutputIndexCode,
            }));
            var saveLanes = await YscpBridgeClient.RunAsync(_root, "save-lanes", "--json", lanesJson);
            if (!saveLanes.Ok)
            {
                MessageBox.Show(saveLanes.Error ?? "寫入車道失敗", "YSCP",
                    MessageBoxButton.OK, MessageBoxImage.Error);
                return;
            }

            var sub = await YscpBridgeClient.RunAsync(_root, "subscribe");
            if (!sub.Ok)
            {
                MessageBox.Show(
                    $"設定已寫入，但訂閱失敗：{sub.Error}\n可稍後再按套用重試。",
                    "YSCP", MessageBoxButton.OK, MessageBoxImage.Warning);
            }

            var (fwOk, fwMsg) = FirewallHelper.ApplyInboundAllow(
                _listenPort,
                ExtractIpv4(TxtHost.Text),
                TxtAdminIps.Text);
            if (!fwOk)
            {
                MessageBox.Show(
                    $"設定已寫入，但防火牆未更新：{fwMsg}\n請以系統管理員手動放行入站 TCP {_listenPort}（僅 YSCP／管理員 IP）。",
                    AppBrand.ProductName, MessageBoxButton.OK, MessageBoxImage.Warning);
            }

            Applied = true;
            var extra = fwOk ? $"\n{fwMsg}" : "";
            MessageBox.Show(
                $"YSCP 設定已套用（含事件訂閱）。將重啟訪客機服務。{extra}",
                AppBrand.ProductName,
                MessageBoxButton.OK, MessageBoxImage.Information);
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

    private sealed class CamItem
    {
        public string CameraIndexCode { get; init; } = "";
        public string CameraName { get; init; } = "";
        public string EncodeDevIndexCode { get; init; } = "";
        public bool LikelyLpr { get; init; }
        public override string ToString() =>
            $"{CameraName}{(LikelyLpr ? " [LPR]" : "")}  ({CameraIndexCode})";
    }

    private sealed class RelayItem
    {
        public string AlarmOutputIndexCode { get; init; } = "";
        public string AlarmOutputName { get; init; } = "";
        public override string ToString() =>
            $"{AlarmOutputName}  ({AlarmOutputIndexCode})";
    }

    private sealed class ExitLaneItem
    {
        public string CameraIndexCode { get; init; } = "";
        public string AlarmOutputIndexCode { get; init; } = "";
    }
}

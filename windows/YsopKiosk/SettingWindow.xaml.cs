using System.Windows;

namespace YsopKiosk;

public partial class SettingWindow : Window
{
    private readonly string _url;
    private bool _initialized;

    public SettingWindow(string url)
    {
        InitializeComponent();
        _url = url;
        Loaded += async (_, _) => await InitAsync();
    }

    private async Task InitAsync()
    {
        if (_initialized) return;
        _initialized = true;
        try
        {
            await WebView.EnsureCoreWebView2Async();
            WebView.CoreWebView2.Navigate(_url);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"無法載入畫面設定（需安裝 WebView2 Runtime）。\n{ex.Message}",
                AppBrand.ProductName, MessageBoxButton.OK, MessageBoxImage.Warning);
            Close();
        }
    }
}

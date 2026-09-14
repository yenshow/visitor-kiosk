using System.Windows;
using System.Windows.Input;

namespace YsopKiosk;

public partial class KioskWindow : Window
{
    private readonly string _url;
    private bool _initialized;

    public KioskWindow(string url)
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
            WebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            WebView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            WebView.CoreWebView2.Navigate(_url);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"無法載入訪客畫面（需安裝 WebView2 Runtime）。\n{ex.Message}",
                AppBrand.ProductName, MessageBoxButton.OK, MessageBoxImage.Error);
            Close();
        }
    }

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape)
        {
            e.Handled = true;
            Close();
        }
    }
}

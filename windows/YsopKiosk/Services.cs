using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Diagnostics;

namespace YsopKiosk;

internal static class InstallRootResolver
{
    internal const string ManagerExeName = "YsopKiosk.exe";

    /// <summary>Portable root: contains app\, node\, tools\ next to exe (or repo windows\..).</summary>
    internal static string Resolve()
    {
        var exeDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        // Single-file extract dir may differ; prefer exe location
        try
        {
            var exe = Environment.ProcessPath;
            if (!string.IsNullOrEmpty(exe))
                exeDir = Path.GetDirectoryName(exe) ?? exeDir;
        }
        catch { /* ignore */ }

        if (LooksLikePortableRoot(exeDir)) return exeDir;

        var parent = Directory.GetParent(exeDir)?.FullName;
        if (parent is not null && LooksLikePortableRoot(parent)) return parent;

        // Dev: windows/YsopKiosk/bin/... → repo root or dist/YsopKiosk
        var cursor = new DirectoryInfo(exeDir);
        for (var i = 0; i < 8 && cursor is not null; i++, cursor = cursor.Parent)
        {
            if (LooksLikePortableRoot(cursor.FullName)) return cursor.FullName;
            var dist = Path.Combine(cursor.FullName, "dist", "YsopKiosk");
            if (LooksLikePortableRoot(dist)) return dist;
        }

        return exeDir;
    }

    /// <summary>安裝根目錄下的管理程式，或目前行程路徑。</summary>
    internal static string? ResolveManagerExe(string installRoot)
    {
        var portable = Path.Combine(installRoot, ManagerExeName);
        if (File.Exists(portable)) return Path.GetFullPath(portable);
        try
        {
            var self = Environment.ProcessPath;
            if (!string.IsNullOrEmpty(self) && File.Exists(self)) return Path.GetFullPath(self);
        }
        catch { /* ignore */ }
        return null;
    }

    private static bool LooksLikePortableRoot(string dir) =>
        Directory.Exists(Path.Combine(dir, "app")) &&
        (File.Exists(Path.Combine(dir, "node", "node.exe")) ||
         File.Exists(Path.Combine(dir, "app", "server.js")));
}

internal sealed class BridgeResult
{
    public bool Ok { get; init; }
    public string? Error { get; init; }
    public JsonElement Raw { get; init; }

    public string GetString(string name, string fallback = "")
    {
        if (Raw.ValueKind != JsonValueKind.Object) return fallback;
        if (!Raw.TryGetProperty(name, out var el)) return fallback;
        return el.ValueKind == JsonValueKind.String ? (el.GetString() ?? fallback) : el.ToString();
    }

    public bool GetBool(string name) =>
        Raw.ValueKind == JsonValueKind.Object &&
        Raw.TryGetProperty(name, out var el) &&
        el.ValueKind == JsonValueKind.True;

    public int GetInt(string name, int fallback = 0)
    {
        if (Raw.ValueKind != JsonValueKind.Object) return fallback;
        if (!Raw.TryGetProperty(name, out var el)) return fallback;
        if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var n)) return n;
        if (el.ValueKind == JsonValueKind.String && int.TryParse(el.GetString(), out var s)) return s;
        return fallback;
    }
}

internal static class YscpBridgeClient
{
    internal static async Task<BridgeResult> RunAsync(string root, params string[] args)
    {
        var node = Path.Combine(root, "node", "node.exe");
        var bridge = Path.Combine(root, "tools", "yscp-bridge.cjs");
        if (!File.Exists(node))
            return Fail($"找不到 node.exe：{node}");
        if (!File.Exists(bridge))
            return Fail($"找不到 yscp-bridge.cjs：{bridge}");

        var psi = new ProcessStartInfo
        {
            FileName = node,
            WorkingDirectory = root,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        psi.ArgumentList.Add(bridge);
        psi.ArgumentList.Add("--root");
        psi.ArgumentList.Add(root);
        foreach (var a in args) psi.ArgumentList.Add(a);

        using var proc = Process.Start(psi) ?? throw new InvalidOperationException("無法啟動 node bridge");
        var stdout = await proc.StandardOutput.ReadToEndAsync();
        var stderr = await proc.StandardError.ReadToEndAsync();
        await proc.WaitForExitAsync();

        var line = stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .LastOrDefault();
        if (string.IsNullOrWhiteSpace(line))
            return Fail(string.IsNullOrWhiteSpace(stderr) ? "bridge 無輸出" : stderr.Trim());

        try
        {
            using var doc = JsonDocument.Parse(line);
            var rootEl = doc.RootElement.Clone();
            var ok = rootEl.TryGetProperty("ok", out var okEl) && okEl.ValueKind == JsonValueKind.True;
            var err = rootEl.TryGetProperty("error", out var errEl) ? errEl.GetString() : null;
            return new BridgeResult { Ok = ok, Error = err, Raw = rootEl };
        }
        catch (Exception ex)
        {
            return Fail($"JSON 解析失敗：{ex.Message}\n{line}");
        }
    }

    private static BridgeResult Fail(string message) =>
        new() { Ok = false, Error = message, Raw = default };
}

internal sealed class KioskProcessService
{
    private readonly string _root;
    private Process? _node;

    internal KioskProcessService(string root) => _root = root;

    internal string PidFile => Path.Combine(_root, "runtime", "node.pid");
    internal string LogFile => Path.Combine(_root, "runtime", "server.log");
    internal string ErrFile => Path.Combine(_root, "runtime", "server.err.log");

    /** 與 app\.env 的 PORT 同步（預設 3010） */
    internal int Port => DotEnvReader.GetListenPort(_root);

    internal async Task<bool> IsRunningAsync()
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            var res = await client.GetAsync($"http://127.0.0.1:{Port}/api/kiosk/status");
            return res.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    internal async Task StartAsync()
    {
        if (await IsRunningAsync()) return;

        var node = Path.Combine(_root, "node", "node.exe");
        var server = Path.Combine(_root, "app", "server.js");
        var appDir = Path.Combine(_root, "app");
        var wrap = Path.Combine(_root, "tools", "with-client-ip.cjs");
        if (!File.Exists(node) || !File.Exists(server))
            throw new FileNotFoundException("找不到 node.exe 或 app\\server.js");

        Directory.CreateDirectory(Path.Combine(_root, "runtime"));
        Directory.CreateDirectory(Path.Combine(appDir, "data"));

        var listenPort = Port;
        var psi = new ProcessStartInfo
        {
            FileName = node,
            WorkingDirectory = appDir,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        // 優先用 IP 注入包裝；缺檔時退回直接啟動 server.js
        if (File.Exists(wrap))
            psi.ArgumentList.Add(wrap);
        else
            psi.ArgumentList.Add(server);
        psi.Environment["PORT"] = listenPort.ToString();
        psi.Environment["HOSTNAME"] = "0.0.0.0";
        psi.Environment["NEXT_TELEMETRY_DISABLED"] = "1";

        _node = Process.Start(psi) ?? throw new InvalidOperationException("無法啟動 Node");
        await File.WriteAllTextAsync(PidFile, _node.Id.ToString(), Encoding.ASCII);

        _ = Task.Run(async () =>
        {
            try
            {
                var so = await _node.StandardOutput.ReadToEndAsync();
                await File.AppendAllTextAsync(LogFile, so);
            }
            catch { /* ignore */ }
        });
        _ = Task.Run(async () =>
        {
            try
            {
                var se = await _node.StandardError.ReadToEndAsync();
                await File.AppendAllTextAsync(ErrFile, se);
            }
            catch { /* ignore */ }
        });

        for (var i = 0; i < 60; i++)
        {
            await Task.Delay(500);
            if (await IsRunningAsync()) return;
            if (_node.HasExited) break;
        }

        var hint = listenPort is 80 or 443
            ? "（綁定 80／443 等特權埠可能需以系統管理員執行 YsopKiosk.exe）"
            : "";
        throw new TimeoutException($"服務啟動逾時，請查看 runtime\\server.log{hint}");
    }

    internal void Stop()
    {
        try
        {
            if (File.Exists(PidFile))
            {
                var text = File.ReadAllText(PidFile).Trim();
                if (int.TryParse(text, out var pid))
                {
                    try
                    {
                        var p = Process.GetProcessById(pid);
                        p.Kill(entireProcessTree: true);
                        p.WaitForExit(5_000);
                    }
                    catch { /* already gone */ }
                }
                File.Delete(PidFile);
            }
        }
        catch { /* ignore */ }

        // Fallback: kill this pack's node.exe if pidfile missing
        try
        {
            var nodeExe = Path.GetFullPath(Path.Combine(_root, "node", "node.exe"));
            foreach (var p in Process.GetProcessesByName("node"))
            {
                try
                {
                    var path = p.MainModule?.FileName;
                    if (path is not null &&
                        string.Equals(Path.GetFullPath(path), nodeExe, StringComparison.OrdinalIgnoreCase))
                    {
                        p.Kill(entireProcessTree: true);
                    }
                }
                catch { /* access denied / exited */ }
            }
        }
        catch { /* ignore */ }

        try
        {
            _node?.Kill(entireProcessTree: true);
        }
        catch { /* ignore */ }
        _node = null;
    }
}

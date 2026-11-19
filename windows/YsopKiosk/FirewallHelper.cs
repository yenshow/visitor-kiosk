using System.Diagnostics;
using System.IO;
using System.Net;
using System.Security.Principal;

namespace YsopKiosk;

/// <summary>
/// 入站防火牆：僅放行本機與管理員 IP。
/// 已管理員 → COM 直寫；否則 UAC 提升 <c>--firewall-apply</c>。
/// </summary>
internal static class FirewallHelper
{
    internal const string RuleName = "YSOP Kiosk";
    private const string CliFlag = "--firewall-apply";

    internal static bool TryHandleCli(string[] args, out int exitCode)
    {
        exitCode = 1;
        if (args.Length < 3) return false;
        if (!string.Equals(args[0], CliFlag, StringComparison.OrdinalIgnoreCase))
            return false;

        if (!int.TryParse(args[1], out var port) || port is < 1 or > 65535)
        {
            exitCode = 2;
            return true;
        }

        var remotes = ParseRemoteIps(args[2]);
        if (remotes.Count == 0)
        {
            exitCode = 3;
            return true;
        }

        exitCode = TryWriteRule(port, remotes, out _) ? 0 : 4;
        return true;
    }

    internal static (bool ok, string message) ApplyInboundAllow(
        int localPort,
        string adminIpsMultiline)
    {
        if (localPort is < 1 or > 65535)
            return (false, "服務埠無效");

        var remotes = ParseRemoteIps("127.0.0.1", adminIpsMultiline);
        if (remotes.Count == 0)
            return (false, "遠端 IP 無效");

        var remoteCsv = string.Join(",", remotes);
        var okMsg = $"已限制入站 TCP {localPort} ← {remoteCsv}";

        if (IsAdministrator())
        {
            return TryWriteRule(localPort, remotes, out var err)
                ? (true, okMsg)
                : (false, err);
        }

        return ApplyViaElevation(localPort, remoteCsv, okMsg);
    }

    private static (bool ok, string message) ApplyViaElevation(
        int localPort,
        string remoteCsv,
        string okMsg)
    {
        var exe = Environment.ProcessPath;
        if (string.IsNullOrEmpty(exe) || !File.Exists(exe))
            return (false, "找不到 YsopKiosk.exe，無法提升權限寫入防火牆");

        try
        {
            using var proc = Process.Start(new ProcessStartInfo
            {
                FileName = exe,
                UseShellExecute = true,
                Verb = "runas",
                Arguments = $"{CliFlag} {localPort} \"{remoteCsv}\"",
            });
            if (proc is null) return (false, "無法啟動提升權限程序");

            if (!proc.WaitForExit(90_000))
            {
                try { proc.Kill(entireProcessTree: true); } catch { /* ignore */ }
                return (false, "防火牆設定逾時（請確認 UAC 並按「是」）");
            }

            return proc.ExitCode switch
            {
                0 => (true, okMsg),
                2 => (false, "服務埠無效"),
                3 => (false, "遠端 IP 無效"),
                _ => (false, "防火牆規則寫入失敗（請確認具備系統管理員權限）"),
            };
        }
        catch (System.ComponentModel.Win32Exception ex) when (ex.NativeErrorCode == 1223)
        {
            return (false, "已取消 UAC，防火牆未更新");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    private static bool TryWriteRule(
        int localPort,
        IReadOnlyList<string> remotes,
        out string error)
    {
        error = "";
        try
        {
            var policyType = Type.GetTypeFromProgID("HNetCfg.FwPolicy2");
            var ruleType = Type.GetTypeFromProgID("HNetCfg.FwRule");
            if (policyType is null || ruleType is null)
            {
                error = "本機不支援 Windows 防火牆 COM（HNetCfg）";
                return false;
            }

            dynamic policy = Activator.CreateInstance(policyType)
                ?? throw new InvalidOperationException("無法建立 FwPolicy2");
            dynamic rules = policy.Rules;

            for (var i = 0; i < 8; i++)
            {
                try { rules.Remove(RuleName); }
                catch { break; }
            }

            dynamic rule = Activator.CreateInstance(ruleType)
                ?? throw new InvalidOperationException("無法建立 FwRule");
            rule.Name = RuleName;
            rule.Description = "YSOP Kiosk：僅本機與管理員 IP";
            rule.Enabled = true;
            rule.Direction = 1; // IN
            rule.Action = 1; // ALLOW
            rule.Protocol = 6; // TCP
            rule.LocalPorts = localPort.ToString();
            rule.RemoteAddresses = string.Join(",", remotes);
            rule.Profiles = int.MaxValue;
            rules.Add(rule);
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    private static List<string> ParseRemoteIps(params string[] chunks)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var list = new List<string>();
        foreach (var chunk in chunks)
        {
            if (string.IsNullOrWhiteSpace(chunk)) continue;
            foreach (var part in chunk.Split(new[] { ',', ';', ' ', '\t', '\r', '\n' },
                         StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var ip = NormalizeIpv4(part);
                if (ip is null || !seen.Add(ip)) continue;
                list.Add(ip);
            }
        }
        return list;
    }

    private static string? NormalizeIpv4(string raw)
    {
        var s = raw.Trim();
        if (s.Length == 0) return null;
        if (s.Contains(':') && !s.Contains('.')) return null;
        if (s.Contains(':')) s = s.Split(':')[0];
        if (!IPAddress.TryParse(s, out var addr)) return null;
        if (addr.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork)
            return null;
        return addr.ToString();
    }

    private static bool IsAdministrator()
    {
        try
        {
            using var id = WindowsIdentity.GetCurrent();
            return new WindowsPrincipal(id).IsInRole(WindowsBuiltInRole.Administrator);
        }
        catch
        {
            return false;
        }
    }
}

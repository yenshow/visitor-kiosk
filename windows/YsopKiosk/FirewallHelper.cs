using System.Diagnostics;
using System.IO;
using System.Text;

namespace YsopKiosk;

/// <summary>以 UAC 提升設定入站防火牆：僅放行 YSCP 來源 IP + 管理員 IP。</summary>
internal static class FirewallHelper
{
    internal const string RuleName = "YSOP Kiosk";

    internal static (bool ok, string message) ApplyInboundAllow(
        int localPort,
        string yscpSourceIp,
        string adminIpsMultiline)
    {
        if (localPort < 1 || localPort > 65535)
            return (false, "服務埠無效");

        var remotes = new List<string>();
        var src = yscpSourceIp.Trim();
        if (!string.IsNullOrEmpty(src)) remotes.Add(src);

        foreach (var part in adminIpsMultiline.Split(new[] { ',', ';', '\r', '\n', ' ' },
                     StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!remotes.Contains(part, StringComparer.OrdinalIgnoreCase))
                remotes.Add(part);
        }

        if (remotes.Count == 0)
            return (false, "請至少確保 HOST 為有效 IPv4（作為 YSCP 來源）");

        var remoteCsv = string.Join(",", remotes);
        var script = new StringBuilder();
        script.AppendLine("$ErrorActionPreference='Stop'");
        script.AppendLine($"$name='{RuleName.Replace("'", "''")}'");
        script.AppendLine("Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule");
        script.AppendLine(
            $"New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort {localPort} -RemoteAddress '{remoteCsv.Replace("'", "''")}' | Out-Null");
        script.AppendLine("Write-Output 'OK'");

        var temp = Path.Combine(Path.GetTempPath(), $"ysop-fw-{Guid.NewGuid():N}.ps1");
        File.WriteAllText(temp, script.ToString(), Encoding.UTF8);

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                UseShellExecute = true,
                Verb = "runas",
                WindowStyle = ProcessWindowStyle.Hidden,
                ArgumentList =
                {
                    "-NoProfile",
                    "-ExecutionPolicy", "Bypass",
                    "-File", temp,
                },
            };

            using var proc = Process.Start(psi);
            if (proc is null) return (false, "無法啟動提升權限程序");
            proc.WaitForExit(60_000);
            if (proc.ExitCode != 0)
                return (false, "防火牆規則寫入失敗或使用者取消 UAC");
            return (true, $"已限制入站 TCP {localPort} ← {remoteCsv}");
        }
        catch (Exception ex)
        {
            // 使用者取消 UAC 常為 Win32Exception
            return (false, $"防火牆未更新：{ex.Message}");
        }
        finally
        {
            try { File.Delete(temp); } catch { /* ignore */ }
        }
    }
}

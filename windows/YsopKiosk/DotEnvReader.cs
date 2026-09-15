using System.IO;
using System.Text.RegularExpressions;

namespace YsopKiosk;

/// <summary>從 app\.env 讀簡單 KEY=VALUE（不處理引號內多行）。</summary>
internal static class DotEnvReader
{
    private static readonly Regex LineRe = new(
        @"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$",
        RegexOptions.Compiled);

    internal static string EnvPath(string installRoot) =>
        Path.Combine(installRoot, "app", ".env");

    internal static Dictionary<string, string> Read(string installRoot)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var path = EnvPath(installRoot);
        if (!File.Exists(path)) return map;
        foreach (var raw in File.ReadAllLines(path))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;
            var m = LineRe.Match(line);
            if (!m.Success) continue;
            var key = m.Groups[1].Value;
            var value = m.Groups[2].Value.Trim();
            if (value.Length >= 2 &&
                ((value.StartsWith('"') && value.EndsWith('"')) ||
                 (value.StartsWith('\'') && value.EndsWith('\''))))
            {
                value = value[1..^1];
            }
            map[key] = value;
        }
        return map;
    }

    internal static string Get(string installRoot, string key, string fallback = "")
    {
        var map = Read(installRoot);
        return map.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v.Trim() : fallback;
    }

    internal static int GetListenPort(string installRoot, int fallback = 3010)
    {
        var raw = Get(installRoot, "PORT", fallback.ToString());
        if (!int.TryParse(raw, out var port) || port < 1 || port > 65535) return fallback;
        return port;
    }
}

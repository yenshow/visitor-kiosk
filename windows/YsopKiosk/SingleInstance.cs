using System.Threading;

namespace YsopKiosk;

/// <summary>單一例：第二次啟動改喚醒主窗，不另開行程。</summary>
internal static class SingleInstance
{
    private const string MutexName = @"Local\YsopKiosk";
    private const string ShowEventName = @"Local\YsopKiosk.ShowMain";

    internal static bool TryBecomePrimary(out Mutex mutex)
    {
        mutex = new Mutex(true, MutexName, out var created);
        if (created) return true;
        mutex.Dispose();
        mutex = null!;
        return false;
    }

    internal static void SignalShowMain()
    {
        try
        {
            using var ev = EventWaitHandle.OpenExisting(ShowEventName);
            ev.Set();
        }
        catch (WaitHandleCannotBeOpenedException)
        {
            /* 尚無主行程 */
        }
    }

    internal static EventWaitHandle CreateShowEvent() =>
        new(false, EventResetMode.AutoReset, ShowEventName);
}

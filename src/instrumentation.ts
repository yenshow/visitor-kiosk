/** 伺服器啟動時向 HCP 訂閱車牌事件 131622（失敗不擋啟動） */
export const register = async () => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureEventSubscription } = await import("@/lib/hcp/event-api");

  try {
    const result = await ensureEventSubscription();
    if (result.skipped) {
      console.info(`[instrumentation] 略過 HCP 事件訂閱（${result.reason}）`);
      return;
    }
    console.info(
      `[instrumentation] 已訂閱 HCP 車牌事件 131622 → ${result.eventDest}`,
    );
  } catch (error) {
    console.error(
      "[instrumentation] HCP 事件訂閱失敗（不擋服務啟動）",
      error instanceof Error ? error.message : error,
    );
  }
};

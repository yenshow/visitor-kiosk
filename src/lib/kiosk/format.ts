type ClockDisplayParts = {
  date: string;
  weekday: string;
  period: string;
  time: string;
};

/** 儀表板標頭時鐘（12 小時制，含星期與上午／下午） */
export const formatClockDisplay = (date: Date): ClockDisplayParts => {
  const padZero = (n: number): string => String(n).padStart(2, "0");
  const weekdays = [
    "星期日",
    "星期一",
    "星期二",
    "星期三",
    "星期四",
    "星期五",
    "星期六",
  ];
  const hours = date.getHours();
  const period = hours < 12 ? "上午" : "下午";
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;

  return {
    date: `${date.getFullYear()}/${padZero(date.getMonth() + 1)}/${padZero(date.getDate())}`,
    weekday: weekdays[date.getDay()] ?? "",
    period,
    time: `${padZero(displayHours)}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`,
  };
};

/** ISO 時段顯示（台北語系） */
export const formatDateTimeRange = (
  startIso: string,
  endIso: string,
): string => {
  if (!startIso && !endIso) return "—";

  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  const formatOne = (iso: string): string => {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString("zh-TW", opts);
  };

  return `${formatOne(startIso)} ～ ${formatOne(endIso)}`;
};

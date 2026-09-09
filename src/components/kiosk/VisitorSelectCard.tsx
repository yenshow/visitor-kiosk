import { formatDateTimeRange } from "@/lib/kiosk/format";
import type { OnSiteRecordView } from "@/lib/kiosk/visitor-query";

type VisitorSelectCardProps = {
  item: OnSiteRecordView;
  checked: boolean;
  onToggle: () => void;
};

export const VisitorSelectCard = ({
  item,
  checked,
  onToggle,
}: VisitorSelectCardProps) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={`選擇訪客 ${item.visitorName}`}
    className={`min-h-20 w-full rounded-xl border px-4 py-4 text-left transition active:scale-[0.99] ${
      checked
        ? "border-amber-500 bg-amber-50"
        : "border-slate-200 bg-slate-50"
    }`}
    onClick={onToggle}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-xl font-semibold text-slate-900">
          {item.visitorName}
        </div>
        <div className="mt-1 text-base text-slate-600">
          電話：{item.phoneNo || "—"}
        </div>
        {item.plateNo ? (
          <div className="mt-1 text-base text-slate-600">
            車牌：{item.plateNo}
          </div>
        ) : null}
        {item.receptionistName ? (
          <div className="mt-1 text-base text-slate-600">
            被訪人：{item.receptionistName}
          </div>
        ) : null}
        <div className="mt-1 text-sm text-slate-500">
          {item.visitStartTime || item.visitEndTime
            ? formatDateTimeRange(item.visitStartTime, item.visitEndTime)
            : item.visitingTime || "—"}
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
          item.presence === "temp_out"
            ? "bg-orange-100 text-orange-800"
            : "bg-emerald-100 text-emerald-800"
        }`}
      >
        {item.presence === "temp_out" ? "臨時外出" : "在場中"}
      </span>
    </div>
  </button>
);

type VisitorSelectListProps = {
  items: OnSiteRecordView[];
  selectedTokens: string[];
  onToggle: (token: string) => void;
};

export const VisitorSelectList = ({
  items,
  selectedTokens,
  onToggle,
}: VisitorSelectListProps) => (
  <ul className="space-y-3" role="list">
    {items.map((item) => (
      <li key={item.token}>
        <VisitorSelectCard
          item={item}
          checked={selectedTokens.includes(item.token)}
          onToggle={() => onToggle(item.token)}
        />
      </li>
    ))}
  </ul>
);

import type { ReactNode } from "react";

type FlowCardProps = {
  title: string;
  onBack: () => void;
  children: ReactNode;
};

export const FlowCard = ({ title, onBack, children }: FlowCardProps) => {
  const handleBack = () => {
    onBack();
  };

  return (
    <div className="flex w-full flex-col items-center">
      <div className="w-full rounded-3xl bg-white p-8 shadow-xl">
        <h2 className="mb-6 text-center text-3xl font-bold text-slate-900">
          {title}
        </h2>
        {children}
      </div>
      <button
        type="button"
        className="mt-6 cursor-pointer text-xl font-semibold tracking-wide text-white/85 underline-offset-8 outline-none hover:text-white hover:underline focus-visible:text-white focus-visible:underline landscape:text-2xl"
        aria-label="返回首頁"
        onClick={handleBack}
      >
        返回
      </button>
    </div>
  );
};

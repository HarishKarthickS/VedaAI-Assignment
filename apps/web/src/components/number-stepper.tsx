import React from "react";
import { Minus, Plus } from "lucide-react";

export function NumberStepper({
  label,
  value,
  onChange,
  minimum = 1,
  hideLabel = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  minimum?: number;
  hideLabel?: boolean;
}) {
  return (
    <div className="rounded-full bg-[#f1f1f1] px-3 py-2">
      {!hideLabel && <p className="mb-2 text-center text-xs">{label}</p>}
      <div className="flex items-center justify-between gap-4">
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(minimum, value - 1))}>
          <Minus size={15} className="text-[#a6a6a6]" />
        </button>
        <span className="min-w-4 text-center text-sm font-semibold">{value}</span>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(value + 1)}>
          <Plus size={15} className="text-[#a6a6a6]" />
        </button>
      </div>
    </div>
  );
}

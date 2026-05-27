"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@veda/ui";

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  triggerClassName,
  "aria-label": ariaLabel,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className={cn("relative w-full", isOpen ? "z-50" : "z-10", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-full border border-[#dedede] bg-white px-4 text-sm text-[#262626] outline-none transition-all hover:border-[#888] focus-visible:border-[#888] focus-visible:ring-2 focus-visible:ring-[#f77755]/20",
          isOpen && "border-[#888] ring-2 ring-[#f77755]/20",
          triggerClassName
        )}
        onClick={(e) => {
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown
          size={18}
          className={cn("ml-2 shrink-0 text-[#888] transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full rounded-[16px] border border-[#dedede] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="max-h-60 overflow-y-auto p-1.5">
            {options.map((opt) => (
              <div
                key={opt}
                className={cn(
                  "cursor-pointer rounded-[10px] px-3 py-2 text-sm transition-colors hover:bg-[#f7f7f7]",
                  value === opt && "bg-[#fff0eb] text-[#f77755] font-medium"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(opt);
                  setIsOpen(false);
                }}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Download, LoaderCircle, Sparkles } from "lucide-react";
import { Badge, Button } from "@veda/ui";

type GenerationBannerProps = {
  message: string;
  progress: number;
  complete: boolean;
  failed?: boolean;
  userName?: string;
  subject?: string;
  grade?: string;
  onDownload?: () => void;
};

export function GenerationBanner({ message, progress, complete, failed = false, userName, subject, grade, onDownload }: GenerationBannerProps) {
  const personalizedMessage = complete && userName
    ? `Certainly, ${userName}! Here are customized Question Paper for your ${subject ? `${subject} ` : ""}${grade ? `${grade} ` : ""}classes on the NCERT chapters:`
    : null;

  const title = personalizedMessage || (complete
    ? "Your customized question paper is ready."
    : failed
      ? message
      : message);

  const subtitle = complete
    ? "Review, refine, and export a professional paper."
    : failed
      ? "Generation stopped before a valid paper could be produced. You can try again once you're ready."
      : "We validate every section before displaying it.";

  const safeProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="paper-toolbar rounded-[16px] bg-[#242424] p-5 text-white shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold md:text-lg">
            {complete ? (
              <CheckCircle2 size={18} className="text-[#9be39f]" />
            ) : failed ? (
              <AlertCircle size={18} className="text-[#f77755]" />
            ) : (
              <LoaderCircle size={18} className="animate-spin" />
            )}
            {title}
          </p>
          {!personalizedMessage && (
            <p className="mt-2 text-xs text-[#cfcfcf] md:text-sm">{subtitle}</p>
          )}
        </div>
        {!complete && (
          <Badge className="shrink-0 bg-white/10 text-white">
            {failed ? "Failed" : `${safeProgress}%`}
          </Badge>
        )}
      </div>
      {complete && onDownload && (
        <Button
          variant="primary"
          size="md"
          className="mt-4 bg-[#333] hover:bg-[#444]"
          onClick={onDownload}
        >
          <Download size={16} /> Download as PDF
        </Button>
      )}
      {!complete && !failed && (
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/15">
          <motion.div className="h-full rounded-full bg-[#f77755]" animate={{ width: `${safeProgress}%` }} />
        </div>
      )}
      {complete && !personalizedMessage && (
        <p className="mt-4 flex items-center gap-2 text-xs text-[#dcdcdc]">
          <Sparkles size={14} /> Validated sections, answer keys, and export tools are available.
        </p>
      )}
    </div>
  );
}

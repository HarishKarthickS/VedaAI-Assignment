import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@veda/ui";

function EmptyIllustration() {
  return (
    <svg width="300" height="240" viewBox="0 0 300 240" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Decorative curved line (quill stroke) — top left */}
      <path
        d="M82 48c10-16 28-26 46-24s16 14 7 21-23 5-24-7 12-26 32-28"
        stroke="#2d2d2d"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Document / Paper — center-left */}
      <rect x="90" y="46" width="108" height="138" rx="8" fill="white" stroke="#e2e2e2" strokeWidth="1" />
      {/* Paper content lines */}
      <rect x="108" y="78" width="68" height="5" rx="2.5" fill="#ddd" />
      <rect x="108" y="92" width="52" height="5" rx="2.5" fill="#ddd" />
      <rect x="108" y="106" width="62" height="5" rx="2.5" fill="#ddd" />
      <rect x="108" y="120" width="44" height="5" rx="2.5" fill="#ddd" />
      <rect x="108" y="134" width="56" height="5" rx="2.5" fill="#ddd" />
      <rect x="108" y="148" width="36" height="5" rx="2.5" fill="#ddd" />
      <rect x="108" y="162" width="50" height="5" rx="2.5" fill="#ddd" />

      {/* Dark pill — on the document header area */}
      <rect x="108" y="62" width="42" height="8" rx="4" fill="#555" />

      {/* Small UI cards — top right of document */}
      <rect x="180" y="36" width="50" height="18" rx="5" fill="white" stroke="#ddd" strokeWidth="1" />
      <rect x="188" y="42" width="16" height="5" rx="2.5" fill="#ccc" />
      <rect x="180" y="58" width="34" height="18" rx="5" fill="white" stroke="#ddd" strokeWidth="1" />
      <rect x="188" y="64" width="12" height="5" rx="2.5" fill="#ccc" />

      {/* Magnifying glass — large, overlapping bottom right */}
      {/* Outer ring */}
      <circle cx="198" cy="156" r="50" fill="#f0ecf5" />
      <circle cx="198" cy="156" r="50" fill="none" stroke="#d4c8e6" strokeWidth="3" />
      {/* Inner circle */}
      <circle cx="198" cy="156" r="38" fill="#e8e0f0" />
      <circle cx="198" cy="156" r="38" fill="none" stroke="#cfc2de" strokeWidth="1.5" />

      {/* Magnifying glass handle */}
      <line x1="232" y1="190" x2="256" y2="214" stroke="#c4b8d4" strokeWidth="8" strokeLinecap="round" />
      <line x1="232" y1="190" x2="256" y2="214" stroke="#d4c8e2" strokeWidth="5" strokeLinecap="round" />

      {/* Red X in magnifying glass */}
      <g>
        <line x1="184" y1="142" x2="212" y2="170" stroke="#e84040" strokeWidth="6" strokeLinecap="round" />
        <line x1="212" y1="142" x2="184" y2="170" stroke="#e84040" strokeWidth="6" strokeLinecap="round" />
      </g>

      {/* Sparkle — bottom left */}
      <path
        d="M60 178l3.5-9 3.5 9 9 3.5-9 3.5-3.5 9-3.5-9-9-3.5z"
        fill="#4a9ec5"
      />

      {/* Small dot — right side */}
      <circle cx="258" cy="164" r="3.5" fill="#5aafe0" />
    </svg>
  );
}

export function EmptyAssignments() {
  return (
    <div className="flex min-h-[calc(100vh-142px)] flex-col items-center justify-center text-center md:min-h-[calc(100vh-120px)]">
      <div className="mb-8">
        <EmptyIllustration />
      </div>
      <h1 className="text-xl font-bold md:text-2xl">No assignments yet</h1>
      <p className="mt-3 max-w-[520px] text-sm leading-6 text-[#7c7c7c] md:text-base">
        Create your first assignment to start collecting and grading student submissions.
        You can set up rubrics, define marking criteria, and let AI assist with grading.
      </p>
      <Button asChild className="mt-8">
        <Link href="/assignments/new"><Plus size={17} /> Create Your First Assignment</Link>
      </Button>
    </div>
  );
}

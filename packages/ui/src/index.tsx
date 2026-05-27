import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fb6237] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[#171717] text-white hover:bg-[#292929]",
        secondary: "border border-[#dedede] bg-white text-[#252525] hover:bg-[#f7f7f7]",
        ghost: "text-[#525252] hover:bg-[#eeeeee]",
        accent: "bg-[#282828] text-white border-[3px] border-[#EF6542] shadow-[0_0_15px_rgba(239,101,66,0.3)] hover:bg-[#1f1f1f]",
        danger: "bg-[#fff0eb] text-[#d83920] hover:bg-[#ffe4dc]",
      },
      size: {
        md: "h-11 px-5",
        sm: "h-9 px-4 text-xs",
        icon: "size-10 p-0",
        lg: "h-14 px-8 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-full border border-[#dedede] bg-white px-4 text-sm text-[#262626] outline-none placeholder:text-[#a4a4a4] focus:border-[#888] focus:ring-2 focus:ring-[#f77755]/20",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-none rounded-2xl border border-dashed border-[#dadada] bg-[#fafafa] p-4 text-sm outline-none placeholder:text-[#a2a2a2] focus:border-[#777]",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-2 block text-sm font-semibold text-[#2c2c2c]", className)} {...props} />;
}

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "easy" | "moderate" | "hard" | "orange" }) {
  const tones = {
    default: "bg-[#f2f2f2] text-[#4b4b4b]",
    easy: "bg-[#eaf8ee] text-[#287849]",
    moderate: "bg-[#fff4e5] text-[#9a5a00]",
    hard: "bg-[#ffebe6] text-[#ad341f]",
    orange: "bg-[#fff0eb] text-[#df4c28]",
  };
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[8px] bg-white", className)} {...props} />;
}

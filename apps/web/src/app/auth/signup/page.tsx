"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema } from "@veda/contracts";
import { Button, Input, Label } from "@veda/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthFrame } from "@/components/auth-frame";
import { apiRequest } from "@/lib/api";

type SignupValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const { register, handleSubmit, formState } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
  });

  const submit = handleSubmit(async (values) => {
    try {
      await apiRequest("/auth/signup", { method: "POST", body: JSON.stringify(values) });
      router.replace("/assignments");
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Account could not be created.");
    }
  });

  return (
    <AuthFrame title="Create your school workspace" subtitle="Start generating thoughtful assessments in minutes.">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {[
          ["name", "Your name", "text"],
          ["email", "Work email", "email"],
          ["schoolName", "School name", "text"],
          ["city", "City", "text"],
        ].map(([name, label, type]) => (
          <div key={name}>
            <Label htmlFor={name}>{label}</Label>
            <Input id={name} type={type} {...register(name as keyof SignupValues)} />
            {formState.errors[name as keyof SignupValues] && (
              <p className="mt-1 text-xs text-red-600">{formState.errors[name as keyof SignupValues]?.message}</p>
            )}
          </div>
        ))}
        <div className="sm:col-span-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          {formState.errors.password && <p className="mt-1 text-xs text-red-600">{formState.errors.password.message}</p>}
        </div>
        {error && <p className="sm:col-span-2 rounded-[8px] bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button size="lg" className="sm:col-span-2" disabled={formState.isSubmitting}>Create workspace</Button>
      </form>
      <p className="mt-7 text-center text-sm text-[#777]">
        Already have an account? <Link href="/auth/login" className="font-semibold text-[#e45431]">Sign in</Link>
      </p>
    </AuthFrame>
  );
}

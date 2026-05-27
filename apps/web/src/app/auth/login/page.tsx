"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@veda/contracts";
import { Button, Input, Label } from "@veda/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthFrame } from "@/components/auth-frame";
import { apiRequest } from "@/lib/api";

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const { register, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      await apiRequest("/auth/login", { method: "POST", body: JSON.stringify(values) });
      const nextPage = new URLSearchParams(window.location.search).get("next") || "/assignments";
      router.replace(nextPage);
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not sign in.");
    }
  });

  return (
    <AuthFrame title="Welcome back" subtitle="Sign in to create your next assessment.">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {formState.errors.email && <p className="mt-1 text-xs text-red-600">{formState.errors.email.message}</p>}
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
          {formState.errors.password && <p className="mt-1 text-xs text-red-600">{formState.errors.password.message}</p>}
        </div>
        {error && <p role="alert" className="mt-1 rounded-[8px] bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button className="w-full" size="lg" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-[#777]">
        New school workspace? <Link href="/auth/signup" className="font-semibold text-[#e45431]">Create account</Link>
      </p>
    </AuthFrame>
  );
}

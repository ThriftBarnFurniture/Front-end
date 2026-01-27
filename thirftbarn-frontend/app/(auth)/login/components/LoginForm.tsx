"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import SignInWithGoogleButton from "./SignInWithGoogleButton";

interface LoginFormProps {
  initialError?: string;
}

export function LoginForm({ initialError }: LoginFormProps) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
      return;
    }

    // Client-side sign-in triggers onAuthStateChange in the navbar
    // This updates the navbar immediately before we navigate
    router.push("/");
    router.refresh(); // Refresh server components to sync with new auth state
  };

  return (
    <Card
      className={[
        "mx-auto w-full max-w-xl",
        "rounded-[22px]",
        "border",
        "bg-[var(--color-surface)] text-[var(--color-text)]",
        "border-[var(--color-border)]",
        "shadow-[var(--shadow-md)]",
      ].join(" ")}
    >
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-black tracking-wide">
          Welcome back
        </CardTitle>
        <CardDescription className="text-[var(--color-muted)]">
          Sign in to your account
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div
            className="mb-4 rounded-xl border px-4 py-3 text-sm font-bold"
            style={{ borderColor: "#b00020", color: "#b00020" }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label className="font-extrabold" htmlFor="email">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                disabled={isLoading}
                className={[
                  "h-12",
                  "rounded-xl",
                  "bg-[var(--color-surface-2)]",
                  "border-[var(--color-border)]",
                  "text-[var(--color-text)]",
                  "placeholder:text-[var(--color-muted)]",
                  "focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-brand)_30%,transparent)]",
                  "focus-visible:ring-offset-0",
                  "focus-visible:border-[var(--color-brand)]",
                ].join(" ")}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center">
                <Label className="font-extrabold" htmlFor="password">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="ml-auto inline-block text-sm font-bold underline text-[var(--color-brand)]"
                >
                  Forgot your password?
                </Link>
              </div>

              <Input
                id="password"
                name="password"
                type="password"
                required
                disabled={isLoading}
                className={[
                  "h-12",
                  "rounded-xl",
                  "bg-[var(--color-surface-2)]",
                  "border-[var(--color-border)]",
                  "text-[var(--color-text)]",
                  "placeholder:text-[var(--color-muted)]",
                  "focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-brand)_30%,transparent)]",
                  "focus-visible:ring-offset-0",
                  "focus-visible:border-[var(--color-brand)]",
                ].join(" ")}
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className={[
                "w-full h-12 rounded-full font-extrabold",
                "bg-[var(--color-brand)] text-white",
                "shadow-[var(--shadow-sm)]",
                "hover:shadow-[var(--shadow-md)] hover:-translate-y-[1px]",
                "transition",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>

            <SignInWithGoogleButton />
          </div>
        </form>

        <div className="mt-5 text-center text-sm text-[var(--color-muted)]">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-extrabold text-[var(--color-brand)] underline">
            Sign up
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
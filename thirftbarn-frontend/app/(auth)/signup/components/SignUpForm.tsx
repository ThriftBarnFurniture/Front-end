"use client";

/*
Signup form UI: collects user info and submits to signup server action.
Uses React.useActionState (Next.js 16.1+) for server action feedback.
*/

import Link from "next/link";
import React, { useMemo, useState, useActionState } from "react";

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
import { signup } from "@/lib/auth-actions";

type SignUpState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<"first-name" | "last-name" | "email" | "password", string>>;
};

const initialState: SignUpState = { ok: false };

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const passwordMeetsRules = (pw: string) => {
  const v = pw ?? "";
  return /[A-Z]/.test(v) && /[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v);
};

const validateField = (name: string, value: string) => {
  if (name === "first-name") return value.trim() ? "" : "First name is required.";
  if (name === "last-name") return value.trim() ? "" : "Last name is required.";
  if (name === "email") {
    if (!value.trim()) return "Email is required.";
    return isValidEmail(value) ? "" : "Please enter a valid email address.";
  }
  if (name === "password") {
    if (!value) return "Password is required.";
    return passwordMeetsRules(value)
      ? ""
      : "Password must include a capital letter, a number, and a special character.";
  }
  return "";
};


export function SignUpForm() {
  const [clientErrors, setClientErrors] = useState<SignUpState["fieldErrors"]>({});

  // Next 16.1+: useActionState instead of useFormState
  const [state, formAction, isPending] = useActionState(signup as any, initialState);

  const mergedErrors = useMemo(() => {
    // Prefer client validation errors, otherwise show server validation errors
    return Object.keys(clientErrors ?? {}).length ? clientErrors : state?.fieldErrors;
  }, [clientErrors, state?.fieldErrors]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);

    const first = String(fd.get("first-name") ?? "").trim();
    const last = String(fd.get("last-name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    const errs: NonNullable<SignUpState["fieldErrors"]> = {};

    if (!first) errs["first-name"] = "First name is required.";
    if (!last) errs["last-name"] = "Last name is required.";

    if (!email) errs.email = "Email is required.";
    else if (!isValidEmail(email)) errs.email = "Please enter a valid email address.";

    if (!password) errs.password = "Password is required.";
    else if (!passwordMeetsRules(password)) {
      errs.password =
        "Password must include a capital letter, a number, and a special character.";
    }

    setClientErrors(errs);

    if (Object.keys(errs).length > 0) {
      e.preventDefault(); // block server action
    }
  };

  const inputBase = [
    "h-12 rounded-xl",
    "bg-[var(--color-surface-2)]",
    "border-[var(--color-border)]",
    "text-[var(--color-text)]",
    "placeholder:text-[var(--color-muted)]",
    "focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-brand)_30%,transparent)]",
    "focus-visible:ring-offset-0",
    "focus-visible:border-[var(--color-brand)]",
  ].join(" ");

  const errorRing = "border-red-500 focus-visible:ring-red-300";

  const ErrorText = ({ children }: { children?: string }) =>
    children ? <p className="text-sm font-semibold text-red-600">{children}</p> : null;

  const onFieldChange = (name: "first-name" | "last-name" | "email" | "password") =>
  (e: React.ChangeEvent<HTMLInputElement>) => {
    const msg = validateField(name, e.target.value);

    setClientErrors((prev) => {
      const next = { ...(prev ?? {}) };
      if (msg) next[name] = msg;
      else delete next[name]; // ✅ disappears when fixed
      return next;
    });
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
          Create account
        </CardTitle>
        <CardDescription className="text-[var(--color-muted)]">
          Join Thrift Barn Furniture
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Banner */}
        {state?.ok ? (
          <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
            <p className="font-extrabold">Success</p>
            <p className="text-sm font-semibold">
              Your account has been successfully created! Please check your inbox to verify your account and sign in!
            </p>
          </div>
        ) : state?.message ? (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-900">
            <p className="font-extrabold">Couldn&apos;t create account</p>
            <p className="text-sm font-semibold">{state.message}</p>
          </div>
        ) : null}

        <form action={formAction} onSubmit={onSubmit} noValidate>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="font-extrabold" htmlFor="first-name">
                  First name
                </Label>
                <Input
                  name="first-name"
                  id="first-name"
                  placeholder="Max"
                  required
                  onChange={onFieldChange("first-name")}
                  aria-invalid={!!mergedErrors?.["first-name"]}
                  className={[
                    inputBase,
                    mergedErrors?.["first-name"] ? errorRing : "",
                  ].join(" ")}
                />
                <ErrorText>{mergedErrors?.["first-name"]}</ErrorText>
              </div>

              <div className="grid gap-2">
                <Label className="font-extrabold" htmlFor="last-name">
                  Last name
                </Label>
                <Input
                  name="last-name"
                  id="last-name"
                  placeholder="Robinson"
                  required
                  onChange={onFieldChange("last-name")}
                  aria-invalid={!!mergedErrors?.["last-name"]}
                  className={[
                    inputBase,
                    mergedErrors?.["last-name"] ? errorRing : "",
                  ].join(" ")}
                />
                <ErrorText>{mergedErrors?.["last-name"]}</ErrorText>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="font-extrabold" htmlFor="email">
                Email
              </Label>
              <Input
                name="email"
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                onChange={onFieldChange("email")}
                aria-invalid={!!mergedErrors?.email}
                className={[inputBase, mergedErrors?.email ? errorRing : ""].join(" ")}
              />
              <ErrorText>{mergedErrors?.email}</ErrorText>
            </div>

            <div className="grid gap-2">
              <Label className="font-extrabold" htmlFor="password">
                Password
              </Label>
              <Input
                name="password"
                id="password"
                type="password"
                required
                onChange={onFieldChange("password")}
                aria-invalid={!!mergedErrors?.password}
                className={[
                  inputBase,
                  mergedErrors?.password ? errorRing : "",
                ].join(" ")}
              />
              <ErrorText>{mergedErrors?.password}</ErrorText>
              <p className="text-xs font-semibold text-[var(--color-muted)]">
                Must include a capital letter, a number, and a special character.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className={[
                "w-full h-12 rounded-full font-extrabold",
                "bg-[var(--color-brand)] text-white",
                "shadow-[var(--shadow-sm)]",
                "hover:shadow-[var(--shadow-md)] hover:-translate-y-[1px]",
                "transition",
                isPending ? "opacity-70 cursor-not-allowed" : "",
              ].join(" ")}
            >
              {isPending ? "Creating..." : "Create an account"}
            </Button>
          </div>
        </form>

        <div className="mt-5 text-center text-sm text-[var(--color-muted)]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-extrabold text-[var(--color-brand)] underline"
          >
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

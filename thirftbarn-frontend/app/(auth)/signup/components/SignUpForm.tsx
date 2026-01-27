"use client";

/*
Signup form UI: collects user info and submits to signup server action.
Uses React.useActionState (Next.js 16.1+) for server action feedback.
*/

import Link from "next/link";
import React, { useEffect, useMemo, useState, useActionState } from "react";

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

import styles from "./SignUpForm.module.css";

type FieldName = "first-name" | "last-name" | "email" | "password" | "verify-password";

type SignUpState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<FieldName, string>>;
};

const initialState: SignUpState = { ok: false };

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const passwordMeetsRules = (pw: string) => {
  const v = pw ?? "";
  return /[A-Z]/.test(v) && /[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v);
};

export function SignUpForm() {
  const [values, setValues] = useState<Record<FieldName, string>>({
    "first-name": "",
    "last-name": "",
    email: "",
    password: "",
    "verify-password": "",
  });

  const [clientErrors, setClientErrors] = useState<SignUpState["fieldErrors"]>({});

  const [dismissedServerErrors, setDismissedServerErrors] = useState<
    Partial<Record<FieldName, boolean>>
  >({});

  const [state, formAction, isPending] = useActionState(signup as any, initialState);

  const serverErrorsFiltered = useMemo(() => {
    const se = state?.fieldErrors ?? {};
    const filtered: Partial<Record<FieldName, string>> = { ...se };

    (Object.keys(dismissedServerErrors) as FieldName[]).forEach((k) => {
      if (dismissedServerErrors[k]) delete filtered[k];
    });

    return filtered;
  }, [state?.fieldErrors, dismissedServerErrors]);

  const mergedErrors = useMemo(() => {
    return Object.keys(clientErrors ?? {}).length ? clientErrors : serverErrorsFiltered;
  }, [clientErrors, serverErrorsFiltered]);

  useEffect(() => {
    if (!state?.ok) return;

    setValues({
      "first-name": "",
      "last-name": "",
      email: "",
      password: "",
      "verify-password": "",
    });
    setClientErrors({});
    setDismissedServerErrors({});
  }, [state?.ok]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const first = values["first-name"].trim();
    const last = values["last-name"].trim();
    const email = values.email.trim();
    const password = values.password;
    const verifyPassword = values["verify-password"];

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

    if (!verifyPassword) errs["verify-password"] = "Please confirm your password.";
    else if (verifyPassword !== password) {
      errs["verify-password"] = "Passwords do not match.";
    }

    setClientErrors(errs);

    if (Object.keys(errs).length > 0) {
      e.preventDefault();
      return;
    }

    setDismissedServerErrors({});
  };

  const onFieldChange =
    (name: FieldName) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;

      setValues((prev) => ({ ...prev, [name]: v }));

      // clear client error for this field (no re-validate)
      setClientErrors((prev) => {
        if (!prev?.[name]) return prev;
        const next = { ...(prev ?? {}) };
        delete next[name];
        return next;
      });

      // dismiss server error for this field as soon as user edits it
      setDismissedServerErrors((prev) => ({ ...(prev ?? {}), [name]: true }));
    };

  const inputClass = (hasError: boolean) =>
    [styles.input, hasError ? styles.inputError : ""].filter(Boolean).join(" ");

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <CardTitle className={styles.title}>Create account</CardTitle>
        <CardDescription className={styles.description}>
          Join Thrift Barn Furniture
        </CardDescription>
      </CardHeader>

      <CardContent>
        {state?.ok ? (
          <div className={styles.bannerSuccess}>
            <p className={styles.bannerTitle}>Success</p>
            <p className={styles.bannerText}>
              Your account has been successfully created! Please check your inbox or junk 
              to <strong>verify your account</strong> and sign in!
            </p>
          </div>
        ) : state?.message ? (
          <div className={styles.bannerError}>
            <p className={styles.bannerTitle}>Couldn't create account</p>
            <p className={styles.bannerText}>{state.message}</p>
          </div>
        ) : null}

        <form action={formAction} onSubmit={onSubmit} noValidate>
          <div className={styles.formGrid}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <Label className={styles.label} htmlFor="first-name">
                  First name
                </Label>
                <Input
                  name="first-name"
                  id="first-name"
                  placeholder="Max"
                  required
                  value={values["first-name"]}
                  onChange={onFieldChange("first-name")}
                  aria-invalid={!!mergedErrors?.["first-name"]}
                  className={inputClass(!!mergedErrors?.["first-name"])}
                />
                {mergedErrors?.["first-name"] ? (
                  <p className={styles.errorText}>{mergedErrors["first-name"]}</p>
                ) : null}
              </div>

              <div className={styles.field}>
                <Label className={styles.label} htmlFor="last-name">
                  Last name
                </Label>
                <Input
                  name="last-name"
                  id="last-name"
                  placeholder="Robinson"
                  required
                  value={values["last-name"]}
                  onChange={onFieldChange("last-name")}
                  aria-invalid={!!mergedErrors?.["last-name"]}
                  className={inputClass(!!mergedErrors?.["last-name"])}
                />
                {mergedErrors?.["last-name"] ? (
                  <p className={styles.errorText}>{mergedErrors["last-name"]}</p>
                ) : null}
              </div>
            </div>

            <div className={styles.field}>
              <Label className={styles.label} htmlFor="email">
                Email
              </Label>
              <Input
                name="email"
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={values.email}
                onChange={onFieldChange("email")}
                aria-invalid={!!mergedErrors?.email}
                className={inputClass(!!mergedErrors?.email)}
              />
              {mergedErrors?.email ? (
                <p className={styles.errorText}>{mergedErrors.email}</p>
              ) : null}
            </div>

            <div className={styles.field}>
              <Label className={styles.label} htmlFor="password">
                Password
              </Label>
              <Input
                name="password"
                id="password"
                type="password"
                required
                value={values.password}
                onChange={onFieldChange("password")}
                aria-invalid={!!mergedErrors?.password}
                className={inputClass(!!mergedErrors?.password)}
              />
              {mergedErrors?.password ? (
                <p className={styles.errorText}>{mergedErrors.password}</p>
              ) : null}

              <p className={styles.hint}>
                Must include a capital letter, a number, and a special character.
              </p>
            </div>

            <div className={styles.field}>
              <Label className={styles.label} htmlFor="verify-password">
                Verify password
              </Label>
              <Input
                name="verify-password"
                id="verify-password"
                type="password"
                required
                value={values["verify-password"]}
                onChange={onFieldChange("verify-password")}
                aria-invalid={!!mergedErrors?.["verify-password"]}
                className={inputClass(!!mergedErrors?.["verify-password"])}
              />
              {mergedErrors?.["verify-password"] ? (
                <p className={styles.errorText}>{mergedErrors["verify-password"]}</p>
              ) : null}
            </div>

            <Button type="submit" disabled={isPending} className={styles.submit}>
              {isPending ? "Creating..." : "Create an account"}
            </Button>
          </div>
        </form>

        <div className={styles.footer}>
          Already have an account?{" "}
          <Link href="/login" className={styles.link}>
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

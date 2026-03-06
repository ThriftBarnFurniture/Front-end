"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/auth-actions";

import styles from "./ForgotPasswordForm.module.css";

type State = {
  ok: boolean;
  message?: string;
  fieldErrors?: { email?: string };
};

const initialState: State = { ok: false };

export default function ForgotPasswordForm() {
  const [values, setValues] = useState({ email: "" });
  const [clientErrors, setClientErrors] = useState<State["fieldErrors"]>({});
  const [dismissedServerErrors, setDismissedServerErrors] = useState<{ email?: boolean }>({});

  const [state, formAction, isPending] = useActionState(
    requestPasswordReset as any,
    initialState
  );

  const serverErrorsFiltered = useMemo(() => {
    const se = state?.fieldErrors ?? {};
    if (dismissedServerErrors.email) return {};
    return se;
  }, [state?.fieldErrors, dismissedServerErrors]);

  const mergedErrors = useMemo(() => {
    return Object.keys(clientErrors ?? {}).length ? clientErrors : serverErrorsFiltered;
  }, [clientErrors, serverErrorsFiltered]);

  useEffect(() => {
    if (state?.ok) {
      setValues({ email: "" });
      setClientErrors({});
      setDismissedServerErrors({});
    }
  }, [state?.ok]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const email = values.email.trim();
    const errs: NonNullable<State["fieldErrors"]> = {};

    if (!email) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Please enter a valid email address.";
    }

    setClientErrors(errs);

    if (Object.keys(errs).length > 0) {
      e.preventDefault();
      return;
    }

    setDismissedServerErrors({});
  };

  const onEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValues({ email: v });

    // Clear (not validate) on typing
    setClientErrors((prev) => {
      if (!prev?.email) return prev;
      const next = { ...(prev ?? {}) };
      delete next.email;
      return next;
    });

    // Dismiss server "email doesn't exist / already exists" style errors on retype
    setDismissedServerErrors({ email: true });
  };

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <CardTitle className={styles.title}>Reset your password</CardTitle>
        <CardDescription className={styles.description}>
          We’ll email you a link to create a new password.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {state?.ok ? (
          <div className={styles.bannerSuccess}>
            <p className={styles.bannerTitle}>Check your email</p>
            <p className={styles.bannerText}>{state.message}</p>
          </div>
        ) : state?.message ? (
          <div className={styles.bannerError}>
            <p className={styles.bannerTitle}>Couldn&apos;t send email</p>
            <p className={styles.bannerText}>{state.message}</p>
          </div>
        ) : null}

        <form className={styles.form} action={formAction} onSubmit={onSubmit} noValidate>
          <div className={styles.grid}>
            <div className={styles.field}>
              <Label className={styles.label} htmlFor="email">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                disabled={isPending}
                value={values.email}
                onChange={onEmailChange}
                aria-invalid={!!mergedErrors?.email}
                className={[
                  styles.input,
                  mergedErrors?.email ? styles.inputError : "",
                ].join(" ")}
              />
              {mergedErrors?.email ? (
                <p className={styles.errorText}>{mergedErrors.email}</p>
              ) : null}
            </div>

            <Button type="submit" disabled={isPending} className={styles.button}>
              {isPending ? "Sending..." : "Send reset link"}
            </Button>
          </div>
        </form>

        <div className={styles.footer}>
          <Link href="/login" className={styles.link}>
            Back to sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
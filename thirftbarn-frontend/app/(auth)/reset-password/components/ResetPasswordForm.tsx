"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/lib/auth-actions";

import styles from "./ResetPasswordForm.module.css";

type State = {
  ok: boolean;
  message?: string;
  fieldErrors?: { password?: string };
};

const initialState: State = { ok: false };

const passwordMeetsRules = (pw: string) => {
  const v = pw ?? "";
  return /[A-Z]/.test(v) && /[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v);
};

export default function ResetPasswordForm() {
  const [values, setValues] = useState({ password: "" });
  const [clientErrors, setClientErrors] = useState<State["fieldErrors"]>({});
  const [dismissedServerErrors, setDismissedServerErrors] = useState<{ password?: boolean }>({});

  const [state, formAction, isPending] = useActionState(updatePassword as any, initialState);

  const serverErrorsFiltered = useMemo(() => {
    const se = state?.fieldErrors ?? {};
    if (dismissedServerErrors.password) return {};
    return se;
  }, [state?.fieldErrors, dismissedServerErrors]);

  const mergedErrors = useMemo(() => {
    return Object.keys(clientErrors ?? {}).length ? clientErrors : serverErrorsFiltered;
  }, [clientErrors, serverErrorsFiltered]);

  useEffect(() => {
    if (state?.ok) {
      setValues({ password: "" });
      setClientErrors({});
      setDismissedServerErrors({});
    }
  }, [state?.ok]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const password = values.password;
    const errs: NonNullable<State["fieldErrors"]> = {};

    if (!password) errs.password = "Password is required.";
    else if (!passwordMeetsRules(password)) {
      errs.password =
        "Password must include a capital letter, a number, and a special character.";
    }

    setClientErrors(errs);

    if (Object.keys(errs).length > 0) {
      e.preventDefault();
      return;
    }

    setDismissedServerErrors({});
  };

  const onPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValues({ password: v });

    // Clear (not validate) on typing
    setClientErrors((prev) => {
      if (!prev?.password) return prev;
      const next = { ...(prev ?? {}) };
      delete next.password;
      return next;
    });

    setDismissedServerErrors({ password: true });
  };

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <CardTitle className={styles.title}>Choose a new password</CardTitle>
        <CardDescription className={styles.description}>
          Enter a new password for your account.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {state?.ok ? (
          <div className={styles.bannerSuccess}>
            <p className={styles.bannerTitle}>Success</p>
            <p className={styles.bannerText}>{state.message}</p>
          </div>
        ) : state?.message ? (
          <div className={styles.bannerError}>
            <p className={styles.bannerTitle}>Couldn&apos;t update password</p>
            <p className={styles.bannerText}>{state.message}</p>
          </div>
        ) : null}

        <form action={formAction} onSubmit={onSubmit} noValidate>
          <div className={styles.grid}>
            <div className={styles.field}>
              <Label className={styles.label} htmlFor="password">
                New password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                disabled={isPending}
                value={values.password}
                onChange={onPasswordChange}
                aria-invalid={!!mergedErrors?.password}
                className={[
                  styles.input,
                  mergedErrors?.password ? styles.inputError : "",
                ].join(" ")}
              />

              {mergedErrors?.password ? (
                <p className={styles.errorText}>{mergedErrors.password}</p>
              ) : null}

              <p className={styles.hint}>
                Must include a capital letter, a number, and a special character.
              </p>
            </div>

            <Button type="submit" disabled={isPending} className={styles.button}>
              {isPending ? "Updating..." : "Update password"}
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

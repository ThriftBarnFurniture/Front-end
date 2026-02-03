/*
Server actions for authentication.

signup(prevState, formData): calls Supabase signUp + sets metadata (name) and returns status (no redirect)
signInWithGoogle(): starts Google OAuth flow and redirects to provider URL
*/

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type SignUpState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<"first-name" | "last-name" | "email" | "password", string>>;
};

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const passwordMeetsRules = (pw: string) => {
  const v = pw ?? "";
  return /[A-Z]/.test(v) && /[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v);
};

export async function signup(_prevState: SignUpState, formData: FormData): Promise<SignUpState> {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("first-name") ?? "").trim();
  const lastName = String(formData.get("last-name") ?? "").trim();

  // server-side validation
  const fieldErrors: SignUpState["fieldErrors"] = {};
  if (!firstName) fieldErrors["first-name"] = "First name is required.";
  if (!lastName) fieldErrors["last-name"] = "Last name is required.";

  if (!email) fieldErrors.email = "Email is required.";
  else if (!isValidEmail(email)) fieldErrors.email = "Please enter a valid email address.";

  if (!password) fieldErrors.password = "Password is required.";
  else if (!passwordMeetsRules(password)) {
    fieldErrors.password =
      "Password must include a capital letter, a number, and a special character.";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
      },
    },
  });

  // If Supabase *does* return an error
  if (error) {
    const raw = (error.message || "").toLowerCase();
    if (raw.includes("already") || raw.includes("registered") || raw.includes("exists")) {
      return {
        ok: false,
        fieldErrors: {
          email: "An account with this email already exists.",
        },
      };
    }
    return { ok: false, message: error.message || "Unable to create account." };
  }

  /**
   * IMPORTANT:
   * Supabase/GoTrue can return "success" even when the email already exists,
   * with user.identities being empty. This avoids leaking whether an email is registered.
   */
  const identities = data?.user?.identities ?? [];
  if (identities.length === 0) {
    return {
      ok: false,
      fieldErrors: {
        email: "An account with this email already exists.",
      },
    };
  }

  return {
    ok: true,
    message:
      "Your account has been successfully created! Please check your inbox to verify your account and sign in!",
  };
}


export async function signInWithGoogle() {
  const supabase = await createClient();

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://front-end-cdca.vercel.app/";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${base}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(data.url);
}

export async function requestPasswordReset(
  _prevState: { ok: boolean; message?: string; fieldErrors?: { email?: string } },
  formData: FormData
) {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();

  const fieldErrors: { email?: string } = {};
  if (!email) fieldErrors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "Please enter a valid email address.";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://front-end-cdca.vercel.app/";

  // Supabase will email a reset link. We tell it where to send the user after they click it.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/reset-password`,
  });

  // Important: don’t leak whether an email exists
  if (error) {
    return { ok: false, message: "Unable to send reset email. Please try again." };
  }

  return {
    ok: true,
    message:
      "If an account exists for that email, you’ll receive a password reset link shortly.",
  };
}

export async function updatePassword(
  _prevState: { ok: boolean; message?: string; fieldErrors?: { password?: string } },
  formData: FormData
) {
  const supabase = await createClient();

  const password = String(formData.get("password") ?? "");

  const fieldErrors: { password?: string } = {};
  if (!password) fieldErrors.password = "Password is required.";
  else {
    const meets =
      /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
    if (!meets) {
      fieldErrors.password =
        "Password must include a capital letter, a number, and a special character.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  // In the reset flow, Supabase sets a temporary session when the user opens the link.
  // This call updates the password for the currently authenticated user/session.
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      ok: false,
      message: error.message || "Unable to update password. Please try again.",
    };
  }

  return {
    ok: true,
    message: "Password updated! You can now sign in with your new password.",
  };
}

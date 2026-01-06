/*
Client button that triggers “Sign in with Google” (OAuth flow). Uses client-side behavior (click handlers, redirects).
*/

"use client";

import { signInWithGoogle } from "@/lib/auth-actions";

const SignInWithGoogleButton = () => {
  return (
    <button
      type="button"
      onClick={() => signInWithGoogle()}
      className={[
        "w-full h-12",
        "flex items-center justify-center gap-3",
        "rounded-xl",
        "bg-white",
        "border border-[#dadce0]",
        "text-[#3c4043]",
        "font-semibold text-sm",
        "shadow-sm",
        "hover:bg-[#f7f8f8]",
        "transition",
      ].join(" ")}
    >
      <img
        src="/google-logo.svg"
        alt=""
        aria-hidden="true"
        className="h-5 w-5"
      />
      <span>Sign in with Google</span>
    </button>
  );
};

export default SignInWithGoogleButton;

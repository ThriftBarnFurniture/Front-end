import React from "react";
import { LoginForm } from "./components/LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  return (
    <main
      style={{
        paddingTop: "calc(var(--header-offset, 120px) + var(--space-8))",
        paddingBottom: "var(--space-10)",
        background: "var(--color-bg)",
      }}
      className="min-h-svh flex flex-col items-center justify-start px-5"
    >
      {searchParams?.error ? (
        <div
          className="mb-4 w-full max-w-xl rounded-xl border px-4 py-3 text-sm font-bold"
          style={{
            borderColor: "#c1121f",
            color: "#c1121f",
            background: "color-mix(in srgb, #c1121f 10%, transparent)",
          }}
        >
          {searchParams.error}
        </div>
      ) : null}

      <LoginForm />
    </main>
  );
}

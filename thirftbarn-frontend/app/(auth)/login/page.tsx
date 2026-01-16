import React from "react";
import { LoginForm } from "./components/LoginForm";
import styles from "./login.module.css";

type LoginPageProps = {
  searchParams?: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = (await searchParams) ?? {};
  const error = sp.error;
  const message = sp.message;

  return (
    <main className={styles.page}>
      {message ? (
        <div className="mb-4 w-full max-w-xl rounded-xl border px-4 py-3 text-sm font-bold">
          {decodeURIComponent(message)}
        </div>
      ) : null}

      <LoginForm initialError={error ? decodeURIComponent(error) : undefined} />
    </main>
  );
}
/*
Signup form UI: collects user info (email/password + name fields) and submits to the signup server action.
*/

import Link from "next/link";

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

export function SignUpForm() {
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
        <form action="">
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
                  className={[
                    "h-12 rounded-xl",
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
                <Label className="font-extrabold" htmlFor="last-name">
                  Last name
                </Label>
                <Input
                  name="last-name"
                  id="last-name"
                  placeholder="Robinson"
                  required
                  className={[
                    "h-12 rounded-xl",
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
                className={[
                  "h-12 rounded-xl",
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
              <Label className="font-extrabold" htmlFor="password">
                Password
              </Label>
              <Input
                name="password"
                id="password"
                type="password"
                className={[
                  "h-12 rounded-xl",
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
              formAction={signup}
              type="submit"
              className={[
                "w-full h-12 rounded-full font-extrabold",
                "bg-[var(--color-brand)] text-white",
                "shadow-[var(--shadow-sm)]",
                "hover:shadow-[var(--shadow-md)] hover:-translate-y-[1px]",
                "transition",
              ].join(" ")}
            >
              Create an account
            </Button>
          </div>
        </form>

        <div className="mt-5 text-center text-sm text-[var(--color-muted)]">
          Already have an account?{" "}
          <Link href="/login" className="font-extrabold text-[var(--color-brand)] underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

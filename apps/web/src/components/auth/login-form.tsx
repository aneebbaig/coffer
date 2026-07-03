"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [totp, setTotp] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormValues) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsTotp ? { ...data, totp } : data),
      });

      const body = await res.json().catch(() => ({}));

      if (res.ok && body.totpRequired) {
        // Password was right; server wants the 2FA code. Reveal the field.
        setNeedsTotp(true);
        return;
      }

      if (!res.ok) {
        toast.error(needsTotp ? "Invalid authentication code" : "Invalid email or password");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label
          htmlFor="email"
          className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground"
        >
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="password"
          className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground"
        >
          Password
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
        )}
      </div>

      {needsTotp && (
        <div className="space-y-1.5">
          <Label
            htmlFor="totp"
            className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground"
          >
            Authentication code
          </Label>
          <Input
            id="totp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456 or backup code"
            autoFocus
            value={totp}
            onChange={(e) => setTotp(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
      )}

      <Button type="submit" className="w-full mt-2" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : needsTotp ? (
          "Verify & sign in"
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}

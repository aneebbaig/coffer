"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getTotpStatus,
  startTotpEnroll,
  confirmTotpEnroll,
  disableTotp,
} from "@/actions/totp";

type Stage = "loading" | "off" | "enrolling" | "backup" | "on";

export function TotpSettings() {
  const [stage, setStage] = useState<Stage>("loading");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getTotpStatus()
      .then((s) => setStage(s.enabled ? "on" : "off"))
      .catch(() => setStage("off"));
  }, []);

  function begin() {
    startTransition(async () => {
      const res = await startTotpEnroll(password);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setPassword("");
      setQr(res.qrDataUrl);
      setSecret(res.secret);
      setCode("");
      setStage("enrolling");
    });
  }

  function confirm() {
    startTransition(async () => {
      const res = await confirmTotpEnroll(code.trim());
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setBackupCodes(res.backupCodes);
      setStage("backup");
      toast.success("Two-factor authentication enabled");
    });
  }

  function disable() {
    startTransition(async () => {
      const res = await disableTotp(password);
      if (!res.success) {
        toast.error(res.error ?? "Failed to disable");
        return;
      }
      setPassword("");
      setStage("off");
      toast.success("Two-factor authentication disabled");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Require a time-based code from an authenticator app at sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stage === "loading" && <p className="text-sm text-muted-foreground">Loading…</p>}

        {stage === "off" && (
          <div className="space-y-3">
            <div className="max-w-[280px]">
              <Label>Confirm password to enable</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && password && begin()}
              />
            </div>
            <Button onClick={begin} disabled={pending || !password}>
              {pending ? "Starting…" : "Enable 2FA"}
            </Button>
          </div>
        )}

        {stage === "enrolling" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this with Google Authenticator, Aegis, or 1Password, then enter the code.
            </p>
            {qr && (
              <Image src={qr} alt="TOTP QR code" width={192} height={192} className="rounded border" unoptimized />
            )}
            <p className="text-xs text-muted-foreground break-all">
              Can’t scan? Enter this key manually: <code className="font-mono">{secret}</code>
            </p>
            <div className="max-w-[200px]">
              <Label>Code from app</Label>
              <Input
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={confirm} disabled={pending || code.trim().length < 6}>
                {pending ? "Verifying…" : "Verify & enable"}
              </Button>
              <Button variant="outline" onClick={() => setStage("off")} disabled={pending}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {stage === "backup" && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Save your backup codes</p>
            <p className="text-xs text-muted-foreground">
              Each code works once if you lose your authenticator. Store them somewhere safe — they
              won’t be shown again.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded border p-3 font-mono text-sm">
              {backupCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <Button onClick={() => setStage("on")}>I’ve saved them</Button>
          </div>
        )}

        {stage === "on" && (
          <div className="space-y-3">
            <p className="text-sm text-green-600 dark:text-green-500">2FA is enabled.</p>
            <div className="max-w-[280px]">
              <Label>Confirm password to disable</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button variant="destructive" onClick={disable} disabled={pending || !password}>
              {pending ? "Disabling…" : "Disable 2FA"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

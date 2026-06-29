import { Metadata } from "next";
import { getServerUser } from "@/lib/session";
import { getUserSettings, getCategories, getRecurringTransactions } from "@/actions/settings";
import { getUsers } from "@/actions/users";
import { SettingsClient } from "@/components/settings/settings-client";

export const metadata: Metadata = { title: "Settings — Coffer" };

export default async function SettingsPage() {
  const session = await getServerUser();
  const isSuperAdmin = session?.role === "SUPER_ADMIN";

  const [settings, categories, recurringTransactions, users] = await Promise.all([
    getUserSettings(),
    getCategories(),
    getRecurringTransactions(),
    isSuperAdmin ? getUsers() : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your preferences</p>
      </div>
      <SettingsClient
        settings={settings}
        categories={categories}
        recurringTransactions={recurringTransactions}
        users={users}
        role={session?.role ?? "ADMIN"}
        emailConfigured={!!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)}
      />
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { updateUserSettings, changePassword, createCategory, deleteCategory, exportUserData } from "@/actions/settings";
import { adminCreateUser, adminDeleteUser, adminUpdateUserRole, updateNotificationPreferences } from "@/actions/users";
import { Plus, Trash2, Download, RefreshCw, CheckCircle, XCircle, ShieldCheck, Shield, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface UserSettings {
  name: string;
  email: string;
  currency: string;
  dateFormat: string;
  firstDayOfWeek: number;
  emergencyFundMonths: number;
  notifyBudgetWarning: boolean;
  notifyDoomSpending: boolean;
  notifyLoanDue: boolean;
  notifyDailyDigest: boolean;
  notifyDigestTasks: boolean;
  notifyDigestCalendar: boolean;
  notifyDigestBudget: boolean;
  notifyDigestFinancials: boolean;
}
interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: string;
  isDefault: boolean;
}
interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  recurringFrequency: string | null;
  date: Date;
  category: { name: string; color: string };
}
interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

const DATE_FORMATS = [
  { value: "dd/MM/yyyy", label: "DD/MM/YYYY (31/01/2025)" },
  { value: "MM/dd/yyyy", label: "MM/DD/YYYY (01/31/2025)" },
  { value: "yyyy-MM-dd", label: "YYYY-MM-DD (2025-01-31)" },
  { value: "dd MMM yyyy", label: "DD MMM YYYY (31 Jan 2025)" },
];

const WEEK_STARTS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 6, label: "Saturday" },
];

export function SettingsClient({
  settings,
  categories,
  recurringTransactions,
  users,
  role,
  emailConfigured,
}: {
  settings: UserSettings | null;
  categories: Category[];
  recurringTransactions: RecurringTransaction[];
  users: AppUser[];
  role: string;
  emailConfigured: boolean;
}) {
  const isSuperAdmin = role === "SUPER_ADMIN";
  const [isPending, startTransition] = useTransition();

  // Profile state
  const [profile, setProfile] = useState({
    name: settings?.name ?? "",
    currency: settings?.currency ?? "PKR",
    dateFormat: settings?.dateFormat ?? "dd/MM/yyyy",
    firstDayOfWeek: settings?.firstDayOfWeek ?? 1,
    emergencyFundMonths: settings?.emergencyFundMonths ?? 6,
  });

  // Password state
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });

  // Categories state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState({ name: "", icon: "Tag", color: "#6366f1", type: "EXPENSE" });
  const [addingCat, setAddingCat] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState({
    notifyBudgetWarning: settings?.notifyBudgetWarning ?? true,
    notifyDoomSpending: settings?.notifyDoomSpending ?? true,
    notifyLoanDue: settings?.notifyLoanDue ?? true,
    notifyDailyDigest: settings?.notifyDailyDigest ?? true,
    notifyDigestTasks: settings?.notifyDigestTasks ?? true,
    notifyDigestCalendar: settings?.notifyDigestCalendar ?? true,
    notifyDigestBudget: settings?.notifyDigestBudget ?? true,
    notifyDigestFinancials: settings?.notifyDigestFinancials ?? true,
  });
  const [savingNotif, setSavingNotif] = useState(false);

  // Users state
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "ADMIN" });
  const [creatingUser, setCreatingUser] = useState(false);

  function handleSaveProfile() {
    startTransition(async () => {
      const result = await updateUserSettings(profile);
      if (result.success) toast.success("Profile updated!");
      else toast.error(result.error ?? "Failed to save");
    });
  }

  function handleChangePassword() {
    if (passwords.new !== passwords.confirm) { toast.error("Passwords don't match"); return; }
    if (passwords.new.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    startTransition(async () => {
      const result = await changePassword({ currentPassword: passwords.current, newPassword: passwords.new });
      if (result.success) {
        toast.success("Password changed!");
        setPasswords({ current: "", new: "", confirm: "" });
      } else {
        toast.error(result.error ?? "Failed");
      }
    });
  }

  async function handleAddCategory() {
    if (!newCat.name) return;
    setAddingCat(true);
    const result = await createCategory(newCat);
    if (result.success) {
      toast.success("Category added!");
      setNewCat({ name: "", icon: "Tag", color: "#6366f1", type: "EXPENSE" });
    } else {
      toast.error(result.error ?? "Failed");
    }
    setAddingCat(false);
  }

  async function handleDeleteCategory(id: string) {
    const result = await deleteCategory(id);
    if (result.success) toast.success("Category deleted");
    else toast.error("Cannot delete default category");
    setDeleteId(null);
  }

  async function handleExport() {
    startTransition(async () => {
      const result = await exportUserData();
      if (!result.success) { toast.error(result.error); return; }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `coffer-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported!");
    });
  }

  async function handleSaveNotifications() {
    setSavingNotif(true);
    const result = await updateNotificationPreferences(notifications);
    if (result.success) toast.success("Notification preferences saved!");
    else toast.error(result.error ?? "Failed");
    setSavingNotif(false);
  }

  async function handleCreateUser() {
    if (!newUser.name || !newUser.email || !newUser.password) return;
    setCreatingUser(true);
    const result = await adminCreateUser(newUser);
    if (result.success) {
      toast.success(`${newUser.name} added!`);
      setNewUser({ name: "", email: "", password: "", role: "ADMIN" });
    } else {
      toast.error(result.error ?? "Failed");
    }
    setCreatingUser(false);
  }

  async function handleDeleteUser() {
    if (!deleteUserId) return;
    const result = await adminDeleteUser(deleteUserId);
    if (result.success) toast.success("User deleted");
    else toast.error(result.error ?? "Failed");
    setDeleteUserId(null);
  }

  async function handleToggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === "SUPER_ADMIN" ? "ADMIN" : "SUPER_ADMIN";
    const result = await adminUpdateUserRole(userId, newRole);
    if (result.success) toast.success("Role updated");
    else toast.error(result.error ?? "Failed");
  }

  const customCategories = categories.filter((c) => !c.isDefault);
  const defaultCategories = categories.filter((c) => c.isDefault);
  void defaultCategories; // kept for possible future use

  const tabs = ["profile", "security", "categories", "notifications", "data", ...(isSuperAdmin ? ["users"] : [])];

  return (
    <Tabs defaultValue="profile">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="data">Data</TabsTrigger>
        {isSuperAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
      </TabsList>

      {/* Profile Tab */}
      <TabsContent value="profile" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Profile & Preferences</CardTitle>
            <CardDescription>Update your name, currency, and display preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} placeholder="Your name" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={settings?.email ?? ""} disabled className="opacity-60" />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
            </div>
            <div>
              <Label>Currency</Label>
              <Select onValueChange={(v) => setProfile((p) => ({ ...p, currency: v }))} defaultValue={profile.currency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PKR">PKR - Pakistani Rupee (Rs )</SelectItem>
                  <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                  <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date Format</Label>
              <Select onValueChange={(v) => setProfile((p) => ({ ...p, dateFormat: v }))} defaultValue={profile.dateFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Week Starts On</Label>
              <Select onValueChange={(v) => setProfile((p) => ({ ...p, firstDayOfWeek: Number(v) }))} defaultValue={String(profile.firstDayOfWeek)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEK_STARTS.map((w) => <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Emergency Fund Target (months)</Label>
              <Select onValueChange={(v) => setProfile((p) => ({ ...p, emergencyFundMonths: Number(v) }))} defaultValue={String(profile.emergencyFundMonths)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 4, 5, 6, 7, 8, 9, 10, 12].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} months</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Target months of expenses to save in your emergency fund. 6 months is the standard recommendation.
              </p>
            </div>
            <Button onClick={handleSaveProfile} disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Security Tab */}
      <TabsContent value="security" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Current Password</Label>
              <Input type="password" value={passwords.current} onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))} />
            </div>
            <div>
              <Label>New Password</Label>
              <Input type="password" value={passwords.new} onChange={(e) => setPasswords((p) => ({ ...p, new: e.target.value }))} />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))} />
            </div>
            <Button onClick={handleChangePassword} disabled={isPending}>
              {isPending ? "Changing..." : "Change Password"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Categories Tab */}
      <TabsContent value="categories" className="mt-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Add Category</CardTitle>
            <CardDescription>Create expense or income categories specific to your needs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 items-end">
              <div className="col-span-2 sm:col-span-1">
                <Label>Name</Label>
                <Input value={newCat.name} onChange={(e) => setNewCat((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Fuel" onKeyDown={(e) => e.key === "Enter" && handleAddCategory()} />
              </div>
              <div>
                <Label>Type</Label>
                <Select onValueChange={(v) => setNewCat((p) => ({ ...p, type: v }))} defaultValue="EXPENSE">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                    <SelectItem value="INCOME">Income</SelectItem>
                    <SelectItem value="BOTH">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Color</Label>
                <input type="color" value={newCat.color} onChange={(e) => setNewCat((p) => ({ ...p, color: e.target.value }))} className="h-9 w-full cursor-pointer rounded border border-input block" />
              </div>
              <Button className="w-full" onClick={handleAddCategory} disabled={addingCat}>
                <Plus className="h-4 w-4" />{addingCat ? "Adding..." : "Add"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {[
          { type: "EXPENSE", label: "Expense" },
          { type: "INCOME", label: "Income" },
          { type: "BOTH", label: "Both (Expense & Income)" },
        ].map(({ type, label }) => {
          const typeCats = categories.filter((c) => c.type === type);
          if (!typeCats.length) return null;
          return (
            <Card key={type}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                  <Badge variant="outline" className="text-xs font-normal">{typeCats.length}</Badge>
                </div>
                <CardDescription className="text-xs">
                  {type === "EXPENSE" ? "Used when logging expenses" : type === "INCOME" ? "Used when logging income" : "Available for both expense and income"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {typeCats.map((cat) => (
                    <div
                      key={cat.id}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border text-sm transition-colors",
                        cat.isDefault
                          ? "pl-2.5 pr-2.5 py-1 bg-muted/40 border-border/60 text-muted-foreground"
                          : "pl-2.5 pr-1 py-1 bg-card hover:border-muted-foreground/40"
                      )}
                    >
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="leading-none">{cat.name}</span>
                      {!cat.isDefault && (
                        <button
                          onClick={() => setDeleteId(cat.id)}
                          className="text-muted-foreground hover:text-red-500 transition-colors p-0.5 rounded-full ml-0.5"
                          title="Delete category"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>

      {/* Notifications Tab */}
      <TabsContent value="notifications" className="mt-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Email Configuration</CardTitle>
            <CardDescription>Gmail SMTP status for sending alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {emailConfigured ? (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Email configured</p>
                    <p className="text-xs text-muted-foreground">Alerts will be sent via Gmail SMTP</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Email not configured</p>
                    <p className="text-xs text-muted-foreground">
                      Add <code className="bg-muted px-1 rounded">GMAIL_USER</code> and <code className="bg-muted px-1 rounded">GMAIL_APP_PASSWORD</code> to <code className="bg-muted px-1 rounded">.env.local</code> to enable alerts.
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Real-time Alerts</CardTitle>
            <CardDescription>Immediate emails triggered when you add an expense</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Budget warnings</p>
                <p className="text-xs text-muted-foreground">Email when a category hits 85% or exceeds 100% of budget</p>
              </div>
              <Switch
                checked={notifications.notifyBudgetWarning}
                onCheckedChange={(v) => setNotifications((p) => ({ ...p, notifyBudgetWarning: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Doom spending</p>
                <p className="text-xs text-muted-foreground">Email when you add 3+ expenses within 2 hours</p>
              </div>
              <Switch
                checked={notifications.notifyDoomSpending}
                onCheckedChange={(v) => setNotifications((p) => ({ ...p, notifyDoomSpending: v }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Daily Digest Email</CardTitle>
                <CardDescription>Morning summary sent at 7 AM - choose what to include</CardDescription>
              </div>
              <Switch
                checked={notifications.notifyDailyDigest}
                onCheckedChange={(v) => setNotifications((p) => ({ ...p, notifyDailyDigest: v }))}
              />
            </div>
          </CardHeader>
          <CardContent className={cn("space-y-5", !notifications.notifyDailyDigest && "opacity-50 pointer-events-none")}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Tasks</p>
                <p className="text-xs text-muted-foreground">Overdue tasks and tasks due today</p>
              </div>
              <Switch
                checked={notifications.notifyDigestTasks}
                onCheckedChange={(v) => setNotifications((p) => ({ ...p, notifyDigestTasks: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Calendar</p>
                <p className="text-xs text-muted-foreground">Today&apos;s and tomorrow&apos;s events</p>
              </div>
              <Switch
                checked={notifications.notifyDigestCalendar}
                onCheckedChange={(v) => setNotifications((p) => ({ ...p, notifyDigestCalendar: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Loan reminders</p>
                <p className="text-xs text-muted-foreground">Loans due within the next 7 days</p>
              </div>
              <Switch
                checked={notifications.notifyLoanDue}
                onCheckedChange={(v) => setNotifications((p) => ({ ...p, notifyLoanDue: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Budget alerts</p>
                <p className="text-xs text-muted-foreground">Categories at or over 80% of monthly budget</p>
              </div>
              <Switch
                checked={notifications.notifyDigestBudget}
                onCheckedChange={(v) => setNotifications((p) => ({ ...p, notifyDigestBudget: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Financial health</p>
                <p className="text-xs text-muted-foreground">Emergency fund status, missing income, end-of-month summary</p>
              </div>
              <Switch
                checked={notifications.notifyDigestFinancials}
                onCheckedChange={(v) => setNotifications((p) => ({ ...p, notifyDigestFinancials: v }))}
              />
            </div>
            <Button onClick={handleSaveNotifications} disabled={savingNotif}>
              {savingNotif ? "Saving..." : "Save Preferences"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Data Tab */}
      <TabsContent value="data" className="mt-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Export Data</CardTitle>
            <CardDescription>Download all your data as a JSON backup file</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} disabled={isPending} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              {isPending ? "Exporting..." : "Download Backup (JSON)"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Includes all transactions, budgets, goals, planners, savings, loans, and tasks.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Recurring Transactions
            </CardTitle>
            <CardDescription>Transactions marked as recurring - add them manually each month</CardDescription>
          </CardHeader>
          <CardContent>
            {recurringTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recurring transactions set up yet.</p>
            ) : (
              <div className="space-y-2">
                {recurringTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tx.category.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{tx.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {tx.category.name} · Last added {format(new Date(tx.date), "dd MMM yyyy")}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {tx.recurringFrequency?.toLowerCase() ?? "recurring"}
                    </Badge>
                    <span className={`text-sm font-semibold shrink-0 ${tx.type === "INCOME" ? "text-emerald-600" : "text-red-600"}`}>
                      {tx.type === "INCOME" ? "+" : "-"}Rs {(tx.amount / 100).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Users Tab - SUPER_ADMIN only */}
      {isSuperAdmin && (
        <TabsContent value="users" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>App Users</CardTitle>
              <CardDescription>Manage who has access to this app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {users.map((u) => (
                <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                      <span className="text-xs font-bold text-primary">{u.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{u.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <Badge
                      className={u.role === "SUPER_ADMIN"
                        ? "bg-primary/10 text-primary dark:bg-primary/15 text-xs shrink-0"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs shrink-0"
                      }
                    >
                      {u.role === "SUPER_ADMIN" ? (
                        <><ShieldCheck className="h-3 w-3 mr-1" />Super Admin</>
                      ) : (
                        <><Shield className="h-3 w-3 mr-1" />Admin</>
                      )}
                    </Badge>
                    <button
                      onClick={() => handleToggleRole(u.id, u.role)}
                      className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
                      title="Toggle role"
                    >
                      Change role
                    </button>
                    <button
                      onClick={() => setDeleteUserId(u.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors p-1 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add User</CardTitle>
              <CardDescription>Create a new account - they can log in immediately</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Sam" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} placeholder="email@gmail.com" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Password</Label>
                  <Input type="password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} placeholder="Min. 8 characters" />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select onValueChange={(v) => setNewUser((p) => ({ ...p, role: v }))} defaultValue="ADMIN">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin - no vault, no user mgmt</SelectItem>
                      <SelectItem value="SUPER_ADMIN">Super Admin - full access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreateUser} disabled={creatingUser}>
                <Plus className="h-4 w-4 mr-1" />
                {creatingUser ? "Creating..." : "Create User"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete category?"
        description="Transactions using this category will keep it as a reference."
        onConfirm={() => handleDeleteCategory(deleteId!)}
      />
      <ConfirmDialog
        open={!!deleteUserId}
        onOpenChange={(o) => !o && setDeleteUserId(null)}
        title="Delete user?"
        description="All their data (transactions, budgets, tasks, etc.) will be permanently deleted."
        onConfirm={handleDeleteUser}
      />
    </Tabs>
  );
}

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_CATEGORIES = [
  // Expense categories
  { name: "Food & Dining", icon: "Utensils", color: "#f97316", type: "EXPENSE" },
  { name: "Groceries", icon: "ShoppingCart", color: "#84cc16", type: "EXPENSE" },
  { name: "Transport & Fuel", icon: "Car", color: "#06b6d4", type: "EXPENSE" },
  { name: "Utilities", icon: "Zap", color: "#a855f7", type: "EXPENSE" },
  { name: "Rent & Housing", icon: "Home", color: "#3b82f6", type: "EXPENSE" },
  { name: "Healthcare", icon: "Heart", color: "#ef4444", type: "EXPENSE" },
  { name: "Shopping", icon: "ShoppingBag", color: "#ec4899", type: "EXPENSE" },
  { name: "Entertainment", icon: "Tv", color: "#8b5cf6", type: "EXPENSE" },
  { name: "Subscriptions", icon: "CreditCard", color: "#6366f1", type: "EXPENSE" },
  { name: "Personal Care", icon: "Sparkles", color: "#f43f5e", type: "EXPENSE" },
  { name: "Education", icon: "BookOpen", color: "#0ea5e9", type: "EXPENSE" },
  { name: "Gifts", icon: "Gift", color: "#d946ef", type: "EXPENSE" },
  { name: "Car Maintenance", icon: "Wrench", color: "#78716c", type: "EXPENSE" },
  { name: "Miscellaneous", icon: "MoreHorizontal", color: "#94a3b8", type: "EXPENSE" },
  // Income categories
  { name: "Salary", icon: "Briefcase", color: "#22c55e", type: "INCOME" },
  { name: "Freelance", icon: "Laptop", color: "#10b981", type: "INCOME" },
  { name: "Investment Returns", icon: "TrendingUp", color: "#14b8a6", type: "INCOME" },
  { name: "Gifts Received", icon: "Gift", color: "#34d399", type: "INCOME" },
  { name: "Side Hustle", icon: "Zap", color: "#6ee7b7", type: "INCOME" },
  { name: "Refunds", icon: "RefreshCw", color: "#a7f3d0", type: "INCOME" },
  { name: "Other Income", icon: "DollarSign", color: "#4ade80", type: "INCOME" },
];

// Passwords are NEVER hardcoded. If the env var is set we use it (min 8
// chars); otherwise we generate a strong random one and print it once, so a
// deploy can never end up with a public, guessable default credential.
const generatedCreds: string[] = [];

function resolvePassword(env: string | undefined, email: string): string {
  if (env && env.length > 0) {
    if (env.length < 8) throw new Error(`Password for ${email} must be at least 8 characters`);
    return env;
  }
  const pw = randomBytes(12).toString("base64url");
  generatedCreds.push(`  ${email}  ->  ${pw}`);
  return pw;
}

// Create the user if absent. If it already exists, only reconcile name/role -
// never overwrite the password, so a re-seed can't clobber a rotated one.
async function ensureUser(opts: {
  email: string;
  name: string;
  role: string;
  envPassword: string | undefined;
}): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: opts.email } });
  if (existing) {
    await prisma.user.update({ where: { email: opts.email }, data: { name: opts.name, role: opts.role } });
    console.log(`✓ ${opts.role}: ${opts.name} (${opts.email}) — already existed, password unchanged`);
    return;
  }
  const password = resolvePassword(opts.envPassword, opts.email);
  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email: opts.email, name: opts.name, hashedPassword, currency: "PKR", role: opts.role },
  });
  console.log(`✓ ${opts.role}: ${opts.name} (${opts.email}) — created`);
}

async function main() {
  const user1Email = process.env.USER1_EMAIL || "admin@example.com";
  const user1Name = process.env.USER1_NAME || "Admin";

  const user2Email = process.env.USER2_EMAIL || "member@example.com";
  const user2Name = process.env.USER2_NAME || "Member";

  console.log("Seeding default categories...");
  const categories = await Promise.all(
    DEFAULT_CATEGORIES.map((cat) =>
      prisma.category.upsert({
        where: { id: `default-${cat.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}` },
        update: {},
        create: {
          id: `default-${cat.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`,
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          type: cat.type,
          isDefault: true,
          userId: null,
        },
      })
    )
  );
  console.log(`✓ Created ${categories.length} default categories`);

  console.log("Seeding users...");
  await ensureUser({ email: user1Email, name: user1Name, role: "SUPER_ADMIN", envPassword: process.env.USER1_PASSWORD });
  await ensureUser({ email: user2Email, name: user2Name, role: "ADMIN", envPassword: process.env.USER2_PASSWORD });

  if (generatedCreds.length > 0) {
    console.log("\n" + "=".repeat(60));
    console.log("GENERATED PASSWORDS — save these now, they are not stored:");
    generatedCreds.forEach((c) => console.log(c));
    console.log("Set USER1_PASSWORD / USER2_PASSWORD to choose your own.");
    console.log("=".repeat(60) + "\n");
  }

  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

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

async function main() {
  const user1Email = process.env.USER1_EMAIL || "admin@example.com";
  const user1Password = process.env.USER1_PASSWORD || "changeme123";
  const user1Name = process.env.USER1_NAME || "Admin";

  const user2Email = process.env.USER2_EMAIL || "member@example.com";
  const user2Password = process.env.USER2_PASSWORD || "changeme456";
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
  const hash1 = await bcrypt.hash(user1Password, 10);
  const user1 = await prisma.user.upsert({
    where: { email: user1Email },
    update: { name: user1Name, hashedPassword: hash1, role: "SUPER_ADMIN" },
    create: {
      email: user1Email,
      name: user1Name,
      hashedPassword: hash1,
      currency: "PKR",
      role: "SUPER_ADMIN",
    },
  });
  console.log(`✓ User 1 (SUPER_ADMIN): ${user1.name} (${user1.email})`);

  const hash2 = await bcrypt.hash(user2Password, 10);
  const user2 = await prisma.user.upsert({
    where: { email: user2Email },
    update: { name: user2Name },
    create: {
      email: user2Email,
      name: user2Name,
      hashedPassword: hash2,
      currency: "PKR",
      role: "ADMIN",
    },
  });
  console.log(`✓ User 2: ${user2.name} (${user2.email})`);

  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAccessToken, ACCESS_COOKIE, TokenPayload } from "@/lib/tokens";
import { prisma } from "@/lib/prisma";

export async function getServerUser(): Promise<TokenPayload | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

export async function requireUser(): Promise<TokenPayload> {
  const user = await getServerUser();
  if (!user) redirect("/login");
  return user;
}

export async function getUserId(): Promise<string> {
  const user = await getServerUser();
  if (!user) throw new Error("Unauthorized");
  return user.id;
}

export async function getAuthenticatedUser<S extends Record<string, unknown>>(
  select: S
): Promise<{ id: string } & { [K in keyof S]: unknown }> {
  const authUser = await getServerUser();
  if (!authUser) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, ...select },
  });
  if (!user) throw new Error("Unauthorized");
  return user as { id: string } & { [K in keyof S]: unknown };
}

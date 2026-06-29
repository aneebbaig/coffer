import { SignJWT, jwtVerify } from "jose";

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSecret());
}

export async function signRefreshToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.type !== "access") return null;
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.type !== "refresh") return null;
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

export function cookieOptions(isSecure: boolean, maxAge: number) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

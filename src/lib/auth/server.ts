import { createNeonAuth } from "@neon/auth/next/server";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL || "https://auth-not-configured.invalid",
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET || "build-only-placeholder-secret-do-not-use", sessionDataTtl: 60 }
});

import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const authConfigured = Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET && process.env.NEON_AUTH_COOKIE_SECRET.length >= 32);
  let databaseConnected = false;
  if (process.env.DATABASE_URL) { try { await getPool().query("SELECT 1"); databaseConnected = true; } catch { databaseConnected = false; } }
  const ready = authConfigured && databaseConnected;
  return NextResponse.json({ app: "StorePilot", status: ready ? "ready" : "degraded", authConfigured, databaseConnected }, { status: ready ? 200 : 503 });
}

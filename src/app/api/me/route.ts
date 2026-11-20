import { NextResponse } from "next/server";
import { getOrganizationContext, getUser } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const context = await getOrganizationContext();
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
      organization: context?.organization_id ? {
        id: context.organization_id, name: context.organization_name, currency: context.currency,
        timezone: context.timezone, role: context.role, storeId: context.store_id, storeName: context.store_name
      } : null
    });
  } catch {
    return NextResponse.json({ error: "Unable to load your workspace. Check server configuration." }, { status: 503 });
  }
}

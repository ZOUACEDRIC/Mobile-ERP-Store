import { NextRequest, NextResponse } from "next/server";
import { getPool, getUser } from "@/lib/db";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getUser().catch(() => null);
  if (!user?.id) return NextResponse.json({ error: "Sign in to create a workspace." }, { status: 401 });
  let body: { businessName?: unknown; storeName?: unknown; currency?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
  const storeName = typeof body.storeName === "string" ? body.storeName.trim() : "";
  const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "XAF";
  if (businessName.length < 2 || businessName.length > 160 || storeName.length < 2 || storeName.length > 160 || !/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ error: "Enter a valid business name, store name and three-letter currency." }, { status: 400 });
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const existing = await client.query("SELECT organization_id FROM public.organization_members WHERE user_id=$1 AND status='active' LIMIT 1", [user.id]);
    if (existing.rowCount) return NextResponse.json({ error: "You already belong to a workspace." }, { status: 409 });
    await client.query("BEGIN");
    const slugBase = businessName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55) || "business";
    const slug = slugBase + "-" + crypto.randomUUID().slice(0,8);
    const org = await client.query("INSERT INTO public.organizations(name,slug,currency) VALUES($1,$2,$3) RETURNING id,name,currency,timezone", [businessName,slug,currency]);
    const organization = org.rows[0];
    await client.query("INSERT INTO public.organization_members(organization_id,user_id,role,status) VALUES($1,$2,'owner','active')", [organization.id,user.id]);
    const store = await client.query("INSERT INTO public.stores(organization_id,name,code) VALUES($1,$2,'MAIN') RETURNING id,name", [organization.id,storeName]);
    await client.query("COMMIT");
    return NextResponse.json({ organization, store: store.rows[0] }, { status: 201 });
  } catch {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "Workspace creation failed. Please retry." }, { status: 503 });
  } finally { client.release(); }
}

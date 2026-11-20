import { NextRequest, NextResponse } from "next/server";
import { getOrganizationContext, getPool, roleAllowed } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getOrganizationContext();
    if (!ctx?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!ctx.organization_id) return NextResponse.json({ products: [] });
    const result = await getPool().query(`SELECT p.id,p.sku,p.name,p.unit,p.purchase_price,p.selling_price,p.reorder_level,p.active,
      COALESCE(sum(s.quantity_on_hand),0)::numeric(14,3) AS quantity_on_hand
      FROM public.products p LEFT JOIN public.current_stock s ON s.product_id=p.id AND s.organization_id=p.organization_id
      WHERE p.organization_id=$1 GROUP BY p.id ORDER BY p.name LIMIT 500`,[ctx.organization_id]);
    return NextResponse.json({ products: result.rows });
  } catch { return NextResponse.json({ error: "Unable to load products." }, { status: 503 }); }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getOrganizationContext();
    if (!ctx?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!ctx.organization_id) return NextResponse.json({ error: "Create a workspace first." }, { status: 409 });
    if (!roleAllowed(ctx.role,["owner","admin","manager","stock_clerk"])) return NextResponse.json({ error: "You do not have permission to add products." }, { status: 403 });
    const body = await request.json();
    const name = typeof body.name==="string" ? body.name.trim() : "";
    const sku = typeof body.sku==="string" ? body.sku.trim() : null;
    const unit = typeof body.unit==="string" ? body.unit.trim() : "unit";
    const purchase = Number(body.purchasePrice ?? 0), selling = Number(body.sellingPrice ?? 0), reorder = Number(body.reorderLevel ?? 0);
    if (name.length<2 || name.length>200 || !Number.isFinite(purchase) || !Number.isFinite(selling) || !Number.isFinite(reorder) || purchase<0 || selling<0 || reorder<0) {
      return NextResponse.json({ error: "Enter a valid product name and non-negative prices and reorder quantity." }, { status: 400 });
    }
    const result = await getPool().query(`INSERT INTO public.products(organization_id,sku,name,unit,purchase_price,selling_price,reorder_level)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,sku,name,unit,purchase_price,selling_price,reorder_level,active`,
      [ctx.organization_id,sku||null,name,unit||"unit",purchase,selling,reorder]);
    return NextResponse.json({ product: result.rows[0] }, { status: 201 });
  } catch (e) {
    const code = (e as {code?:string})?.code;
    return NextResponse.json({ error: code==="23505" ? "That SKU is already used in this workspace." : "Unable to save product." }, { status: code==="23505"?409:503 });
  }
}

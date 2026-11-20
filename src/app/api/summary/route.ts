import { NextResponse } from "next/server";
import { getOrganizationContext, getPool } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getOrganizationContext();
    if (!ctx?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!ctx.organization_id) return NextResponse.json({ error: "Create a workspace first." }, { status: 409 });
    const org = ctx.organization_id;
    const [products,sales,stock,low,recent] = await Promise.all([
      getPool().query("SELECT count(*)::int AS count FROM public.products WHERE organization_id=$1 AND active=true",[org]),
      getPool().query("SELECT count(*)::int AS count, COALESCE(sum(total),0)::numeric(14,2) AS revenue FROM public.sales WHERE organization_id=$1 AND status='completed' AND created_at >= date_trunc('month',now())",[org]),
      getPool().query("SELECT COALESCE(sum(quantity_on_hand),0)::numeric(14,3) AS units FROM public.current_stock WHERE organization_id=$1",[org]),
      getPool().query(`SELECT count(*)::int AS count FROM public.products p
        LEFT JOIN (SELECT product_id,sum(quantity_on_hand) AS qty FROM public.current_stock WHERE organization_id=$1 GROUP BY product_id) s ON s.product_id=p.id
        WHERE p.organization_id=$1 AND p.active=true AND COALESCE(s.qty,0)<=p.reorder_level`,[org]),
      getPool().query("SELECT id,receipt_number,total,payment_method,created_at FROM public.sales WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 6",[org])
    ]);
    return NextResponse.json({ products:products.rows[0], sales:sales.rows[0], stock:stock.rows[0], lowStock:low.rows[0], recentSales:recent.rows });
  } catch { return NextResponse.json({ error: "Unable to load dashboard data." }, { status: 503 }); }
}

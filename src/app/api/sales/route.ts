import { NextRequest, NextResponse } from "next/server";
import { getOrganizationContext, getPool, roleAllowed } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const methods = ["cash","mobile_money","card","bank_transfer","credit","other"];

export async function GET() {
  try {
    const ctx = await getOrganizationContext();
    if (!ctx?.user) return NextResponse.json({error:"Authentication required."},{status:401});
    if (!ctx.organization_id) return NextResponse.json({sales:[]});
    const result = await getPool().query("SELECT id,receipt_number,status,subtotal,discount,tax,total,payment_method,created_at FROM public.sales WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",[ctx.organization_id]);
    return NextResponse.json({sales:result.rows});
  } catch { return NextResponse.json({error:"Unable to load sales."},{status:503}); }
}

export async function POST(request: NextRequest) {
  const ctx = await getOrganizationContext().catch(()=>null);
  if (!ctx?.user) return NextResponse.json({error:"Authentication required."},{status:401});
  if (!ctx.organization_id) return NextResponse.json({error:"Create a workspace first."},{status:409});
  if (!roleAllowed(ctx.role,["owner","admin","manager","cashier"])) return NextResponse.json({error:"You do not have permission to record sales."},{status:403});
  let body: {storeId?:unknown;paymentMethod?:unknown;items?:unknown};
  try { body=await request.json(); } catch { return NextResponse.json({error:"Invalid request."},{status:400}); }
  if (!Array.isArray(body.items) || body.items.length<1 || body.items.length>40) return NextResponse.json({error:"Add between 1 and 40 sale items."},{status:400});
  const items = body.items.map((item: any)=>({productId:String(item?.productId??""),quantity:Number(item?.quantity)}));
  if (items.some((i:any)=>! /^[0-9a-f-]{36}$/i.test(i.productId) || !Number.isFinite(i.quantity) || i.quantity<=0) || new Set(items.map((i:any)=>i.productId)).size!==items.length) {
    return NextResponse.json({error:"Each item must have a valid product and positive quantity. Duplicate products are not allowed."},{status:400});
  }
  const paymentMethod = typeof body.paymentMethod==="string" ? body.paymentMethod : "cash";
  if (!methods.includes(paymentMethod)) return NextResponse.json({error:"Select a valid payment method."},{status:400});
  const pool=getPool(), client=await pool.connect(), org=ctx.organization_id;
  const storeId=typeof body.storeId==="string"?body.storeId:ctx.store_id;
  if (!storeId) { client.release(); return NextResponse.json({error:"Create a store before recording sales."},{status:409}); }
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[org+":"+storeId]);
    const store=await client.query("SELECT id FROM public.stores WHERE id=$1 AND organization_id=$2",[storeId,org]);
    if (!store.rowCount) { await client.query("ROLLBACK"); return NextResponse.json({error:"Store not found."},{status:404}); }
    let subtotal=0;
    const products=[];
    for (const item of items) {
      const p=await client.query("SELECT id,name,selling_price FROM public.products WHERE id=$1 AND organization_id=$2 AND active=true",[item.productId,org]);
      if (!p.rowCount) { await client.query("ROLLBACK"); return NextResponse.json({error:"One of the selected products is unavailable."},{status:400}); }
      const stock=await client.query("SELECT COALESCE(sum(quantity),0)::numeric AS quantity FROM public.stock_movements WHERE organization_id=$1 AND store_id=$2 AND product_id=$3",[org,storeId,item.productId]);
      if (Number(stock.rows[0].quantity)<item.quantity) { await client.query("ROLLBACK"); return NextResponse.json({error:"Insufficient stock for "+p.rows[0].name+"."},{status:409}); }
      const lineTotal=Math.round(item.quantity*item.unitPrice*100)/100;
      subtotal+=lineTotal;
      products.push({...item,name:p.rows[0].name,lineTotal});
    }
    const total=Math.round(subtotal*100)/100;
    const receipt="SP-"+new Date().toISOString().slice(0,10).replace(/-/g,"")+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
    const sale=await client.query(`INSERT INTO public.sales(organization_id,store_id,receipt_number,status,subtotal,total,payment_method,created_by)
      VALUES($1,$2,$3,'completed',$4,$4,$5,$6) RETURNING id,receipt_number,total,payment_method,created_at`,
      [org,storeId,receipt,total,paymentMethod,ctx.user.id]);
    for (const item of products) {
      await client.query("INSERT INTO public.sale_items(sale_id,product_id,quantity,unit_price,line_total) VALUES($1,$2,$3,$4,$5)",[sale.rows[0].id,item.productId,item.quantity,item.unitPrice,item.lineTotal]);
      await client.query(`INSERT INTO public.stock_movements(organization_id,store_id,product_id,movement_type,quantity,unit_cost,reference_type,reference_id,created_by)
        VALUES($1,$2,$3,'sale',$4,0,'sale',$5,$6)`,[org,storeId,item.productId,-item.quantity,sale.rows[0].id,ctx.user.id]);
    }
    await client.query("COMMIT");
    return NextResponse.json({sale:sale.rows[0]},{status:201});
  } catch {
    await client.query("ROLLBACK");
    return NextResponse.json({error:"Sale could not be completed. No stock was deducted."},{status:503});
  } finally { client.release(); }
}

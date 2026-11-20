import { NextRequest, NextResponse } from "next/server";
import { getOrganizationContext, getPool, roleAllowed } from "@/lib/db";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ctx=await getOrganizationContext().catch(()=>null);
  if (!ctx?.user) return NextResponse.json({error:"Authentication required."},{status:401});
  if (!ctx.organization_id) return NextResponse.json({error:"Create a workspace first."},{status:409});
  if (!roleAllowed(ctx.role,["owner","admin","manager","stock_clerk"])) return NextResponse.json({error:"You do not have permission to receive purchases."},{status:403});
  let body:any;
  try { body=await request.json(); } catch { return NextResponse.json({error:"Invalid request."},{status:400}); }
  const storeId=typeof body.storeId==="string"?body.storeId:ctx.store_id;
  if (!storeId || !Array.isArray(body.items) || body.items.length<1 || body.items.length>40) return NextResponse.json({error:"Select a store and add purchase items."},{status:400});
  const items=body.items.map((x:any)=>({productId:String(x?.productId??""),quantity:Number(x?.quantity),unitCost:Number(x?.unitCost)}));
  if(items.some((x:any)=>! /^[0-9a-f-]{36}$/i.test(x.productId)||!Number.isFinite(x.quantity)||x.quantity<=0||!Number.isFinite(x.unitCost)||x.unitCost<0)||new Set(items.map((x:any)=>x.productId)).size!==items.length) return NextResponse.json({error:"Invalid purchase items."},{status:400});
  const client=await getPool().connect(),org=ctx.organization_id;
  try {
    await client.query("BEGIN");
    const store=await client.query("SELECT id FROM public.stores WHERE id=$1 AND organization_id=$2",[storeId,org]);
    if(!store.rowCount){await client.query("ROLLBACK");return NextResponse.json({error:"Store not found."},{status:404});}
    if(body.supplierId){
      const supplier=await client.query("SELECT id FROM public.suppliers WHERE id=$1 AND organization_id=$2",[body.supplierId,org]);
      if(!supplier.rowCount){await client.query("ROLLBACK");return NextResponse.json({error:"Supplier not found."},{status:404});}
    }
    let total=0, products=[];
    for(const item of items){
      const p=await client.query("SELECT id FROM public.products WHERE id=$1 AND organization_id=$2 AND active=true",[item.productId,org]);
      if(!p.rowCount){await client.query("ROLLBACK");return NextResponse.json({error:"A selected product is unavailable."},{status:400});}
      const line=Math.round(item.quantity*item.unitCost*100)/100;total+=line;products.push({...item,line});
    }
    const purchase=await client.query(`INSERT INTO public.purchases(organization_id,store_id,supplier_id,reference_number,status,total,created_by)
      VALUES($1,$2,$3,$4,'received',$5,$6) RETURNING id,reference_number,total,created_at`,
      [org,storeId,body.supplierId||null,typeof body.referenceNumber==="string"?body.referenceNumber.slice(0,80):null,Math.round(total*100)/100,ctx.user.id]);
    for(const item of products){
      await client.query("INSERT INTO public.purchase_items(purchase_id,product_id,quantity,unit_cost,line_total) VALUES($1,$2,$3,$4,$5)",[purchase.rows[0].id,item.productId,item.quantity,item.unitCost,item.line]);
      await client.query(`INSERT INTO public.stock_movements(organization_id,store_id,product_id,movement_type,quantity,unit_cost,reference_type,reference_id,created_by)
        VALUES($1,$2,$3,'purchase',$4,$5,'purchase',$6,$7)`,[org,storeId,item.productId,item.quantity,item.unitCost,purchase.rows[0].id,ctx.user.id]);
    }
    await client.query("COMMIT");
    return NextResponse.json({purchase:purchase.rows[0]},{status:201});
  } catch { await client.query("ROLLBACK");return NextResponse.json({error:"Purchase could not be received."},{status:503});}
  finally {client.release();}
}

import { NextRequest, NextResponse } from "next/server";
import { getOrganizationContext, getPool, roleAllowed } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(){
  try{
    const ctx=await getOrganizationContext();
    if(!ctx?.user)return NextResponse.json({error:"Authentication required."},{status:401});
    if(!ctx.organization_id)return NextResponse.json({expenses:[]});
    const r=await getPool().query("SELECT id,category,description,amount,payment_method,incurred_on,created_at FROM public.expenses WHERE organization_id=$1 ORDER BY incurred_on DESC,created_at DESC LIMIT 100",[ctx.organization_id]);
    return NextResponse.json({expenses:r.rows});
  }catch{return NextResponse.json({error:"Unable to load expenses."},{status:503});}
}

export async function POST(request:NextRequest){
  const ctx=await getOrganizationContext().catch(()=>null);
  if(!ctx?.user)return NextResponse.json({error:"Authentication required."},{status:401});
  if(!ctx.organization_id)return NextResponse.json({error:"Create a workspace first."},{status:409});
  if(!roleAllowed(ctx.role,["owner","admin","manager"]))return NextResponse.json({error:"You do not have permission to record expenses."},{status:403});
  let body:any;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
  const category=typeof body.category==="string"?body.category.trim():"";
  const description=typeof body.description==="string"?body.description.trim():"";
  const amount=Number(body.amount);
  if(category.length<2||category.length>100||!Number.isFinite(amount)||amount<=0)return NextResponse.json({error:"Enter an expense category and a positive amount."},{status:400});
  try{
    const r=await getPool().query(`INSERT INTO public.expenses(organization_id,store_id,category,description,amount,payment_method,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,category,description,amount,incurred_on,created_at`,
      [ctx.organization_id,ctx.store_id||null,category,description||null,amount,typeof body.paymentMethod==="string"?body.paymentMethod:null,ctx.user.id]);
    return NextResponse.json({expense:r.rows[0]},{status:201});
  }catch{return NextResponse.json({error:"Unable to save expense."},{status:503});}
}

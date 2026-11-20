"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

type Product={id:string;sku:string|null;name:string;unit:string;purchase_price:string|number;selling_price:string|number;reorder_level:string|number;active:boolean;quantity_on_hand:string|number};
type Sale={id:string;receipt_number:string;total:string|number;payment_method:string;created_at:string};
type Expense={id:string;category:string;description:string|null;amount:string|number;incurred_on:string};
type Section="overview"|"products"|"sales"|"purchases"|"expenses";
type CartItem={productId:string;quantity:number;unitPrice:number};

const money=(value:number|string,currency="XAF")=>new Intl.NumberFormat("fr-FR",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value||0));
const shortDate=(value:string)=>new Intl.DateTimeFormat("en",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));

export default function Home(){
 const router=useRouter();
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [user,setUser]=useState<{name:string;email:string}|null>(null);
 const [org,setOrg]=useState<{id:string;name:string;currency:string;role:string;storeId:string;storeName:string}|null>(null);
 const [section,setSection]=useState<Section>("overview");
 const [summary,setSummary]=useState<any>(null);
 const [products,setProducts]=useState<Product[]>([]);
 const [sales,setSales]=useState<Sale[]>([]);
 const [expenses,setExpenses]=useState<Expense[]>([]);
 const [productModal,setProductModal]=useState(false);
 const [productForm,setProductForm]=useState({name:"",sku:"",unit:"unit",purchasePrice:"",sellingPrice:"",reorderLevel:""});
 const [setupForm,setSetupForm]=useState({businessName:"",storeName:"Main store",currency:"XAF"});
 const [saving,setSaving]=useState(false);
 const [cart,setCart]=useState<CartItem[]>([]);
 const [selectedProduct,setSelectedProduct]=useState("");
 const [quantity,setQuantity]=useState("1");
 const [paymentMethod,setPaymentMethod]=useState("cash");
 const [purchaseProduct,setPurchaseProduct]=useState("");
 const [purchaseQty,setPurchaseQty]=useState("1");
 const [purchaseCost,setPurchaseCost]=useState("");
 const [expenseForm,setExpenseForm]=useState({category:"",description:"",amount:"",paymentMethod:"cash"});

 const loadWorkspace=useCallback(async()=>{
  const [me,stats,prod,salesRes,expenseRes]=await Promise.all([
   fetch("/api/me",{cache:"no-store"}),fetch("/api/summary",{cache:"no-store"}),fetch("/api/products",{cache:"no-store"}),fetch("/api/sales",{cache:"no-store"}),fetch("/api/expenses",{cache:"no-store"})
  ]);
  if(me.status===401){router.replace("/login");return;}
  if(!me.ok)throw new Error("Could not load your workspace.");
  const md=await me.json();setUser(md.user);setOrg(md.organization);
  if(!md.organization){setLoading(false);return;}
  const [sd,pd,sald,ed]=await Promise.all([stats.json(),prod.json(),salesRes.json(),expenseRes.json()]);
  if(stats.ok)setSummary(sd);
  if(prod.ok)setProducts(pd.products||[]);
  if(salesRes.ok)setSales(sald.sales||[]);
  if(expenseRes.ok)setExpenses(ed.expenses||[]);
  setLoading(false);
 },[router]);

 useEffect(()=>{loadWorkspace().catch(e=>{setError(e instanceof Error?e.message:"Unable to load data.");setLoading(false);});},[loadWorkspace]);

 const totalCart=useMemo(()=>cart.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0),[cart]);
 const currency=org?.currency||"XAF";

 async function createWorkspace(event:FormEvent){
  event.preventDefault();setSaving(true);setError("");
  try{
   const r=await fetch("/api/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(setupForm)});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"Workspace setup failed.");
   setNotice("Your business workspace is ready.");await loadWorkspace();
  }catch(e){setError(e instanceof Error?e.message:"Unable to create workspace.");}
  finally{setSaving(false);}
 }

 async function addProduct(event:FormEvent){
  event.preventDefault();setSaving(true);setError("");
  try{
   const r=await fetch("/api/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(productForm)});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to add product.");
   setProductModal(false);setProductForm({name:"",sku:"",unit:"unit",purchasePrice:"",sellingPrice:"",reorderLevel:""});
   setNotice("Product added to your catalogue.");await loadWorkspace();
  }catch(e){setError(e instanceof Error?e.message:"Unable to add product.");}
  finally{setSaving(false);}
 }

 function addToCart(){
  const product=products.find(p=>p.id===selectedProduct);
  const qty=Number(quantity);
  if(!product||!Number.isFinite(qty)||qty<=0){setError("Choose a product and a valid quantity.");return;}
  const alreadyInCart=cart.find(x=>x.productId===product.id)?.quantity||0;
  if(Number(product.quantity_on_hand)<alreadyInCart+qty){setError("The basket quantity would exceed available stock.");return;}
  setCart(current=>{const exists=current.find(x=>x.productId===product.id);return exists?current.map(x=>x.productId===product.id?{...x,quantity:x.quantity+qty}:x):[...current,{productId:product.id,quantity:qty,unitPrice:Number(product.selling_price)}]});
  setSelectedProduct("");setQuantity("1");setError("");
 }

 async function completeSale(){
  if(!cart.length||saving)return;setSaving(true);setError("");
  try{
   const r=await fetch("/api/sales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:cart,paymentMethod})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"Sale failed.");
   setCart([]);setNotice("Sale completed · "+d.sale.receipt_number);await loadWorkspace();
  }catch(e){setError(e instanceof Error?e.message:"Sale failed.");}
  finally{setSaving(false);}
 }

 async function receivePurchase(event:FormEvent){
  event.preventDefault();setSaving(true);setError("");
  try{
   const r=await fetch("/api/purchases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:[{productId:purchaseProduct,quantity:Number(purchaseQty),unitCost:Number(purchaseCost)}]})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"Purchase could not be received.");
   setPurchaseProduct("");setPurchaseQty("1");setPurchaseCost("");setNotice("Stock received successfully.");await loadWorkspace();
  }catch(e){setError(e instanceof Error?e.message:"Purchase failed.");}
  finally{setSaving(false);}
 }

 async function addExpense(event:FormEvent){
  event.preventDefault();setSaving(true);setError("");
  try{
   const r=await fetch("/api/expenses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(expenseForm)});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"Expense could not be saved.");
   setExpenseForm({category:"",description:"",amount:"",paymentMethod:"cash"});setNotice("Expense recorded.");await loadWorkspace();
  }catch(e){setError(e instanceof Error?e.message:"Expense failed.");}
  finally{setSaving(false);}
 }

 async function signOut(){await authClient.signOut();router.replace("/login");router.refresh();}
 const nav:[Section,string,string][]=[["overview","⌂","Overview"],["products","▦","Products"],["sales","↗","Sales"],["purchases","↙","Purchases"],["expenses","◷","Expenses"]];

 if(loading)return <main className="loading-screen"><div className="loader-mark">S</div><p>Preparing your workspace…</p></main>;
 if(!org)return <main className="setup-screen"><section className="setup-card"><div className="brand"><span className="brand-icon">S</span> StorePilot</div><span className="eyebrow">ONE QUICK SETUP</span><h1>Let’s set up your store.</h1><p>Create your business workspace. You can add more locations and invite your team later.</p><form onSubmit={createWorkspace}><label>Business name<input required minLength={2} maxLength={160} value={setupForm.businessName} onChange={e=>setSetupForm({...setupForm,businessName:e.target.value})} placeholder="e.g. Cedric Electronics"/></label><label>First store / branch<input required minLength={2} maxLength={160} value={setupForm.storeName} onChange={e=>setSetupForm({...setupForm,storeName:e.target.value})}/></label><label>Business currency<select value={setupForm.currency} onChange={e=>setSetupForm({...setupForm,currency:e.target.value})}><option value="XAF">XAF · Central African CFA franc</option><option value="EUR">EUR · Euro</option><option value="USD">USD · US dollar</option><option value="NGN">NGN · Nigerian naira</option><option value="GHS">GHS · Ghanaian cedi</option></select></label><button className="primary full" disabled={saving}>{saving?"Creating workspace…":"Create my workspace"}</button></form>{error&&<p className="error">{error}</p>}<small>Signed in as {user?.email}</small></section></main>;

 return <div className="app-shell">
  <aside className="sidebar"><a href="/" className="brand"><span className="brand-icon">S</span><span>StorePilot<small>STORE MANAGEMENT</small></span></a>
   <div className="store-switch"><span className="store-avatar">{org.name.slice(0,1).toUpperCase()}</span><span><strong>{org.name}</strong><small>{org.storeName||"Main store"}</small></span><span className="chevron">⌄</span></div>
   <div className="nav-label">WORKSPACE</div><nav>{nav.map(([id,icon,label])=><button key={id} className={section===id?"nav-item active":"nav-item"} onClick={()=>setSection(id)}><span>{icon}</span>{label}{id==="products"&&<small>{products.length}</small>}</button>)}</nav>
   <div className="sidebar-bottom"><div className="online-dot"></div><span>Workspace synced</span><button onClick={()=>setNotice("Cloud data is stored in your business workspace.")} aria-label="Workspace status">ⓘ</button></div>
   <div className="profile"><div className="profile-avatar">{(user?.name||user?.email||"U").slice(0,1).toUpperCase()}</div><div className="profile-copy"><strong>{user?.name||"Store owner"}</strong><small>{user?.email}</small></div><button onClick={signOut} title="Sign out" aria-label="Sign out">↗</button></div>
  </aside>
  <main className="main-area">
   <header className="topbar"><div><span className="top-context">Workspace /</span> <strong>{nav.find(n=>n[0]===section)?.[2]}</strong></div><div className="top-actions"><span className="today">{new Intl.DateTimeFormat("en",{weekday:"short",month:"short",day:"numeric"}).format(new Date())}</span><button className="icon-btn" onClick={()=>loadWorkspace()} title="Refresh">↻</button><button className="user-chip" onClick={signOut}>{(user?.name||"U").slice(0,1).toUpperCase()}</button></div></header>
   <div className="content">
    {error&&<div className="alert error-alert"><span>!</span>{error}<button onClick={()=>setError("")}>×</button></div>}
    {notice&&<div className="alert success-alert"><span>✓</span>{notice}<button onClick={()=>setNotice("")}>×</button></div>}
    {section==="overview"&&<><div className="page-heading"><div><span className="eyebrow">YOUR BUSINESS AT A GLANCE</span><h1>Good day{user?.name?" "+user.name.split(" ")[0]:""} 👋</h1><p>Here’s what’s happening in {org.name} today.</p></div><button className="primary" onClick={()=>setSection("sales")}>＋ New sale</button></div>
      <div className="stat-grid"><article className="stat-card"><div className="stat-top"><span>Monthly revenue</span><span className="stat-icon green">↗</span></div><strong>{money(summary?.sales?.revenue||0,currency)}</strong><small className="muted">Completed sales this month</small></article><article className="stat-card"><div className="stat-top"><span>Products</span><span className="stat-icon blue">▦</span></div><strong>{summary?.products?.count??products.length}</strong><small className="muted">Active catalogue items</small></article><article className="stat-card"><div className="stat-top"><span>Units in stock</span><span className="stat-icon purple">◫</span></div><strong>{Number(summary?.stock?.units||0).toLocaleString("en")}</strong><small className="muted">Across your locations</small></article><article className="stat-card"><div className="stat-top"><span>Low stock alerts</span><span className="stat-icon orange">!</span></div><strong>{summary?.lowStock?.count??0}</strong><small className="muted">At or below reorder level</small></article></div>
      <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><h2>Recent sales</h2><p>Your latest completed transactions</p></div><button className="text-btn" onClick={()=>setSection("sales")}>View sales ↗</button></div>{sales.length?<div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Date</th><th>Payment</th><th className="right">Total</th></tr></thead><tbody>{sales.slice(0,6).map(s=><tr key={s.id}><td className="receipt">{s.receipt_number}</td><td>{shortDate(s.created_at)}</td><td><span className="pill">{s.payment_method?.replace("_"," ")}</span></td><td className="right amount">{money(s.total,currency)}</td></tr>)}</tbody></table></div>:<div className="empty-state"><span>↗</span><strong>No sales yet</strong><p>Your completed sales will appear here.</p><button className="secondary" onClick={()=>setSection("sales")}>Record your first sale</button></div>}</section>
      <section className="panel quick-panel"><div className="panel-head"><div><h2>Quick actions</h2><p>Get everyday tasks done faster</p></div></div><button className="quick-action" onClick={()=>setProductModal(true)}><span className="quick-icon blue">＋</span><span><strong>Add a product</strong><small>Create a new catalogue item</small></span><b>›</b></button><button className="quick-action" onClick={()=>setSection("purchases")}><span className="quick-icon green">↓</span><span><strong>Receive stock</strong><small>Record a new purchase</small></span><b>›</b></button><button className="quick-action" onClick={()=>setSection("expenses")}><span className="quick-icon orange">−</span><span><strong>Record an expense</strong><small>Track operating costs</small></span><b>›</b></button><button className="quick-action" onClick={()=>setSection("sales")}><span className="quick-icon purple">↗</span><span><strong>Make a sale</strong><small>Open the checkout screen</small></span><b>›</b></button></section></div>
      <section className="panel inventory-panel"><div className="panel-head"><div><h2>Stock overview</h2><p>Items that need your attention</p></div><button className="text-btn" onClick={()=>setSection("products")}>Manage inventory ↗</button></div>{products.filter(p=>Number(p.quantity_on_hand)<=Number(p.reorder_level)).length?<div className="low-list">{products.filter(p=>Number(p.quantity_on_hand)<=Number(p.reorder_level)).slice(0,5).map(p=><div className="low-row" key={p.id}><span className="product-avatar">{p.name.slice(0,1).toUpperCase()}</span><span className="low-name"><strong>{p.name}</strong><small>{p.sku||"No SKU"}</small></span><span className="stock-warning">{p.quantity_on_hand} {p.unit} left</span></div>)}</div>:<div className="all-good"><span>✓</span><div><strong>Stock levels look good</strong><small>No products are currently at or below their reorder level.</small></div></div>}</section>
     </>}
    {section==="products"&&<><div className="page-heading"><div><span className="eyebrow">CATALOGUE & INVENTORY</span><h1>Products</h1><p>Manage your items, prices and stock levels.</p></div><button className="primary" onClick={()=>setProductModal(true)}>＋ Add product</button></div><section className="panel"><div className="panel-head"><div><h2>Product catalogue <span className="count-badge">{products.length}</span></h2><p>All active and archived products in your workspace</p></div></div>{products.length?<div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>In stock</th><th>Purchase price</th><th>Selling price</th><th>Status</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td><div className="product-cell"><span className="product-avatar">{p.name.slice(0,1).toUpperCase()}</span><strong>{p.name}</strong></div></td><td>{p.sku||"—"}</td><td><strong>{Number(p.quantity_on_hand).toLocaleString("en")} {p.unit}</strong></td><td>{money(p.purchase_price,currency)}</td><td className="amount">{money(p.selling_price,currency)}</td><td>{Number(p.quantity_on_hand)<=Number(p.reorder_level)?<span className="status low">Low stock</span>:<span className="status active">In stock</span>}</td></tr>)}</tbody></table></div>:<div className="empty-state"><span>▦</span><strong>Your catalogue is empty</strong><p>Add products to start tracking stock and sales.</p><button className="primary" onClick={()=>setProductModal(true)}>Add your first product</button></div>}</section></>}
    {section==="sales"&&<><div className="page-heading"><div><span className="eyebrow">POINT OF SALE</span><h1>New sale</h1><p>Create a receipt and update inventory in one step.</p></div></div><div className="sales-layout"><section className="panel"><div className="panel-head"><div><h2>Choose products</h2><p>Select an item and quantity to add to the basket.</p></div></div><div className="inline-form"><label className="grow">Product<select value={selectedProduct} onChange={e=>setSelectedProduct(e.target.value)}><option value="">Choose a product</option>{products.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name} · {p.quantity_on_hand} {p.unit} available</option>)}</select></label><label className="qty-label">Qty<input type="number" min="0.001" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><button className="secondary add-line" onClick={addToCart}>Add</button></div><div className="basket-list">{cart.map(item=>{const p=products.find(x=>x.id===item.productId);return <div className="basket-row" key={item.productId}><div><strong>{p?.name}</strong><small>{item.quantity} × {money(item.unitPrice,currency)}</small></div><strong>{money(item.quantity*item.unitPrice,currency)}</strong><button onClick={()=>setCart(c=>c.filter(x=>x.productId!==item.productId))} aria-label="Remove">×</button></div>})}{!cart.length&&<div className="empty-state compact"><span>＋</span><strong>Your basket is empty</strong><p>Add products to start a sale.</p></div>}</div></section><section className="panel checkout"><div className="panel-head"><div><h2>Checkout</h2><p>Review and complete payment.</p></div></div><label>Payment method<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="mobile_money">Mobile Money</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="credit">Credit</option></select></label><div className="total-line"><span>Items</span><strong>{cart.reduce((n,x)=>n+x.quantity,0)}</strong></div><div className="total-line grand"><span>Total due</span><strong>{money(totalCart,currency)}</strong></div><button className="primary full" disabled={!cart.length||saving} onClick={completeSale}>{saving?"Processing…":"Complete sale"}</button><small className="muted">Stock is deducted only after the sale is successfully committed.</small></section></div><section className="panel"><div className="panel-head"><div><h2>Sales history</h2><p>Latest transactions</p></div></div>{sales.length?<div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Date</th><th>Payment</th><th className="right">Total</th></tr></thead><tbody>{sales.map(s=><tr key={s.id}><td className="receipt">{s.receipt_number}</td><td>{shortDate(s.created_at)}</td><td><span className="pill">{s.payment_method}</span></td><td className="right amount">{money(s.total,currency)}</td></tr>)}</tbody></table></div>:<p className="empty-inline">No transactions recorded yet.</p>}</section></>}
    {section==="purchases"&&<><div className="page-heading"><div><span className="eyebrow">INVENTORY INBOUND</span><h1>Receive stock</h1><p>Record products received from your suppliers.</p></div></div><section className="panel form-panel"><div className="panel-head"><div><h2>New stock receipt</h2><p>Received quantities are added to your stock ledger immediately.</p></div></div><form onSubmit={receivePurchase} className="form-grid"><label className="span-2">Product<select required value={purchaseProduct} onChange={e=>setPurchaseProduct(e.target.value)}><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Quantity received<input required type="number" min="0.001" step="0.001" value={purchaseQty} onChange={e=>setPurchaseQty(e.target.value)}/></label><label>Unit purchase cost<input required type="number" min="0" step="0.01" value={purchaseCost} onChange={e=>setPurchaseCost(e.target.value)} placeholder="0.00"/></label><div className="span-2"><button className="primary" disabled={saving||!products.length}>{saving?"Saving…":"Receive stock"}</button></div></form></section><div className="info-note"><span>i</span><p>For accurate stock valuation, enter the supplier's actual unit cost. Supplier directory and multi-item purchase orders are planned next.</p></div></>}
    {section==="expenses"&&<><div className="page-heading"><div><span className="eyebrow">COST CONTROL</span><h1>Expenses</h1><p>Keep track of your day-to-day business costs.</p></div></div><div className="expense-layout"><section className="panel form-panel"><div className="panel-head"><div><h2>Record an expense</h2><p>Add a new business expense.</p></div></div><form onSubmit={addExpense} className="form-grid"><label className="span-2">Category<input required maxLength={100} value={expenseForm.category} onChange={e=>setExpenseForm({...expenseForm,category:e.target.value})} placeholder="e.g. Transport, Rent, Electricity"/></label><label className="span-2">Description<input value={expenseForm.description} onChange={e=>setExpenseForm({...expenseForm,description:e.target.value})} placeholder="Optional details"/></label><label>Amount<input required type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm,amount:e.target.value})} placeholder="0.00"/></label><label>Payment method<select value={expenseForm.paymentMethod} onChange={e=>setExpenseForm({...expenseForm,paymentMethod:e.target.value})}><option value="cash">Cash</option><option value="mobile_money">Mobile Money</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option></select></label><div className="span-2"><button className="primary" disabled={saving}>{saving?"Saving…":"Save expense"}</button></div></form></section><section className="panel"><div className="panel-head"><div><h2>Recent expenses</h2><p>Latest recorded costs</p></div></div>{expenses.length?<div className="expense-list">{expenses.map(e=><div className="expense-row" key={e.id}><span className="expense-icon">−</span><div><strong>{e.category}</strong><small>{e.description||e.incurred_on}</small></div><b>{money(e.amount,currency)}</b></div>)}</div>:<div className="empty-state compact"><span>◷</span><strong>No expenses yet</strong><p>Recorded costs will appear here.</p></div>}</section></div></>}
   </div>
   <footer className="footer">StorePilot <span>·</span> Business operations, made clearer <span className="footer-right">Currency: {currency} · Role: {org.role}</span></footer>
  </main>
  {productModal&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setProductModal(false)}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="product-title"><div className="modal-head"><div><span className="eyebrow">CATALOGUE</span><h2 id="product-title">Add a product</h2></div><button className="close-btn" onClick={()=>setProductModal(false)}>×</button></div><form onSubmit={addProduct} className="form-grid"><label className="span-2">Product name<input required minLength={2} maxLength={200} value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})} placeholder="e.g. USB-C Charger"/></label><label>SKU / code<input maxLength={80} value={productForm.sku} onChange={e=>setProductForm({...productForm,sku:e.target.value})} placeholder="Optional"/></label><label>Unit<select value={productForm.unit} onChange={e=>setProductForm({...productForm,unit:e.target.value})}><option value="unit">Unit</option><option value="piece">Piece</option><option value="box">Box</option><option value="pack">Pack</option><option value="kg">Kilogram</option><option value="litre">Litre</option><option value="metre">Metre</option></select></label><label>Purchase price<input type="number" min="0" step="0.01" value={productForm.purchasePrice} onChange={e=>setProductForm({...productForm,purchasePrice:e.target.value})} placeholder="0"/></label><label>Selling price<input type="number" min="0" step="0.01" value={productForm.sellingPrice} onChange={e=>setProductForm({...productForm,sellingPrice:e.target.value})} placeholder="0"/></label><label className="span-2">Reorder alert quantity<input type="number" min="0" step="0.001" value={productForm.reorderLevel} onChange={e=>setProductForm({...productForm,reorderLevel:e.target.value})} placeholder="0"/></label><div className="modal-actions span-2"><button type="button" className="secondary" onClick={()=>setProductModal(false)}>Cancel</button><button className="primary" disabled={saving}>{saving?"Saving…":"Save product"}</button></div></form></section></div>}
  <nav className="mobile-nav">{nav.map(([id,icon,label])=><button key={id} className={section===id?"active":""} onClick={()=>setSection(id)}><span>{icon}</span>{label}</button>)}</nav>
 </div>;
}

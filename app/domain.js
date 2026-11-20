export const STORES = [
  "products", "sales", "stockMovements", "suppliers", "expenses",
  "staff", "maintenance", "vouchers", "complaints", "settings"
];

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatXAF(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0
  }).format(toNumber(value));
}

export function validateProduct(product) {
  const errors = [];
  if (!String(product.name || "").trim()) errors.push("Product name is required.");
  if (!String(product.sku || "").trim()) errors.push("SKU is required.");
  for (const field of ["sellingPrice", "costPrice", "stock", "reorderLevel"]) {
    const value = Number(product[field]);
    if (!Number.isFinite(value) || value < 0) errors.push(`${field} must be zero or greater.`);
  }
  return errors;
}

export function calculateSale(items, discount = 0) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Add at least one product to the sale.");
  }

  const lines = items.map(item => {
    const quantity = Math.floor(toNumber(item.quantity));
    const unitPrice = toNumber(item.unitPrice);
    const unitCost = toNumber(item.unitCost);
    if (quantity < 1) throw new Error("Sale quantities must be at least one.");
    if (unitPrice < 0 || unitCost < 0) throw new Error("Prices cannot be negative.");
    return {
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      quantity,
      unitPrice,
      unitCost,
      lineTotal: quantity * unitPrice,
      lineCost: quantity * unitCost
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const safeDiscount = Math.min(subtotal, Math.max(0, toNumber(discount)));
  const totalCost = lines.reduce((sum, line) => sum + line.lineCost, 0);

  return {
    lines,
    subtotal,
    discount: safeDiscount,
    total: subtotal - safeDiscount,
    cost: totalCost,
    profit: subtotal - safeDiscount - totalCost
  };
}

export function applyStockDelta(currentStock, delta) {
  const current = Math.floor(toNumber(currentStock));
  const change = Math.floor(toNumber(delta));
  const next = current + change;
  if (current < 0 || change === 0) throw new Error("A non-zero stock movement is required.");
  if (next < 0) throw new Error("This movement would make stock negative.");
  return next;
}

export function summarizeStore({ products = [], sales = [], expenses = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  const todaysSales = sales.filter(sale => String(sale.createdAt || "").slice(0, 10) === today);
  const lowStock = products.filter(product => toNumber(product.stock) <= toNumber(product.reorderLevel));
  return {
    productCount: products.length,
    lowStockCount: lowStock.length,
    todayRevenue: todaysSales.reduce((sum, sale) => sum + toNumber(sale.total), 0),
    todayOrders: todaysSales.length,
    totalExpenses: expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0),
    lowStock
  };
}

import { STORES, applyStockDelta, calculateSale } from "./domain.js";

const DB_NAME = "mobile-erp-store";
const DB_VERSION = 1;
let databasePromise;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local database."));
    request.onblocked = () => reject(new Error("Database upgrade is blocked by another open tab."));
  });
  return databasePromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Database request failed."));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Database transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Database transaction was cancelled."));
  });
}

export async function listRecords(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readonly");
  const result = await requestResult(tx.objectStore(storeName).getAll());
  await transactionDone(tx);
  return result.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
}

export async function getRecord(storeName, id) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readonly");
  const result = await requestResult(tx.objectStore(storeName).get(id));
  await transactionDone(tx);
  return result || null;
}

export async function saveRecord(storeName, record) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readwrite");
  const now = new Date().toISOString();
  const saved = { ...record, id: record.id || crypto.randomUUID(), updatedAt: now };
  if (!saved.createdAt) saved.createdAt = now;
  tx.objectStore(storeName).put(saved);
  await transactionDone(tx);
  return saved;
}

export async function deleteRecord(storeName, id) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(id);
  await transactionDone(tx);
}

export async function createSale(cart, discount = 0) {
  const db = await openDatabase();
  const tx = db.transaction(["products", "sales", "stockMovements"], "readwrite");
  const productsStore = tx.objectStore("products");
  const saleLines = [];

  for (const cartItem of cart) {
    const product = await requestResult(productsStore.get(cartItem.productId));
    if (!product) throw new Error("A product in this sale no longer exists.");
    const quantity = Math.floor(Number(cartItem.quantity));
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Sale quantity must be at least one.");
    if (product.stock < quantity) throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock}.`);
    saleLines.push({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      quantity,
      unitPrice: Number(product.sellingPrice),
      unitCost: Number(product.costPrice)
    });
  }

  const totals = calculateSale(saleLines, discount);
  const now = new Date().toISOString();
  const sale = {
    id: crypto.randomUUID(),
    receiptNumber: `S-${Date.now().toString(36).toUpperCase()}`,
    ...totals,
    status: "completed",
    createdAt: now,
    updatedAt: now
  };

  for (const line of sale.lines) {
    const product = await requestResult(productsStore.get(line.productId));
    const previousStock = Number(product.stock);
    const nextStock = applyStockDelta(previousStock, -line.quantity);
    productsStore.put({ ...product, stock: nextStock, updatedAt: now });
    tx.objectStore("stockMovements").add({
      id: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      type: "sale",
      delta: -line.quantity,
      before: previousStock,
      after: nextStock,
      reference: sale.receiptNumber,
      reason: "Sale",
      createdAt: now,
      updatedAt: now
    });
  }

  tx.objectStore("sales").add(sale);
  await transactionDone(tx);
  return sale;
}

export async function adjustStock(productId, delta, reason, type = "adjustment") {
  const db = await openDatabase();
  const tx = db.transaction(["products", "stockMovements"], "readwrite");
  const products = tx.objectStore("products");
  const product = await requestResult(products.get(productId));
  if (!product) throw new Error("Product not found.");
  const before = Number(product.stock);
  const after = applyStockDelta(before, delta);
  const now = new Date().toISOString();

  products.put({ ...product, stock: after, updatedAt: now });
  tx.objectStore("stockMovements").add({
    id: crypto.randomUUID(),
    productId,
    productName: product.name,
    type,
    delta: Number(delta),
    before,
    after,
    reason: String(reason || "").trim(),
    createdAt: now,
    updatedAt: now
  });
  await transactionDone(tx);
  return { before, after };
}

export async function exportBackup() {
  const db = await openDatabase();
  const tx = db.transaction(STORES, "readonly");
  const backup = { app: "Mobile ERP Store", schemaVersion: DB_VERSION, exportedAt: new Date().toISOString(), data: {} };
  await Promise.all(STORES.map(async name => {
    backup.data[name] = await requestResult(tx.objectStore(name).getAll());
  }));
  await transactionDone(tx);
  return backup;
}

export async function importBackup(backup) {
  if (!backup || backup.app !== "Mobile ERP Store" || !backup.data || backup.schemaVersion !== DB_VERSION) {
    throw new Error("This backup is not compatible with this version of Mobile ERP Store.");
  }
  const db = await openDatabase();
  const tx = db.transaction(STORES, "readwrite");
  for (const name of STORES) {
    const store = tx.objectStore(name);
    store.clear();
    for (const record of backup.data[name] || []) {
      if (!record || typeof record.id !== "string") throw new Error(`Invalid backup record in ${name}.`);
      store.put(record);
    }
  }
  await transactionDone(tx);
}

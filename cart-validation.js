export function sanitizeCart(cart, products) {
  if (!cart || typeof cart !== "object" || Array.isArray(cart)) return {};
  const byId = new Map(products.map(product => [String(product.id), product]));
  const clean = {};
  for (const [id, rawQuantity] of Object.entries(cart)) {
    const product = byId.get(id);
    const quantity = Number(rawQuantity);
    if (!product || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > Number(product.stock_qty)) continue;
    clean[id] = quantity;
  }
  return clean;
}

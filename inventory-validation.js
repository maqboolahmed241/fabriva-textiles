const INVENTORY_UNITS = new Set(["piece", "suit", "roll", "pack"]);

export function validateInventoryPayload(product) {
  if ("unit" in product && !INVENTORY_UNITS.has(product.unit)) {
    throw new Error("Choose a supported stock unit: Piece, Suit, Roll or Pack.");
  }
  for (const key of ["stock_qty", "low_stock_threshold"]) {
    if (key in product && (!Number.isFinite(Number(product[key])) || Number(product[key]) < 0 || !Number.isInteger(Number(product[key])))) {
      throw new Error(key === "stock_qty"
        ? "Stock quantity must be a whole number of zero or more."
        : "Low-stock warning must be a whole number of zero or more.");
    }
  }
  if ("price" in product && (!Number.isFinite(Number(product.price)) || Number(product.price) < 0)) {
    throw new Error("Price must be a valid non-negative amount.");
  }
  if ("sale_price" in product && product.sale_price !== null &&
      (!Number.isFinite(Number(product.sale_price)) || Number(product.sale_price) < 0 ||
       ("price" in product && Number(product.sale_price) > Number(product.price)))) {
    throw new Error("Sale price must be valid and cannot exceed the regular price.");
  }
}

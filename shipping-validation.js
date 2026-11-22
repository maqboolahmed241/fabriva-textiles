export function validateShippingRate(input) {
  const country = String(input.country_name ?? "").trim();
  const code = String(input.country_code ?? "").trim().toUpperCase();
  const region = String(input.region_name ?? "").trim();
  const currency = String(input.currency ?? "").trim().toUpperCase();
  const amount = Number(input.amount);
  const freeOver = input.free_over === null || input.free_over === undefined || input.free_over === ""
    ? null
    : Number(input.free_over);

  if (!country || country.length > 80) throw new Error("Enter a valid country name.");
  if (!/^[A-Z]{2}$/.test(code)) throw new Error("Enter a valid two-letter country code.");
  if (!region || region.length > 100) throw new Error("Enter a valid province or region.");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Select a valid three-letter currency code.");
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Delivery charge must be a valid amount of zero or greater.");
  if (freeOver !== null && (!Number.isFinite(freeOver) || freeOver < 0)) {
    throw new Error("Free-delivery threshold must be a valid amount of zero or greater.");
  }
  return { country_name: country, country_code: code, region_name: region, currency, amount, free_over: freeOver };
}

const SUPPORTED_CURRENCIES = new Set("AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP EGP ERN ETB EUR FJD GBP GEL GHS GIP GMD GNF GTQ HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW".split(" "));\n\nexport function validateShippingRate(input) {
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
  if (!SUPPORTED_CURRENCIES.has(currency)) throw new Error("Select a supported delivery currency.");
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Delivery charge must be a valid amount of zero or greater.");
  if (freeOver !== null && (!Number.isFinite(freeOver) || freeOver < 0)) {
    throw new Error("Free-delivery threshold must be a valid amount of zero or greater.");
  }
  return { country_name: country, country_code: code, region_name: region, currency, amount, free_over: freeOver };
}

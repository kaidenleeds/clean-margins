export const NAICS_CODES = Object.freeze(["561720", "561790"]);
export const NOTICE_TYPES = Object.freeze(["o", "k", "p"]);
export const LOOKBACK_DAYS = 30;
export const PAGE_SIZE = 1000;

export const STATE_PAGES = Object.freeze({
  california: { code: "CA", name: "California" },
  texas: { code: "TX", name: "Texas" },
  "new-york": { code: "NY", name: "New York" },
  "north-carolina": { code: "NC", name: "North Carolina" },
  georgia: { code: "GA", name: "Georgia" },
});

const PRODUCT_DEFINITIONS = Object.freeze([
  {
    slug: "contract-to-cash-kit",
    name: "Contract-to-Cash Cleaning Business Kit",
    price: "$35",
    description: "Use the bid calculator and business workbook together, from pricing through payment tracking.",
    envKey: "PRODUCT_BUNDLE_URL",
    featured: true,
  },
  {
    slug: "bid-calculator",
    name: "Commercial Cleaning Bid Calculator",
    price: "$24",
    description: "Build a price from labor, supplies, overhead, and target margin.",
    envKey: "PRODUCT_BID_CALCULATOR_URL",
  },
  {
    slug: "business-os",
    name: "Cleaning Business OS",
    price: "$19",
    description: "Track clients, jobs, invoices, expenses, payroll, mileage, and quotes.",
    envKey: "PRODUCT_BUSINESS_OS_URL",
  },
  {
    slug: "pressure-washing-estimator",
    name: "Pressure Washing Estimator",
    price: "$16",
    description: "Price exterior work with editable rates, minimums, margin checks, and chemical mix math.",
    envKey: "PRODUCT_PRESSURE_WASHING_URL",
  },
]);

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function getConfiguredProducts(env = {}) {
  return PRODUCT_DEFINITIONS.map((product) => ({
    ...product,
    url: safeHttpsUrl(env[product.envKey]),
  })).filter((product) => product.url);
}

export function getPublicOrigin(env = {}, requestUrl = "http://localhost:8787/") {
  const configured = String(env.PUBLIC_ORIGIN || "").trim();
  for (const candidate of [configured, requestUrl]) {
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      // Try the next value.
    }
  }
  return "http://localhost:8787";
}


import {
  LOOKBACK_DAYS,
  NAICS_CODES,
  NOTICE_TYPES,
  PAGE_SIZE,
} from "./config.js";

const SAM_API_URL = "https://api.sam.gov/opportunities/v2/search";
const BROAD_NAICS_CLEANING_TERMS = /\b(janitorial|custodial|housekeeping|carpet cleaning|floor cleaning|window washing|window cleaning|pressure washing|power washing|soft wash|exterior cleaning|building washing|facade cleaning|gutter cleaning|roof cleaning|exhaust.*clean|clean.*exhaust|duct.*clean|clean.*duct|hood.*clean|clean.*hood)\b/i;

function formatSamDate(value) {
  return `${String(value.getUTCMonth() + 1).padStart(2, "0")}/${String(value.getUTCDate()).padStart(2, "0")}/${value.getUTCFullYear()}`;
}

export function isRelevantRecord(record, requestedNaics) {
  const recordNaics = String(record.naicsCode || "").trim();
  if (recordNaics !== requestedNaics) return false;
  if (recordNaics === "561720") return true;
  return BROAD_NAICS_CLEANING_TERMS.test(String(record.title || ""));
}

export function normalizeOpportunity(record) {
  const place = record.placeOfPerformance || {};
  return {
    notice_id: String(record.noticeId || "").trim(),
    title: String(record.title || "").trim(),
    agency: String(record.fullParentPathName || "").split(".")[0].trim(),
    state: String(place.state?.code || "").trim(),
    city: String(place.city?.name || "").trim(),
    naics: String(record.naicsCode || "").trim(),
    type: String(record.type || "").trim(),
    posted: String(record.postedDate || "").trim(),
    deadline: String(record.responseDeadLine || "").trim(),
    set_aside: String(record.typeOfSetAsideDescription || "").trim(),
    url: String(record.uiLink || "").trim(),
  };
}

function opportunityFingerprint(opportunity) {
  const clean = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return [
    clean(opportunity.title),
    clean(opportunity.agency),
    clean(opportunity.city),
    clean(opportunity.state),
    String(opportunity.deadline || "").slice(0, 10),
  ].join("|");
}

export function cleanOpportunities(items, today = new Date().toISOString().slice(0, 10)) {
  const noticeIds = new Set();
  const fingerprints = new Set();
  const clean = [];
  let duplicates = 0;

  for (const opportunity of items) {
    const noticeId = String(opportunity.notice_id || "").trim();
    if (!noticeId) continue;
    if (opportunity.deadline && opportunity.deadline.slice(0, 10) < today) continue;

    const fingerprint = opportunityFingerprint(opportunity);
    if (noticeIds.has(noticeId) || fingerprints.has(fingerprint)) {
      duplicates += 1;
      continue;
    }

    noticeIds.add(noticeId);
    fingerprints.add(fingerprint);
    clean.push(opportunity);
  }

  clean.sort((left, right) => (left.deadline || "9999").localeCompare(right.deadline || "9999"));
  return { items: clean, duplicates };
}

export async function refreshData(env, now = new Date(), fetchImpl = fetch) {
  if (!env.SAM_API_KEY) return { ok: false, reason: "SAM_API_KEY is not set" };
  if (!env.DATA) return { ok: false, reason: "DATA binding is not set" };

  const to = new Date(now);
  const from = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  const collected = [];
  let rejectedWrongNaics = 0;
  let rejectedOutOfScope = 0;

  for (const naics of NAICS_CODES) {
    let offset = 0;
    while (true) {
      const url = new URL(SAM_API_URL);
      url.searchParams.set("api_key", env.SAM_API_KEY);
      url.searchParams.set("ncode", naics);
      url.searchParams.set("postedFrom", formatSamDate(from));
      url.searchParams.set("postedTo", formatSamDate(to));
      url.searchParams.set("limit", String(PAGE_SIZE));
      url.searchParams.set("offset", String(offset));
      for (const type of NOTICE_TYPES) url.searchParams.append("ptype", type);

      const response = await fetchImpl(url.toString(), { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`SAM.gov ${naics} request failed (${response.status})`);

      const data = await response.json();
      const records = Array.isArray(data.opportunitiesData) ? data.opportunitiesData : [];
      for (const record of records) {
        const recordNaics = String(record.naicsCode || "").trim();
        if (recordNaics !== naics) {
          rejectedWrongNaics += 1;
          continue;
        }
        if (!isRelevantRecord(record, naics)) {
          rejectedOutOfScope += 1;
          continue;
        }
        collected.push(normalizeOpportunity(record));
      }

      offset += records.length;
      const total = Number(data.totalRecords || 0);
      if (!records.length || records.length < PAGE_SIZE || offset >= total) break;
    }
  }

  const today = now.toISOString().slice(0, 10);
  const cleaned = cleanOpportunities(collected, today);
  const payload = {
    generated: today,
    count: cleaned.items.length,
    naics: NAICS_CODES,
    rejected_wrong_naics: rejectedWrongNaics,
    rejected_out_of_scope: rejectedOutOfScope,
    duplicates_removed: cleaned.duplicates,
    items: cleaned.items,
  };

  await env.DATA.put("opps", JSON.stringify(payload));
  return {
    ok: true,
    count: cleaned.items.length,
    rejected_wrong_naics: rejectedWrongNaics,
    rejected_out_of_scope: rejectedOutOfScope,
    duplicates_removed: cleaned.duplicates,
  };
}


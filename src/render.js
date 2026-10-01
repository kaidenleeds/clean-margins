import { STATE_PAGES } from "./config.js";
import { CSS } from "./styles.js";

export const escapeHtml = (value) => String(value || "").replace(
  /[&<>"']/g,
  (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character],
);

function safeSamUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return "";
    return host === "sam.gov" || host.endsWith(".sam.gov") ? url.toString() : "";
  } catch {
    return "";
  }
}

function formatDeadline(value) {
  if (!value) return "See notice";
  const sourceDate = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) return escapeHtml(sourceDate || value);
  const date = new Date(`${sourceDate}T00:00:00Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysLeft(value, now = Date.now()) {
  if (!value) return null;
  const day = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const due = Date.parse(`${day}T23:59:59Z`);
  if (Number.isNaN(due)) return null;
  return Math.ceil((due - now) / 86_400_000);
}

function isRealSetAside(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && ![
    "none",
    "no set aside used",
    "n/a",
    "not applicable",
  ].includes(normalized);
}

function page(title, description, body, canonical, robots = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#1f3864">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="icon" href="/favicon.png" type="image/png" sizes="64x64">
<link rel="shortcut icon" href="/favicon.ico" type="image/png">
${robots ? `<meta name="robots" content="${escapeHtml(robots)}">` : ""}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Clean Margins">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta name="twitter:card" content="summary">
<meta property="og:url" content="${escapeHtml(canonical)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<style>${CSS}</style></head><body>${body}</body></html>`;
}

function header(title, intro, links = []) {
  const nav = links.map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join("");
  return `<a class="skip-link" href="#main">Skip to content</a>
<header><div class="wrap"><div class="header-row"><a class="brand" href="/">Clean Margins</a><nav aria-label="Primary">${nav}</nav></div>
<h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p></div></header>`;
}

function footer() {
  return `<footer>Data comes from the <a href="https://sam.gov" rel="noopener">SAM.gov</a> public API. Verify each notice before bidding. <a href="/about">About and methodology</a>. <a href="/privacy">Privacy</a>.<br>&copy; ${new Date().getFullYear()} Clean Margins</footer>`;
}

function renderProducts(products) {
  if (!products.length) return "";
  const cards = products.map((product) => `<article class="product${product.featured ? " featured" : ""}">
<h3>${escapeHtml(product.name)} (${escapeHtml(product.price)})</h3>
<p>${escapeHtml(product.description)}</p>
<a href="/go/${escapeHtml(product.slug)}" rel="sponsored nofollow">Open tool</a>
</article>`).join("");
  return `<section class="tools" id="tools"><h2>Tools for pricing and running cleaning jobs</h2><p>Editable Excel workbooks sold as one-time downloads.</p><div class="product-grid">${cards}</div></section>`;
}

function renderNewsletter(signupStatus, enabled) {
  if (!enabled) return "";
  const message = signupStatus === "success"
    ? `<div class="note" role="status" aria-live="polite">Check your inbox to confirm your subscription.</div>`
    : signupStatus === "error"
      ? `<div class="note error" role="alert">The signup did not go through. Try again in a moment.</div>`
      : "";
  return `${message}<div class="cta"><div class="t"><b>Get contract updates by email</b><div>New opportunities and practical bidding notes from Clean Margins.</div></div>
<form method="POST" action="/subscribe"><label class="sr-only" for="newsletter-email">Business email</label><input id="newsletter-email" type="email" name="email" autocomplete="email" placeholder="you@example.com" maxlength="254" required><label class="trap" aria-hidden="true">Website<input type="text" name="company_website" tabindex="-1" autocomplete="off"></label><button type="submit">Subscribe</button></form></div>`;
}

function renderStateLinks() {
  return Object.entries(STATE_PAGES).map(([slug, state]) => (
    `<a href="/cleaning-contracts/${escapeHtml(slug)}">${escapeHtml(state.name)}</a>`
  )).join("");
}

function renderRows(items) {
  return items.map((opportunity) => {
    const days = daysLeft(opportunity.deadline);
    const dayText = days === null
      ? ""
      : days < 0
        ? "Deadline passed"
        : days === 0
          ? "Due today"
          : days === 1
            ? "1 day left"
            : `${days} days left`;
    const deadlineStatus = dayText
      ? `<div class="${days !== null && days <= 7 ? "soon" : "ok-days"}">${dayText}</div>`
      : "";
    const setAside = isRealSetAside(opportunity.set_aside);
    const rawCity = String(opportunity.city || "").trim();
    const city = rawCity === "0" ? "" : rawCity;
    const location = [city, opportunity.state].filter(Boolean).join(", ");
    const url = safeSamUrl(opportunity.url);
    const title = url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(opportunity.title)}</a>`
      : `<span>${escapeHtml(opportunity.title)}</span>`;
    const searchText = [
      opportunity.title,
      opportunity.agency,
      opportunity.type,
      city,
      opportunity.state,
      opportunity.naics,
      opportunity.set_aside,
    ].join(" ").replace(/\s+/g, " ").trim().toLowerCase();

    return `<tr data-search="${escapeHtml(searchText)}" data-days="${days === null ? "" : days}" data-set-aside="${setAside ? "1" : "0"}">
<td>${title}<div class="meta">${escapeHtml(opportunity.agency)}${opportunity.type ? ". " + escapeHtml(opportunity.type) : ""}</div>${setAside ? `<span class="badge">${escapeHtml(opportunity.set_aside)}</span>` : ""}</td>
<td>${escapeHtml(location || "See notice")}</td><td>${escapeHtml(opportunity.naics)}</td>
<td><time datetime="${escapeHtml(opportunity.deadline)}">${formatDeadline(opportunity.deadline)}</time>${deadlineStatus}</td></tr>`;
  }).join("");
}

export function renderHome(data, filters, options) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const hasLoadedData = Boolean(data && Array.isArray(data.items));
  const stateFilter = filters.state || "";
  const query = String(filters.q || "").trim().toLowerCase();
  const deadlineFilter = Number(filters.deadline || 0);
  const setAsideOnly = Boolean(filters.setAside);
  const states = [...new Set(items.map((item) => item.state).filter(Boolean))].sort();

  let shown = stateFilter ? items.filter((item) => item.state === stateFilter) : items;
  if (query) {
    shown = shown.filter((item) => [
      item.title,
      item.agency,
      item.type,
      item.city,
      item.state,
      item.naics,
      item.set_aside,
    ].join(" ").toLowerCase().includes(query));
  }
  if (deadlineFilter) {
    shown = shown.filter((item) => {
      const days = daysLeft(item.deadline);
      return days !== null && days >= 0 && days <= deadlineFilter;
    });
  }
  if (setAsideOnly) shown = shown.filter((item) => isRealSetAside(item.set_aside));

  const rendered = shown.slice(0, 500);
  const statePage = options.statePage;
  const heading = statePage
    ? `${statePage.name} government cleaning contracts`
    : "Open government cleaning contracts";
  const intro = statePage
    ? `Current janitorial, custodial, and exterior-cleaning notices for ${statePage.name}, refreshed from SAM.gov.`
    : "Search current janitorial, custodial, and exterior-cleaning notices from SAM.gov. The board refreshes daily.";
  const canonical = statePage
    ? `${options.publicOrigin}/cleaning-contracts/${statePage.slug}`
    : `${options.publicOrigin}/`;
  const hasQueryFilters = Boolean(
    query || deadlineFilter || setAsideOnly || options.signupStatus || (!statePage && stateFilter),
  );
  const resultCount = shown.length > rendered.length
    ? `Showing ${rendered.length} of ${shown.length}${stateFilter ? ` in ${stateFilter}` : ""}`
    : `${shown.length} shown${stateFilter ? ` in ${stateFilter}` : ""}`;
  const resetUrl = statePage ? `/cleaning-contracts/${statePage.slug}` : "/";
  const rows = renderRows(rendered);
  const products = renderProducts(options.products);
  const newsletter = renderNewsletter(options.signupStatus, options.newsletterEnabled);

  const stateIntro = statePage
    ? `<section class="state-intro"><h2>Cleaning bids in ${escapeHtml(statePage.name)}</h2><p>This page shows national notices with a place of performance in ${escapeHtml(statePage.name)}. Open the official notice to confirm the location, eligibility, scope, and deadline.</p></section>`
    : "";
  const table = hasLoadedData && shown.length
    ? `<div class="table-wrap" tabindex="0" aria-label="Scrollable opportunity results"><table id="opportunities-table"><caption>Open government cleaning contract opportunities</caption><thead><tr><th scope="col">Opportunity</th><th scope="col">Location</th><th scope="col">NAICS</th><th scope="col">Deadline</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : hasLoadedData
      ? `<div class="empty"><b>${hasQueryFilters ? "No matching opportunities" : "No open opportunities right now"}</b><p>${hasQueryFilters ? "Try a broader search, extend the deadline, or clear a filter." : "The board checks SAM.gov daily for new notices."}</p>${hasQueryFilters ? `<a href="${escapeHtml(resetUrl)}">Show all contracts</a>` : ""}</div>`
      : `<div class="empty"><b>Contract data is loading.</b><p>The board will fill in after the first data refresh.</p></div>`;

  const body = `${header(heading, intro, [
    { href: "#opportunities", label: "Find contracts" },
    ...(options.products.length ? [{ href: "#tools", label: "Pricing tools" }] : []),
    { href: "/about", label: "About" },
  ])}
<div class="bar"><div class="wrap">Updated <b>${escapeHtml(data?.generated || "Pending")}</b>. <b>${items.length}</b> open opportunities. NAICS 561720 and 561790.</div></div>
<main id="main" class="wrap">${newsletter}${stateIntro}
<section class="board" id="opportunities" aria-labelledby="opportunities-heading"><div class="board-head"><div><h2 id="opportunities-heading">Search open opportunities</h2><p>Filter by service, agency, location, deadline, or eligibility.</p></div><span class="count" aria-live="polite">${escapeHtml(resultCount)}</span></div>
<form class="search-panel" method="GET" action="/" role="search"><div class="filter-grid">
<label class="filter" for="opportunity-search"><span>Search opportunities</span><input id="opportunity-search" type="search" name="q" value="${escapeHtml(filters.q)}" placeholder="Try janitorial, window washing, agency, or city"></label>
<label class="filter" for="state-filter"><span>State</span><select id="state-filter" name="state"><option value="">All states</option>${states.map((state) => `<option value="${escapeHtml(state)}"${state === stateFilter ? " selected" : ""}>${escapeHtml(state)}</option>`).join("")}</select></label>
<label class="filter" for="deadline-filter"><span>Deadline</span><select id="deadline-filter" name="deadline"><option value="">Any deadline</option><option value="7"${deadlineFilter === 7 ? " selected" : ""}>Next 7 days</option><option value="14"${deadlineFilter === 14 ? " selected" : ""}>Next 14 days</option><option value="30"${deadlineFilter === 30 ? " selected" : ""}>Next 30 days</option></select></label>
<label class="check-filter" for="set-aside-filter"><input id="set-aside-filter" type="checkbox" name="set_aside" value="1"${setAsideOnly ? " checked" : ""}>Set-aside only</label>
<button class="search-button" type="submit">Search</button><a class="clear-button" href="${escapeHtml(resetUrl)}">Clear filters</a></div>
<p class="search-help">Search covers titles, agencies, services, locations, NAICS codes, and set-aside descriptions.</p></form>
<div class="state-links"><b>State pages:</b> ${renderStateLinks()}</div>${table}</section>
<section class="how" aria-labelledby="how-heading"><h2 id="how-heading">How to use the board</h2><div class="how-grid"><article class="how-card"><b>1. Find a fit</b><p>Search by service or location. Narrow the list by deadline and set-aside.</p></article><article class="how-card"><b>2. Read the notice</b><p>Check the scope, attachments, amendments, site visits, and submission rules.</p></article><article class="how-card"><b>3. Price the work</b><p>Include labor, supplies, travel, overhead, and margin before bidding.</p></article></div></section>
${products}${footer()}</main>
<script>fetch("/event",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({event:${JSON.stringify(statePage ? `page_view_state_${statePage.code.toLowerCase()}` : "page_view_home")}}),keepalive:true}).catch(()=>{});</script>`;

  return page(
    statePage ? `${statePage.name} Government Cleaning Contracts | Clean Margins` : "Government Cleaning Contracts | Clean Margins",
    statePage
      ? `Open government janitorial and exterior-cleaning notices for ${statePage.name}, refreshed from SAM.gov.`
      : "Search open government janitorial, custodial, and exterior-cleaning notices from SAM.gov.",
    body,
    canonical,
    hasQueryFilters ? "noindex,follow" : "",
  );
}

export function renderAboutPage(publicOrigin) {
  const body = `${header(
    "About Clean Margins",
    "A free starting point for cleaning businesses that want to review public work.",
    [
      { href: "/#opportunities", label: "Find contracts" },
      { href: "/privacy", label: "Privacy" },
    ],
  )}<main id="main" class="wrap"><article class="page-card"><h2>What the board covers</h2><p>Clean Margins organizes open U.S. government janitorial, custodial, window-washing, pressure-washing, and related cleaning notices in one searchable list.</p>
<h2>How the data works</h2><ul><li><b>Source:</b> the official SAM.gov opportunities API.</li><li><b>Coverage:</b> NAICS 561720 plus cleaning-related notices from NAICS 561790.</li><li><b>Refresh:</b> the board checks daily and removes deadlines that have passed.</li><li><b>Cleanup:</b> records are normalized, checked for scope, and deduplicated before display.</li></ul>
<h2>What to verify</h2><p>The official notice controls. Confirm the scope, amendments, deadline, place of performance, eligibility, insurance, site visits, submission instructions, and attachments before bidding.</p></article>${footer()}</main>`;
  return page(
    "About Clean Margins",
    "How Clean Margins collects and checks public government cleaning notices.",
    body,
    `${publicOrigin}/about`,
  );
}

export function renderPrivacyPage(publicOrigin) {
  const body = `${header(
    "Privacy",
    "What the site collects and where the data goes.",
    [
      { href: "/#opportunities", label: "Find contracts" },
      { href: "/about", label: "About" },
    ],
  )}<main id="main" class="wrap"><article class="page-card"><h2>Newsletter signups</h2><p>If you submit an email address, the site sends it to Beehiiv to manage the Clean Margins newsletter. Email addresses do not appear on the contracts board. Every newsletter includes an unsubscribe link.</p>
<h2>Site measurement</h2><p>The site stores daily totals for page views, signup outcomes, and product-link clicks. It does not create a public account or profile.</p>
<h2>External links</h2><p>Contract links open SAM.gov. Product links may open a separate store. Those services have their own privacy policies.</p>
<h2>Cookies</h2><p>The contracts board does not set advertising cookies.</p></article>${footer()}</main>`;
  return page(
    "Privacy | Clean Margins",
    "Privacy details for newsletter signups, site measurement, and external links.",
    body,
    `${publicOrigin}/privacy`,
  );
}

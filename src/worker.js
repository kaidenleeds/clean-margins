import {
  getConfiguredProducts,
  getPublicOrigin,
  STATE_PAGES,
} from "./config.js";
import { refreshData } from "./data.js";
import {
  renderAboutPage,
  renderHome,
  renderPrivacyPage,
} from "./render.js";
import { FAVICON_BASE64 } from "./favicon.js";

const FAVICON_BYTES = Uint8Array.from(
  atob(FAVICON_BASE64),
  (character) => character.charCodeAt(0),
);

const SECURITY_HEADERS = Object.freeze({
  "content-security-policy": "default-src 'none'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'",
  "permissions-policy": "camera=(), geolocation=(), microphone=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
});

function response(body, options = {}) {
  const headers = new Headers(options.headers || {});
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(body, { ...options, headers });
}

function htmlResponse(html, cacheControl = "public, max-age=900") {
  return response(html, {
    headers: {
      "cache-control": cacheControl,
      "content-type": "text/html;charset=utf-8",
    },
  });
}

function redirect(requestUrl, path, status = 302) {
  const location = new URL(path, requestUrl).toString();
  return response(null, { status, headers: { location } });
}

function metricKey(date = new Date()) {
  return `metrics:${date.toISOString().slice(0, 10)}`;
}

export async function trackEvent(env, event) {
  if (!env.DATA || !/^[a-z0-9_]{1,64}$/.test(event)) return;
  let metrics;
  try {
    metrics = (await env.DATA.get(metricKey(), "json")) || {};
  } catch {
    metrics = {};
  }
  metrics[event] = Number(metrics[event] || 0) + 1;
  await env.DATA.put(metricKey(), JSON.stringify(metrics), { expirationTtl: 15_552_000 });
}

async function readMetrics(env, days = 30) {
  const result = {};
  for (let index = 0; index < days; index += 1) {
    const date = new Date(Date.now() - index * 86_400_000);
    const key = metricKey(date);
    let metrics;
    try {
      metrics = (await env.DATA.get(key, "json")) || {};
    } catch {
      metrics = {};
    }
    result[key.slice(8)] = metrics;
  }
  return result;
}

function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function isValidEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isAdmin(request, env) {
  if (!env.ADMIN_KEY) return false;
  return request.headers.get("authorization") === `Bearer ${env.ADMIN_KEY}`;
}

export async function handleSubscribe(request, env, fetchImpl = fetch) {
  if (!isSameOrigin(request)) return response("Forbidden", { status: 403 });

  let form;
  try {
    form = await request.formData();
  } catch {
    return redirect(request.url, "/?signup=error");
  }

  const honeypot = String(form.get("company_website") || "").trim();
  if (honeypot) return redirect(request.url, "/?signup=success");

  const email = String(form.get("email") || "").trim();
  if (!isValidEmail(email)) return redirect(request.url, "/?signup=error");
  if (!env.BEEHIIV_API_KEY || !env.BEEHIIV_PUBLICATION_ID) {
    await trackEvent(env, "signup_error");
    return redirect(request.url, "/?signup=error");
  }

  try {
    const apiResponse = await fetchImpl(
      `https://api.beehiiv.com/v2/publications/${encodeURIComponent(env.BEEHIIV_PUBLICATION_ID)}/subscriptions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.BEEHIIV_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          reactivate_existing: true,
          utm_source: "clean-margins",
        }),
      },
    );
    if (!apiResponse.ok) throw new Error(`Beehiiv returned ${apiResponse.status}`);
    await trackEvent(env, "signup_success");
    return redirect(request.url, "/?signup=success");
  } catch {
    await trackEvent(env, "signup_error");
    return redirect(request.url, "/?signup=error");
  }
}

function sitemap(publicOrigin) {
  const stateUrls = Object.keys(STATE_PAGES).map(
    (slug) => `<url><loc>${publicOrigin}/cleaning-contracts/${slug}</loc></url>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${publicOrigin}/</loc></url><url><loc>${publicOrigin}/about</loc></url><url><loc>${publicOrigin}/privacy</loc></url>${stateUrls}</urlset>`;
}

async function loadBoardData(env) {
  if (!env.DATA) return null;
  try {
    return await env.DATA.get("opps", "json");
  } catch {
    return null;
  }
}

function startRefreshIfNeeded(data, env, context) {
  if (!env.DATA || !env.SAM_API_KEY || !context?.waitUntil) return;
  const today = new Date().toISOString().slice(0, 10);
  if (data && data.generated >= today) return;

  context.waitUntil((async () => {
    const lock = await env.DATA.get("refresh_lock");
    if (lock) return;
    await env.DATA.put("refresh_lock", "1", { expirationTtl: 600 });
    try {
      await refreshData(env);
    } finally {
      if (typeof env.DATA.delete === "function") await env.DATA.delete("refresh_lock");
    }
  })());
}

const worker = {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    const path = url.pathname;
    const publicOrigin = getPublicOrigin(env, request.url);
    const products = getConfiguredProducts(env);

    if (path === "/favicon.png" || path === "/favicon.ico") {
      if (!["GET", "HEAD"].includes(request.method)) {
        return response("Method not allowed", { status: 405 });
      }
      return response(request.method === "HEAD" ? null : FAVICON_BYTES, {
        headers: {
          "cache-control": "public, max-age=604800, immutable",
          "content-type": "image/png",
        },
      });
    }

    if (path === "/subscribe") {
      if (request.method !== "POST") return response("Method not allowed", { status: 405 });
      return handleSubscribe(request, env);
    }

    if (path === "/event") {
      if (request.method !== "POST") return response("Method not allowed", { status: 405 });
      if (!isSameOrigin(request)) return response("Forbidden", { status: 403 });
      let event;
      try {
        event = String((await request.json()).event || "");
      } catch {
        event = "";
      }
      if (event === "page_view_home" || /^page_view_state_(ca|tx|ny|nc|ga)$/.test(event)) {
        await trackEvent(env, event);
      }
      return response(null, { status: 204 });
    }

    if (path.startsWith("/go/")) {
      const slug = path.slice(4);
      const product = products.find((item) => item.slug === slug);
      if (!product) return response("Not found", { status: 404 });
      await trackEvent(env, `product_click_${slug.replaceAll("-", "_")}`);
      return response(null, { status: 302, headers: { location: product.url } });
    }

    if (path === "/robots.txt") {
      const text = `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /event\nDisallow: /go/\nDisallow: /subscribe\nSitemap: ${publicOrigin}/sitemap.xml`;
      return response(text, { headers: { "content-type": "text/plain;charset=utf-8" } });
    }

    if (path === "/sitemap.xml") {
      return response(sitemap(publicOrigin), {
        headers: { "content-type": "application/xml;charset=utf-8" },
      });
    }

    if (path === "/about") return htmlResponse(renderAboutPage(publicOrigin));
    if (path === "/privacy") return htmlResponse(renderPrivacyPage(publicOrigin));

    if (path === "/admin/refresh") {
      if (request.method !== "POST") return response("Method not allowed", { status: 405 });
      if (!isAdmin(request, env)) return response("Forbidden", { status: 403 });
      const result = await refreshData(env);
      return response(JSON.stringify(result), {
        headers: { "cache-control": "no-store", "content-type": "application/json" },
      });
    }

    if (path === "/admin/metrics") {
      if (!isAdmin(request, env)) return response("Forbidden", { status: 403 });
      const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days") || 30)));
      const metrics = await readMetrics(env, days);
      return response(JSON.stringify(metrics), {
        headers: { "cache-control": "no-store", "content-type": "application/json" },
      });
    }

    /** @type {{code: string, name: string, slug: string} | null} */
    let statePage = null;
    if (path.startsWith("/cleaning-contracts/")) {
      const slug = path.slice("/cleaning-contracts/".length).replace(/\/$/, "");
      const state = STATE_PAGES[slug];
      if (!state) return response("Not found", { status: 404 });
      statePage = { ...state, slug };
    } else if (path !== "/") {
      return response("Not found", { status: 404 });
    }

    const data = await loadBoardData(env);
    startRefreshIfNeeded(data, env, context);

    const requestedState = statePage ? statePage.code : String(url.searchParams.get("state") || "").toUpperCase();
    const state = /^[A-Z0-9-]{1,8}$/.test(requestedState) ? requestedState : "";
    const query = String(url.searchParams.get("q") || "").trim().slice(0, 120);
    const requestedDeadline = String(url.searchParams.get("deadline") || "");
    const deadline = ["7", "14", "30"].includes(requestedDeadline) ? requestedDeadline : "";
    const setAside = url.searchParams.get("set_aside") === "1";
    const signupParam = url.searchParams.get("signup");
    const signupStatus = signupParam && ["success", "error"].includes(signupParam)
      ? signupParam
      : "";
    const html = renderHome(
      data,
      { state, q: query, deadline, setAside },
      {
        newsletterEnabled: Boolean(env.BEEHIIV_API_KEY && env.BEEHIIV_PUBLICATION_ID),
        products,
        publicOrigin,
        signupStatus,
        statePage,
      },
    );
    return htmlResponse(html, signupStatus ? "private, no-store" : "public, max-age=900");
  },

  async scheduled(_event, env, context) {
    context.waitUntil(refreshData(env));
  },
};

export default worker;

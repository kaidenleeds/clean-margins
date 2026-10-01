import assert from "node:assert/strict";
import { test } from "node:test";

import worker, { handleSubscribe } from "../src/worker.js";
import { refreshData } from "../src/data.js";

function boardItem(noticeId, state, title = `Opportunity ${noticeId}`) {
  return {
    notice_id: noticeId,
    title,
    agency: "AGENCY",
    state,
    city: "Test City",
    naics: "561720",
    type: "Solicitation",
    posted: "2026-09-20",
    deadline: "2099-08-01T17:00:00-05:00",
    set_aside: "",
    url: `https://sam.gov/opp/${noticeId}`,
  };
}

function memoryKv(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [
    key,
    typeof value === "string" ? value : JSON.stringify(value),
  ]));
  return {
    values,
    async get(key, type) {
      const value = values.get(key);
      if (value === undefined) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) {
      values.set(key, String(value));
    },
    async delete(key) {
      values.delete(key);
    },
  };
}

function boardEnv(items = [], overrides = {}) {
  const data = {
    generated: "2099-01-01",
    count: items.length,
    items,
  };
  return {
    DATA: memoryKv({ opps: data }),
    PUBLIC_ORIGIN: "https://example.com",
    ...overrides,
  };
}

async function requestWorker(path, options = {}) {
  const {
    method = "GET",
    body,
    env = boardEnv(),
    headers = {},
  } = options;
  const request = new Request(`https://example.com${path}`, {
    method,
    body,
    headers,
  });
  const pending = [];
  const response = await worker.fetch(request, env, {
    waitUntil(promise) {
      pending.push(promise);
    },
  });
  await Promise.all(pending);
  return response;
}

function samRecord(noticeId, naics, title) {
  return {
    noticeId,
    title,
    fullParentPathName: "AGENCY.OFFICE",
    naicsCode: naics,
    type: "Solicitation",
    postedDate: "2026-09-20",
    responseDeadLine: "2099-08-01T17:00:00-05:00",
    uiLink: `https://sam.gov/opp/${noticeId}`,
    placeOfPerformance: {
      state: { code: "CO" },
      city: { name: "Denver" },
    },
  };
}

test("refresh rejects unrelated records and removes duplicate listings", async () => {
  const fetchImpl = async (rawUrl) => {
    const url = new URL(rawUrl);
    const naics = url.searchParams.get("ncode");
    const records = naics === "561720"
      ? [
        samRecord("jan-1", "561720", "Office janitorial services"),
        samRecord("jan-2", "561720", "Office janitorial services"),
        samRecord("wrong", "999999", "Wrong classification"),
      ]
      : [
        samRecord("windows", "561790", "Exterior window washing"),
        samRecord("snow", "561790", "Snow and ice removal"),
      ];
    return new Response(JSON.stringify({
      totalRecords: records.length,
      opportunitiesData: records,
    }));
  };
  const env = { SAM_API_KEY: "test-key", DATA: memoryKv() };

  const result = await refreshData(env, new Date("2026-10-01T12:00:00Z"), fetchImpl);
  const stored = await env.DATA.get("opps", "json");

  assert.equal(result.count, 2);
  assert.equal(result.duplicates_removed, 1);
  assert.equal(result.rejected_wrong_naics, 1);
  assert.equal(result.rejected_out_of_scope, 1);
  assert.deepEqual(stored.items.map((item) => item.notice_id), ["jan-1", "windows"]);
});

test("refresh keeps the previous snapshot when SAM returns an error", async () => {
  const env = { SAM_API_KEY: "test-key", DATA: memoryKv({ opps: { count: 1 } }) };
  const previous = await env.DATA.get("opps", "json");

  await assert.rejects(
    refreshData(
      env,
      new Date("2026-10-01T12:00:00Z"),
      async () => new Response("failure", { status: 500 }),
    ),
    /SAM\.gov 561720 request failed \(500\)/,
  );

  assert.deepEqual(await env.DATA.get("opps", "json"), previous);
});

test("state pages show only the selected state", async () => {
  const env = boardEnv([
    boardItem("match", "CA", "California match"),
    boardItem("other", "TX", "Texas record"),
  ]);
  const response = await requestWorker("/cleaning-contracts/california", { env });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.ok(html.includes("California match"));
  assert.ok(!html.includes("Texas record"));
  assert.ok(html.includes('<link rel="canonical" href="https://example.com/cleaning-contracts/california">'));
});

test("search filters compose and filtered pages remain out of search indexes", async () => {
  const soon = new Date(Date.now() + 5 * 86_400_000).toISOString();
  const later = new Date(Date.now() + 20 * 86_400_000).toISOString();
  const matching = {
    ...boardItem("match", "TX", "Hospital janitorial services"),
    deadline: soon,
    set_aside: "Small Business",
  };
  const tooLate = {
    ...boardItem("late", "TX", "Hospital window cleaning"),
    deadline: later,
    set_aside: "Small Business",
  };
  const response = await requestWorker(
    "/?q=hospital&state=TX&deadline=7&set_aside=1",
    { env: boardEnv([matching, tooLate]) },
  );
  const html = await response.text();

  assert.ok(html.includes("Hospital janitorial services"));
  assert.ok(!html.includes("Hospital window cleaning"));
  assert.ok(html.includes('<meta name="robots" content="noindex,follow">'));
  assert.ok(html.includes('name="set_aside" value="1" checked'));
});

test("product redirects use configured HTTPS destinations", async () => {
  const env = boardEnv([], {
    PRODUCT_BID_CALCULATOR_URL: "https://store.example.com/bid-calculator",
  });
  const response = await requestWorker("/go/bid-calculator", { env });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://store.example.com/bid-calculator");
  assert.equal((await requestWorker("/go/business-os", { env })).status, 404);
});

test("subscriptions succeed only after Beehiiv accepts the request", async () => {
  const calls = [];
  const env = boardEnv([], {
    BEEHIIV_API_KEY: "test-key", // pragma: allowlist secret
    BEEHIIV_PUBLICATION_ID: "test-publication",
  });
  const request = new Request("https://example.com/subscribe", {
    method: "POST",
    headers: { origin: "https://example.com" },
    body: new URLSearchParams({ email: "person@example.com" }),
  });
  const response = await handleSubscribe(request, env, async (url, init) => {
    calls.push({ url, init });
    return new Response("{}", { status: 201 });
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://example.com/?signup=success");
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].init.body).email, "person@example.com");
});

test("subscription validation blocks bad input and cross-site posts", async () => {
  const env = boardEnv([], {
    BEEHIIV_API_KEY: "test-key", // pragma: allowlist secret
    BEEHIIV_PUBLICATION_ID: "test-publication",
  });
  const invalid = await handleSubscribe(
    new Request("https://example.com/subscribe", {
      method: "POST",
      body: new URLSearchParams({ email: "not-an-email" }),
    }),
    env,
  );
  const crossSite = await handleSubscribe(
    new Request("https://example.com/subscribe", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
      body: new URLSearchParams({ email: "person@example.com" }),
    }),
    env,
  );

  assert.equal(invalid.headers.get("location"), "https://example.com/?signup=error");
  assert.equal(crossSite.status, 403);
});

test("admin routes require a bearer token and ignore query-string keys", async () => {
  const env = boardEnv([], { ADMIN_KEY: "test-admin-key" }); // pragma: allowlist secret
  const queryKey = await requestWorker("/admin/metrics?key=test-admin-key", { env });
  const bearer = await requestWorker("/admin/metrics", {
    env,
    headers: { authorization: "Bearer test-admin-key" },
  });

  assert.equal(queryKey.status, 403);
  assert.equal(bearer.status, 200);
  assert.equal(bearer.headers.get("cache-control"), "no-store");
});

test("HTML responses include security headers and accessible landmarks", async () => {
  const response = await requestWorker("/", {
    env: boardEnv([boardItem("one", "CO", "Office janitorial services")]),
  });
  const html = await response.text();
  const contentSecurityPolicy = response.headers.get("content-security-policy");

  assert.equal(response.status, 200);
  assert.ok(contentSecurityPolicy?.includes("frame-ancestors 'none'"));
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.ok(html.includes('class="skip-link"'));
  assert.ok(html.includes('<main id="main"'));
  assert.ok(html.includes('role="search"'));
  assert.ok(html.includes('<link rel="icon" href="/favicon.png"'));
  assert.ok(html.includes("Open government cleaning contract opportunities"));
});

test("robots, sitemap, and unknown routes return the expected responses", async () => {
  const robots = await requestWorker("/robots.txt");
  const sitemap = await requestWorker("/sitemap.xml");
  const favicon = await requestWorker("/favicon.png");
  const missing = await requestWorker("/missing-page");

  assert.ok((await robots.text()).includes("Disallow: /admin/"));
  assert.ok((await sitemap.text()).includes("/cleaning-contracts/california"));
  assert.equal(favicon.status, 200);
  assert.equal(favicon.headers.get("content-type"), "image/png");
  assert.ok((await favicon.arrayBuffer()).byteLength > 1000);
  assert.equal(missing.status, 404);
});

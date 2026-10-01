import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import worker from "../src/worker.js";

const sample = JSON.parse(
  await readFile(new URL("../examples/opportunities.sample.json", import.meta.url), "utf8"),
);

const values = new Map([["opps", JSON.stringify(sample)]]);
const env = {
  DATA: {
    async get(key, type) {
      const value = values.get(key);
      if (value === undefined) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) {
      values.set(key, String(value));
    },
  },
  PUBLIC_ORIGIN: "http://localhost:8787",
};
const context = { waitUntil: () => {} };

const home = await worker.fetch(new Request("http://localhost:8787/"), env, context);
const homeHtml = await home.text();
assert.equal(home.status, 200);
assert.ok(homeHtml.includes("Open government cleaning contracts"));
assert.ok(homeHtml.includes("Janitorial services for a federal office"));
assert.ok(homeHtml.includes('<link rel="icon" href="/favicon.png"'));
assert.equal(home.headers.get("x-content-type-options"), "nosniff");

const favicon = await worker.fetch(
  new Request("http://localhost:8787/favicon.png"),
  env,
  context,
);
assert.equal(favicon.status, 200);
assert.equal(favicon.headers.get("content-type"), "image/png");
assert.ok((await favicon.arrayBuffer()).byteLength > 1000);

const filtered = await worker.fetch(
  new Request("http://localhost:8787/?state=CO"),
  env,
  context,
);
const filteredHtml = await filtered.text();
assert.ok(filteredHtml.includes("Janitorial services for a federal office"));
assert.ok(!filteredHtml.includes("Exterior window washing"));

const about = await worker.fetch(
  new Request("http://localhost:8787/about"),
  env,
  context,
);
assert.equal(about.status, 200);
assert.ok((await about.text()).includes("What the board covers"));

const event = await worker.fetch(
  new Request("http://localhost:8787/event", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:8787",
    },
    body: JSON.stringify({ event: "page_view_home" }),
  }),
  env,
  context,
);
assert.equal(event.status, 204);

console.log("Smoke test passed");

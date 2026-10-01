import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

import worker from "../src/worker.js";

const port = Number(process.env.PORT || 8787);
const sample = JSON.parse(
  await readFile(new URL("../examples/opportunities.sample.json", import.meta.url), "utf8"),
);

const today = new Date();
sample.generated = today.toISOString().slice(0, 10);
sample.items = sample.items.map((item, index) => ({
  ...item,
  posted: today.toISOString().slice(0, 10),
  deadline: new Date(today.getTime() + (index + 1) * 7 * 86_400_000).toISOString(),
}));

function memoryKv(initial) {
  const values = new Map([["opps", JSON.stringify(initial)]]);
  return {
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

const env = {
  ...process.env,
  DATA: memoryKv(sample),
  PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN || `http://localhost:${port}`,
};

const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const method = incoming.method || "GET";
    const requestHeaders = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) requestHeaders.append(name, item);
      } else if (value !== undefined) {
        requestHeaders.set(name, value);
      }
    }
    const request = new Request(`http://localhost:${port}${incoming.url || "/"}`, {
      method,
      headers: requestHeaders,
      body: ["GET", "HEAD"].includes(method) ? undefined : body,
    });
    const response = await worker.fetch(request, env, {
      waitUntil(promise) {
        promise.catch((error) => console.error(error));
      },
    });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500, { "content-type": "text/plain;charset=utf-8" });
    outgoing.end("Local server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Clean Margins is running at http://localhost:${port}`);
});

import { getStore } from "@netlify/blobs";

const MAX = { listening: 202, speaking: 202, writing: 80, reading: 167, vocab: 190 };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const json = (d, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function clean(o) {
  const out = {};
  for (const k of Object.keys(MAX)) {
    const src = o && typeof o[k] === "object" && o[k] ? o[k] : {};
    out[k] = {};
    for (const [i, d] of Object.entries(src)) {
      const n = Number(i);
      if (Number.isInteger(n) && n >= 0 && n < MAX[k] && typeof d === "string" && DATE.test(d)) {
        out[k][n] = d;
      }
    }
  }
  return out;
}

export default async (req) => {
  const secret = process.env.TRACKER_KEY;
  if (!secret) return new Response("TRACKER_KEY Netlify'da o'rnatilmagan", { status: 500 });
  if (req.headers.get("x-tracker-key") !== secret) return new Response("unauthorized", { status: 401 });

  const store = getStore({ name: "tracker", consistency: "strong" });
  const cur = clean(await store.get("state", { type: "json" }));

  if (req.method === "GET") return json(cur);

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  if (req.method === "PUT") {
    const s = clean(body && body.state);
    await store.setJSON("state", s);
    return json(s);
  }

  if (req.method === "POST") {
    const ops = Array.isArray(body && body.ops) ? body.ops : [];
    for (const op of ops) {
      if (!op || !Object.hasOwn(MAX, op.k)) continue;
      const n = Number(op.i);
      if (!Number.isInteger(n) || n < 0 || n >= MAX[op.k]) continue;
      if (op.d === null) delete cur[op.k][n];
      else if (typeof op.d === "string" && DATE.test(op.d)) cur[op.k][n] = op.d;
    }
    if (ops.length) await store.setJSON("state", cur);
    return json(cur);
  }

  return new Response("method not allowed", { status: 405 });
};

export const config = { path: "/api/data" };

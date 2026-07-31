import { getStore } from "@netlify/blobs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });

const rnd = (n) => {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  for (let i = 0; i < n; i++) out += chars[buf[i] % chars.length];
  return out;
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return json({ error: "bad json" }, 400);
  }
  const store = getStore("sketchship");
  const { action } = body;

  if (action === "create") {
    if (!body.st) return json({ error: "missing state" }, 400);
    const id = rnd(5);
    const rec = { t1: rnd(10), t2: rnd(10), st: body.st, created: Date.now() };
    await store.setJSON(id, rec);
    return json({ id, t1: rec.t1, t2: rec.t2 });
  }

  if (action === "get" || action === "save") {
    const rec = await store.get(body.id, { type: "json" });
    if (!rec) return json({ error: "not found" }, 404);
    const you = body.k === rec.t1 ? "p1" : body.k === rec.t2 ? "p2" : null;
    if (!you) return json({ error: "bad key" }, 403);

    if (action === "get") {
      return json({ st: rec.st, you, keys: { p1: rec.t1, p2: rec.t2 } });
    }

    // save
    if (!body.st) return json({ error: "missing state" }, 400);
    if (body.prevMv !== rec.st.mv) {
      // someone else saved first — hand back the truth
      return json({ error: "stale", st: rec.st }, 409);
    }
    rec.st = body.st;
    await store.setJSON(body.id, rec);
    return json({ ok: true, st: rec.st });
  }

  return json({ error: "unknown action" }, 400);
};

export const config = { path: "/api/game" };

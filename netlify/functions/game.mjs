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

// Which seat does this device own? Claims the empty second seat when allowed.
// Returns { you } or { err }.
function seat(rec, pid, allowClaim) {
  if (!pid) return { err: json({ error: "missing player id" }, 400) };
  if (rec.p1 === pid) return { you: "p1" };
  if (rec.p2 === pid) return { you: "p2" };
  if (allowClaim && !rec.p2) {
    rec.p2 = pid;
    return { you: "p2", claimed: true };
  }
  return {
    err: json(
      { error: "full", message: "Both seats in this game are taken." },
      403
    ),
  };
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return json({ error: "bad json" }, 400);
  }
  const store = getStore("sketchship");
  const { action, pid } = body;

  if (action === "create") {
    if (!body.st) return json({ error: "missing state" }, 400);
    if (!pid) return json({ error: "missing player id" }, 400);
    const id = rnd(5);
    await store.setJSON(id, { p1: pid, p2: null, st: body.st, created: Date.now() });
    return json({ id, you: "p1" });
  }

  if (action === "get" || action === "save") {
    const rec = await store.get(body.id, { type: "json" });
    if (!rec) return json({ error: "not found" }, 404);

    // Games created before device accounts existed can't be mapped to a seat.
    if (rec.t1 || rec.t2) {
      return json(
        {
          error: "legacy",
          message: "This game was created before player accounts. Start a new one.",
        },
        410
      );
    }

    // Only 'get' may claim the open seat — that's how joining works now.
    const s = seat(rec, pid, action === "get");
    if (s.err) return s.err;

    if (action === "get") {
      if (s.claimed) await store.setJSON(body.id, rec);
      return json({ st: rec.st, you: s.you });
    }

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

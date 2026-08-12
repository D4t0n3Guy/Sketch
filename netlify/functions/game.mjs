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
      {
        error: "full",
        message: "Both seats in this game are taken.",
        // Send back who holds them, so a locked-out player can move their seat.
        seats: { p1: (rec.st && rec.st.n1) || "", p2: (rec.st && rec.st.n2) || "" },
      },
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
  const store = getStore({ name: "sketchship", consistency: "strong" });
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

    /* Moving an existing seat to this device. Identity lives in one browser's
       storage, so a cleared cache, a new phone, or the link opening in a
       different browser would otherwise lock a player out of their own game
       for good. The other player is told in the log — this is deliberate,
       since it's the only thing stopping it being used to peek. */
    if (action === "get" && (body.claim === "p1" || body.claim === "p2") && pid) {
      const slot = body.claim;
      if (rec[slot] !== pid) {
        rec[slot] = pid;
        const other = slot === "p1" ? "p2" : "p1";
        if (rec[other] === pid) rec[other] = null;   // never hold both seats
        const who = (rec.st && (slot === "p1" ? rec.st.n1 : rec.st.n2)) || "A player";
        if (rec.st) {
          const line = `\u26A0\uFE0F ${who} moved their seat to another device`;
          rec.st.lg = [...(rec.st.lg || []).slice(-4), line];
        }
        await store.setJSON(body.id, rec);
      }
      return json({ st: rec.st, you: slot });
    }

    // Only 'get' may claim the open seat — that's how joining works now.
    const s = seat(rec, pid, action === "get");
    if (s.err) return s.err;

    if (action === "get") {
      if (s.claimed) await store.setJSON(body.id, rec);
      return json({ st: rec.st, you: s.you });
    }

    if (!body.st) return json({ error: "missing state" }, 400);
    const held = rec.st || {};
    const heldMv = Number(held.mv) || 0;

    /* During battle the question that actually matters is "is it your turn?",
       not "does your counter match mine?". Counter matching produced false
       conflicts whenever a player took several shots in a row, because each
       save had to guess a number the server was still catching up on. The
       server owns the counter now; the client just sends its board. */
    if (held.ph === "b") {
      if (held.t !== s.you) {
        return json({ error: "stale", st: rec.st, reason: "not-your-turn" }, 409);
      }
      rec.st = { ...body.st, mv: heldMv + 1 };
    } else {
      // Placement: both players write, so keep the ordering guard here.
      const incoming = Number(body.st.mv) || 0;
      if (incoming <= heldMv) {
        return json({ error: "stale", st: rec.st, reason: "behind" }, 409);
      }
      rec.st = body.st;
    }

    await store.setJSON(body.id, rec);
    return json({ ok: true, st: rec.st });
  }

  return json({ error: "unknown action" }, 400);
};

export const config = { path: "/api/game" };

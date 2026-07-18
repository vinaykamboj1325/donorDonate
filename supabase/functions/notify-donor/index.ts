// BloodLink Edge Function: send a web push to the donor when a request is created.
// Deploy: supabase functions deploy notify-donor --no-verify-jwt
// Secrets needed: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  "mailto:notifications@bloodlink.app",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { request_id } = await req.json();
    if (!request_id) throw new Error("request_id is required");

    const { data: r, error: reqErr } = await supabase
      .from("requests")
      .select("id, donor_id, requester_name, hospital, units, urgency, created_at")
      .eq("id", request_id)
      .single();
    if (reqErr || !r) throw new Error("Request not found");

    // Only notify for fresh requests (blocks replaying old ids).
    if (Date.now() - new Date(r.created_at).getTime() > 5 * 60 * 1000) {
      return Response.json({ ok: true, skipped: "stale" }, { headers: cors });
    }

    const { data: donor } = await supabase
      .from("donors").select("blood_group").eq("id", r.donor_id).single();

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("donor_id", r.donor_id);

    const payload = JSON.stringify({
      title: `🩸 ${donor?.blood_group ?? "Blood"} request — ${r.urgency === "urgent" ? "URGENT" : "new"}`,
      body: `${r.requester_name} needs ${r.units ?? 1} unit(s)${r.hospital ? ` at ${r.hospital}` : ""}. Open your dashboard to reply.`,
      url: "/",
      tag: `request-${r.id}`,
    });

    let sent = 0;
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(s.subscription, payload);
        sent++;
      } catch (e) {
        // Subscription expired/revoked: clean it up.
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }
    return Response.json({ ok: true, sent }, { headers: cors });
  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 400, headers: cors });
  }
});

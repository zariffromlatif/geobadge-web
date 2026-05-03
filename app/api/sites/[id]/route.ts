import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const adminPin = () => process.env.ADMIN_PIN ?? "admin2026";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const pin = request.headers.get("x-admin-pin");
  if (pin !== adminPin()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return Response.json({ error: "Missing site id" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return Response.json(
      {
        error:
          "Server missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Dashboard → Settings → API → service_role secret).",
        code: "MISSING_SERVICE_KEY",
      },
      { status: 503 },
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.from("sites").delete().eq("id", id).select("id");

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (!data?.length) {
    return Response.json(
      { error: "No row deleted — check site id or foreign-key constraints on checkins." },
      { status: 404 },
    );
  }

  return Response.json({ ok: true });
}

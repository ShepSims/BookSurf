import { NextResponse } from "next/server";
import { runDiscovery } from "@/lib/discovery/engine";
import { createDiscoveryServices } from "@/lib/discovery/services";
import { SupabaseDiscoveryRepository } from "@/lib/supabase/discovery-repository";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json(
      { error: "Supabase service-role credentials are not configured" },
      { status: 503 },
    );
  }

  try {
    const repository = new SupabaseDiscoveryRepository();
    const result = await runDiscovery(repository, createDiscoveryServices());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("booksurf.cron.error", error);
    return NextResponse.json({ error: "Discovery run failed" }, { status: 500 });
  }
}

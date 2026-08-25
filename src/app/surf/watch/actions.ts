"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  originAirport: z.string().trim().length(3).transform((value: string) => value.toUpperCase()),
  maxAllInCostPerPerson: z.coerce.number().positive(),
  minTripNights: z.coerce.number().int().min(1).max(14),
  maxTripNights: z.coerce.number().int().min(1).max(21),
  travelers: z.coerce.number().int().min(1).max(20),
  skillLevel: z.enum(["beginner", "intermediate", "advanced", "expert"]),
  minSurfScore: z.coerce.number().int().min(55).max(100),
  alertEmail: z.string().email(),
});

export async function createWatch(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.maxTripNights < parsed.data.minTripNights) {
    redirect("/surf/watch?error=invalid");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/surf/watch?error=supabase");

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/account?next=/surf/watch");

  const v = parsed.data;
  const { data: watch, error } = await supabase
    .from("surf_watches")
    .insert({
      user_id: userData.user.id,
      name: `${v.originAirport} → Anywhere`,
      origin_airport: v.originAirport,
      window_days: 16,
      min_trip_nights: v.minTripNights,
      max_trip_nights: v.maxTripNights,
      max_all_in_cost_per_person: v.maxAllInCostPerPerson,
      travelers: v.travelers,
      destination_mode: "anywhere",
      skill_level: v.skillLevel,
      min_surf_score: v.minSurfScore,
      min_wave_height_ft: 2,
      max_wave_height_ft: 6,
      min_period_seconds: 9,
      flights_required: true,
      accommodation_required: true,
      board_rental_required: true,
      carry_on_required: true,
      walkable_to_beach_required: true,
      allow_connections: true,
      group_discounts_enabled: true,
      alert_email: v.alertEmail,
      alerts_enabled: true,
      active: true,
    })
    .select("id")
    .single();

  if (error || !watch) redirect("/surf/watch?error=save");

  // The results route executes discovery immediately for this watch. It uses
  // the persistent admin repository when configured and a transient repository
  // otherwise, so a new user sees value now instead of waiting for the cron.
  redirect(`/surf/opportunities?watch=${watch.id}&scan=now`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function setOpportunityStatus(id: string, formData: FormData) {
  const status = String(formData.get("status") ?? "");
  if (status !== "booked" && status !== "dismissed" && status !== "active") {
    return;
  }
  const client = await createSupabaseServerClient();
  if (!client) redirect("/account");
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) redirect("/account");
  const { error } = await client
    .from("trip_opportunities")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
  revalidatePath(`/surf/opportunities/${id}`);
  revalidatePath("/surf/opportunities");
}

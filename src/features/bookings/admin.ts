import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BookingStatus } from "./domain";

export const statusLabels: Record<BookingStatus, string> = {
  pending_operator: "Needs operator reply",
  quoted: "Quote sent",
  awaiting_payment: "Awaiting payment",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export async function getBookingAdmin() {
  const ids = process.env.BOOKSURF_ADMIN_USER_IDS?.split(",").map((id) => id.trim());
  if (!ids?.some(Boolean)) return "unavailable" as const;

  const auth = await createSupabaseServerClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return "signin" as const;
  if (!ids.includes(user.id) || user.is_anonymous) notFound();

  return createSupabaseAdminClient() ?? "unavailable";
}

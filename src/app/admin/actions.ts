"use server";

import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { getBookingAdmin } from "@/features/bookings/admin";
import { bookingStatuses, canTransition } from "@/features/bookings/domain";

const status = z.enum(bookingStatuses);
const updateSchema = z.object({
  id: z.uuid(),
  revision: z.coerce.number().int().min(0).max(2147483646),
  from: status,
  to: status,
  internalNotes: z.string().trim().max(4000),
  verified: z.literal("yes").nullable(),
});

export async function updateBooking(form: FormData) {
  const db = await getBookingAdmin();
  if (db === "signin") redirect("/account?next=admin");
  if (db === "unavailable") notFound();

  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) notFound();
  const path = `/admin/${id.data}` as const;
  const result = updateSchema.safeParse({
    id: id.data,
    revision: form.get("revision"),
    from: form.get("from"),
    to: form.get("to"),
    internalNotes: form.get("internalNotes"),
    verified: form.get("verified"),
  });
  if (!result.success) redirect(`${path}?error=invalid`);

  const { revision, from, to, internalNotes, verified } = result.data;
  if (from !== to) {
    if (!canTransition(from, to)) redirect(`${path}?error=invalid`);
    if (to === "confirmed" && verified !== "yes") redirect(`${path}?error=verify`);
  }

  const { data, error } = await db.from("surf_booking_requests")
    .update({ status: to, internal_notes: internalNotes, admin_revision: revision + 1 })
    .eq("id", id.data).eq("status", from).eq("admin_revision", revision)
    .select("id").maybeSingle();

  if (error) {
    console.error("Booking admin update failed", error.code);
    redirect(`${path}?error=save`);
  }
  if (!data) redirect(`${path}?error=conflict`);

  revalidatePath("/admin");
  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

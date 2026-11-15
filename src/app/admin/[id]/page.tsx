import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getBookingAdmin, statusLabels } from "@/features/bookings/admin";
import { bookingStatuses, transitions } from "@/features/bookings/domain";
import { updateBooking } from "../actions";
import styles from "../admin.module.css";

export const metadata = { title: "Booking details | BookSurf Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const errors = {
  conflict: "Someone updated this request. Review the latest details and try again.",
  invalid: "That change isn’t valid for this request.",
  verify: "Verify payment and the operator’s confirmation before marking this booking confirmed.",
  save: "Couldn’t save your changes. Try again.",
};

export default async function BookingPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const db = await getBookingAdmin();
  if (db === "signin") redirect("/account?next=admin");
  if (db === "unavailable") redirect("/admin");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const { data: booking, error } = await db.from("surf_booking_requests")
    .select("id, name, email, destination, dates, guests, skill_level, budget, notes, status, internal_notes, admin_revision")
    .eq("id", id).maybeSingle();
  if (error) {
    console.error("Booking admin read failed", error.code);
    return <main className={styles.shell}><Link href="/admin">← All requests</Link><p role="alert">Couldn’t load this request. Refresh to try again.</p></main>;
  }
  if (!booking) notFound();

  const status = z.enum(bookingStatuses).safeParse(booking.status);
  const feedback = await searchParams;
  const message = Object.hasOwn(errors, feedback.error ?? "") ? errors[feedback.error as keyof typeof errors] : undefined;

  return (
    <main className={styles.shell}>
      <Link href="/admin" className={styles.back}>← All requests</Link>
      <header className={styles.heading}><h1>{booking.name}</h1><p>{booking.destination} · {booking.dates}</p></header>
      <div className={styles.columns}>
        <section className={styles.panel}>
          <h2>Trip request</h2>
          <dl className={styles.details}>
            <dt>Email</dt><dd><a href={"mailto:" + encodeURIComponent(booking.email)}>{booking.email}</a></dd>
            <dt>Travelers</dt><dd>{booking.guests}</dd>
            <dt>Surf level</dt><dd>{booking.skill_level}</dd>
            <dt>Budget</dt><dd>{booking.budget || "Unspecified"}</dd>
            <dt>Traveler notes</dt><dd className={styles.notes}>{booking.notes || "None"}</dd>
          </dl>
        </section>
        <section className={styles.panel}>
          <h2>Manage booking</h2>
          {message && <p role="alert" className={styles.error}>{message}</p>}
          {feedback.saved === "1" && <p role="status">Changes saved.</p>}
          {status.success ? (
            <form action={updateBooking} className={styles.form}>
              <input type="hidden" name="id" value={booking.id} />
              <input type="hidden" name="revision" value={booking.admin_revision} />
              <input type="hidden" name="from" value={status.data} />
              <label>Status
                <select name="to" defaultValue={status.data}>
                  {[status.data, ...transitions[status.data]].map((value) => (
                    <option key={value} value={value}>{statusLabels[value]}</option>
                  ))}
                </select>
              </label>
              {status.data === "awaiting_payment" && (
                <label className={styles.check}>
                  <input type="checkbox" name="verified" value="yes" />
                  I’ve verified payment and the operator’s confirmation.
                </label>
              )}
              <label>Internal notes
                <textarea name="internalNotes" rows={6} maxLength={4000} defaultValue={booking.internal_notes ?? ""} />
              </label>
              <button className="button" type="submit">Save changes</button>
            </form>
          ) : <p role="alert">This request has an unknown status. Changes are unavailable.</p>}
        </section>
      </div>
    </main>
  );
}

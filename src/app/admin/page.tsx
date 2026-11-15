import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getBookingAdmin, statusLabels } from "@/features/bookings/admin";
import { bookingStatuses } from "@/features/bookings/domain";
import styles from "./admin.module.css";

export const metadata: Metadata = { title: "Bookings | BookSurf Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const pageSize = 25;
const statusSchema = z.enum(bookingStatuses);
const formatDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" });

export default async function AdminPage({ searchParams }: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const db = await getBookingAdmin();
  if (db === "signin") redirect("/account?next=admin");
  if (db === "unavailable") {
    return <main className={styles.shell}><h1>Bookings</h1><p role="status">Booking admin setup is required.</p></main>;
  }

  const params = await searchParams;
  const selected = statusSchema.safeParse(params.status);
  const rawPage = Number(params.page);
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 100000 ? rawPage : 1;
  const offset = (page - 1) * pageSize;

  let query = db.from("surf_booking_requests")
    .select("id, name, destination, dates, guests, status, created_at")
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(offset, offset + pageSize);
  if (selected.success) query = query.eq("status", selected.data);

  const { data, error } = await query;
  if (error) console.error("Booking admin inbox failed", error.code);
  const nextPage = (number: number) => {
    const query = new URLSearchParams({ page: String(number) });
    if (selected.success) query.set("status", selected.data);
    return { pathname: "/admin", search: query.toString() };
  };

  return (
    <main className={styles.shell}>
      <header className={styles.heading}>
        <p className="eyebrow">BookSurf Admin</p><h1>Bookings</h1>
        <p>Review trip requests and track each booking from inquiry to confirmation.</p>
      </header>
      <nav className={styles.filters} aria-label="Filter by status">
        <Link href="/admin" aria-current={!selected.success ? "page" : undefined}>All requests</Link>
        {bookingStatuses.map((status) => (
          <Link key={status} href={`/admin?status=${status}`} aria-current={selected.data === status ? "page" : undefined}>
            {statusLabels[status]}
          </Link>
        ))}
      </nav>
      <section className={styles.panel} aria-label="Booking requests">
        {error ? <p role="alert">Couldn’t load requests. Refresh to try again.</p> : data?.length ? (
          <ul className={styles.list}>
            {data.slice(0, pageSize).map((booking) => {
              const status = statusSchema.safeParse(booking.status);
              return (
                <li key={booking.id}>
                  <Link href={`/admin/${booking.id}`} className={styles.row}>
                    <div><strong>{booking.name}</strong><span>{booking.destination} · {booking.guests} {booking.guests === 1 ? "guest" : "guests"}</span></div>
                    <div><strong>{booking.dates}</strong><span>Received {formatDate.format(new Date(booking.created_at))}</span></div>
                    <span className={styles.badge} data-status={booking.status}>{status.success ? statusLabels[status.data] : "Unknown status"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : <p>{selected.success ? "No requests with this status." : "No booking requests here yet."}</p>}
      </section>
      {!error && (page > 1 || (data?.length ?? 0) > pageSize) && (
        <nav aria-label="Booking pages" className={styles.filters}>
          {page > 1 && <Link href={nextPage(page - 1)}>Previous page</Link>}
          {(data?.length ?? 0) > pageSize && page < 100000 && <Link href={nextPage(page + 1)}>Next page</Link>}
        </nav>
      )}
    </main>
  );
}

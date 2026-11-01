# BookSurf booking architecture

## Product boundary
BookSurf is the merchant-facing booking marketplace and concierge. Local operators fulfill trips. Operators may have their own websites; no integration is required for manual confirmation.

## Lifecycle
`pending_operator -> quoted -> awaiting_payment -> confirmed`; terminal or exception states are `declined` and `cancelled`. Never label a trip confirmed merely because an inquiry exists or a payment link was sent. Enforce transitions on the server, never in the browser.

## Modules
- `features/bookings/domain.ts`: input validation, booking states, transition rules, stable request fingerprint.
- `app/api/surf/booking-requests`: public intake only; no public list or update endpoint.
- Supabase `surf_booking_requests`: source of truth. RLS enabled; no anon/authenticated direct table access.
- Notification email: operational convenience, not the source of truth. The database write must succeed independently of notification delivery.
- Future: operator adapters, quote versions, payments, outbox events, audit trail, admin dashboard.

## Production hardening backlog
1. **Abuse protection:** edge rate limits by IP and identity, bot challenges, monitoring. Honeypot alone is insufficient.
2. **Idempotency:** client-generated request key + database unique constraint to avoid duplicate submissions during retries.
3. **Transactional outbox:** write notification event in the same database transaction as booking creation; worker retries and dead-letter alerts.
4. **Quote/payment:** operator confirms availability and an immutable priced quote; Stripe checkout uses server-side quote ID, never browser-supplied amounts. Stripe webhook signature verification and idempotent fulfillment.
5. **Operator portal:** Supabase Auth, explicit operator membership and per-operator RLS, least-privilege staff roles.
6. **Ops:** admin-only inbox, statuses, assignment, SLA timers, notes, activity history, exceptions, refund policy, reconciliation.
7. **Privacy:** retention policy, data export/deletion, secrets only server-side, minimal PII in logs.
8. **Observability:** structured request IDs, traceable transitions, alerts for stuck requests, failed notifications and payments.
9. **Testing:** unit tests for transitions/validation, integration tests with isolated Supabase, webhook replay tests, and Playwright end-to-end booking tests. Run lint, typecheck, tests and build in CI before merging.

## Operational invariants
- Customer must approve exact itinerary, price and terms before payment.
- An operator's confirmation is distinct from the customer's payment.
- No external integration should be required to onboard an operator.
- Booking notifications can fail without losing the request.
- Never expose service-role credentials to a browser.

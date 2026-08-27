import Link from "next/link";
import { getProviderStatuses } from "@/lib/providers/status";

export default function SourcesPage() {
  const statuses = getProviderStatuses();
  return (
    <main className="container" style={{ padding: "62px 0 100px", maxWidth: 900 }}>
      <div className="eyebrow">Travel source stack</div>
      <h1 style={{ fontSize: 54, letterSpacing: "-.055em", margin: "12px 0 8px" }}>
        BookSurf owns the decision layer.
      </h1>
      <p style={{ color: "var(--muted)", maxWidth: 720 }}>
        Suppliers are replaceable adapters. BookSurf owns surf qualification, normalization, price provenance,
        complete-trip math, ranking, budget verification, and opportunity history.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
        {statuses.map((status) => (
          <section key={`${status.category}-${status.name}`} className="panel" style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}>
              <div>
                <div className="eyebrow">{status.category}</div>
                <h2 style={{ margin: "6px 0" }}>{status.name}</h2>
              </div>
              <strong>{status.mode}</strong>
            </div>
            <p style={{ color: "var(--muted)", marginBottom: 0 }}>{status.detail}</p>
          </section>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
        <Link className="button" href="/surf/watch">Find trips</Link>
        <Link className="button secondary" href="/surf/opportunities">Opportunities</Link>
      </div>
    </main>
  );
}

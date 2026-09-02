import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookSurf — Surf books. Book surf.",
  description: "Surf through books worth reading and find surf trips worth taking.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header style={{borderBottom:"1px solid var(--line)", background:"rgba(251,252,250,.94)"}}>
          <div className="container" style={{height:72, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
            <Link href="/" style={{fontWeight:950, letterSpacing:"-.04em", fontSize:24}}>BOOKSURF</Link>
            <nav style={{display:"flex", gap:18, fontSize:14, fontWeight:800, alignItems:"center"}}>
              <Link href="/books">Books</Link><Link href="/surf">Surf trips</Link><Link href="/account">Account</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

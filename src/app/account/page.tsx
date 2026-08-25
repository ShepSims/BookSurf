import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signIn, signOut, signUp } from "./actions";

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const client = await createSupabaseServerClient();
  const { data } = client ? await client.auth.getUser() : { data: { user: null } };
  return <main className="container" style={{padding:"64px 0 100px", maxWidth:680}}><div className="eyebrow">Account</div><h1 style={{fontSize:50,letterSpacing:"-.05em",margin:"12px 0 26px"}}>{data.user ? "You’re signed in." : "Sign in to save watches."}</h1>{params.error && <p>Authentication failed: {params.error}</p>}{params.created && <p>Account created. If email confirmation is enabled in Supabase, confirm your email before signing in.</p>}{data.user ? <div className="panel" style={{padding:26}}><p>{data.user.email}</p><form action={signOut}><button className="button secondary">Sign out</button></form></div> : <div className="panel" style={{padding:26}}><form style={{display:"grid",gap:14}}><label>Email<input name="email" type="email" required/></label><label>Password<input name="password" type="password" minLength={8} required/></label><div style={{display:"flex",gap:10}}><button className="button" formAction={signIn}>Sign in</button><button className="button secondary" formAction={signUp}>Create account</button></div></form></div>}</main>;
}

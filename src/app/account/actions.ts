"use server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const client = await createSupabaseServerClient();
  if (!client) redirect("/account?error=supabase");
  const { error } = await client.auth.signInWithPassword({ email, password });
  const forAdmin = formData.get("next") === "admin";
  if (error) redirect(forAdmin ? "/account?next=admin&error=signin" : "/account?error=signin");
  redirect(forAdmin ? "/admin" : "/surf/watch");
}
export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const client = await createSupabaseServerClient();
  if (!client) redirect("/account?error=supabase");
  const { error } = await client.auth.signUp({ email, password });
  if (error) redirect("/account?error=signup");
  redirect("/account?created=1");
}
export async function signOut() { const client = await createSupabaseServerClient(); await client?.auth.signOut(); redirect("/"); }

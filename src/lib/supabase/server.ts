import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicKey,hasSupabasePublicEnv } from "./env";
export async function createSupabaseServerClient(){if(!hasSupabasePublicEnv())return null;const cookieStore=await cookies();return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,getSupabasePublicKey()!,{cookies:{getAll:()=>cookieStore.getAll(),setAll(cookiesToSet){try{cookiesToSet.forEach(({name,value,options})=>cookieStore.set(name,value,options));}catch{}}}});}

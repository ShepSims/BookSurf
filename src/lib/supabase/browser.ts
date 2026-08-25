import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicKey,hasSupabasePublicEnv } from "./env";
export function createSupabaseBrowserClient(){if(!hasSupabasePublicEnv())return null;return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,getSupabasePublicKey()!);}

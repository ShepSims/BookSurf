import { createClient } from "@supabase/supabase-js";
import { hasSupabaseServiceEnv } from "./env";
export function createSupabaseAdminClient(){if(!hasSupabaseServiceEnv())return null;return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});}

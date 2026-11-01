import { z } from "zod";
const source=z.string().trim().max(100).regex(/^[a-zA-Z0-9 _.-]*$/).default("");
export const attributionSchema=z.object({
 utm_source:source,utm_medium:source,utm_campaign:source,utm_content:source,utm_term:source,
 referral_code:z.string().trim().max(64).regex(/^[a-zA-Z0-9_-]*$/).default(""),
 landing_path:z.string().max(300).default("")
});
export type Attribution=z.infer<typeof attributionSchema>;
export function parseAttribution(query:URLSearchParams):Attribution{
 const raw=Object.fromEntries(["utm_source","utm_medium","utm_campaign","utm_content","utm_term","referral_code","landing_path"].map(k=>[k,query.get(k)||""]));
 return attributionSchema.parse(raw);
}
export function attributionChannel(a:Attribution){
 if(a.referral_code)return "referral";
 if(a.utm_source.toLowerCase()==="google"&&a.utm_medium.toLowerCase()==="cpc")return "paid_search";
 if(a.utm_medium.toLowerCase()==="organic")return "organic_search";
 return a.utm_source||"direct";
}

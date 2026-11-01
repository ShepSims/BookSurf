import { z } from "zod";
import { attributionSchema } from "@/features/acquisition/attribution";

export const bookingRequestSchema=z.object({
 name:z.string().trim().min(2).max(120),
 email:z.email().max(254),
 dates:z.string().trim().min(3).max(250),
 guests:z.coerce.number().int().min(1).max(20),
 level:z.enum(["First timer","Beginner","Intermediate","Advanced","Mixed group"]),
 budget:z.string().trim().max(120).optional().default(""),
 notes:z.string().trim().max(2000).optional().default(""),
 website:z.string().max(200).optional().default(""),
 attribution:attributionSchema.optional()
});
export type BookingRequestInput=z.infer<typeof bookingRequestSchema>;
export const bookingStatuses=["pending_operator","quoted","awaiting_payment","confirmed","declined","cancelled"] as const;
export type BookingStatus=typeof bookingStatuses[number];
export const transitions:Record<BookingStatus,readonly BookingStatus[]>={
 pending_operator:["quoted","declined","cancelled"],
 quoted:["awaiting_payment","cancelled","declined"],
 awaiting_payment:["confirmed","cancelled"],
 confirmed:["cancelled"],
 declined:[],
 cancelled:[]
};
export function canTransition(from:BookingStatus,to:BookingStatus){return transitions[from].includes(to)}
export function normalizeEmail(email:string){return email.trim().toLowerCase()}
export function requestFingerprint(input:BookingRequestInput){return [normalizeEmail(input.email),input.dates.trim().toLowerCase(),input.guests,input.level].join("|")}

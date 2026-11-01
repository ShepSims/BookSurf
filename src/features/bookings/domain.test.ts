import {describe,it,expect} from "vitest";
import {bookingRequestSchema,canTransition,normalizeEmail,requestFingerprint} from "./domain";

const valid={name:"Alex Surfer",email:"Alex@example.com",dates:"March 12-16",guests:2,level:"Intermediate",notes:"Prefer mellow point breaks"};
describe("booking request validation",()=>{
 it("accepts a valid request and normalizes guest count",()=>{const parsed=bookingRequestSchema.parse({...valid,guests:"2"});expect(parsed.guests).toBe(2)});
 it("rejects invalid email",()=>expect(bookingRequestSchema.safeParse({...valid,email:"invalid"}).success).toBe(false));
 it("rejects invalid party sizes",()=>{for(const guests of [0,-1,21,1.5])expect(bookingRequestSchema.safeParse({...valid,guests}).success).toBe(false)});
 it("rejects oversized notes",()=>expect(bookingRequestSchema.safeParse({...valid,notes:"a".repeat(2001)}).success).toBe(false));
 it("rejects unsupported surf level",()=>expect(bookingRequestSchema.safeParse({...valid,level:"Pro"}).success).toBe(false));
 it("normalizes email casing",()=>expect(normalizeEmail(" Alex@Example.COM ")).toBe("alex@example.com"));
 it("creates stable request fingerprints",()=>{const a=bookingRequestSchema.parse(valid);const b=bookingRequestSchema.parse({...valid,email:" ALEX@example.com ",dates:"MARCH 12-16"});expect(requestFingerprint(a)).toBe(requestFingerprint(b))});
});
describe("booking state machine",()=>{
 it("allows operator quote after request",()=>expect(canTransition("pending_operator","quoted")).toBe(true));
 it("prevents confirmation without payment state",()=>expect(canTransition("pending_operator","confirmed")).toBe(false));
 it("prevents re-opening declined bookings",()=>expect(canTransition("declined","quoted")).toBe(false));
 it("allows cancellation after confirmation",()=>expect(canTransition("confirmed","cancelled")).toBe(true));
});

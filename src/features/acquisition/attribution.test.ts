import {describe,it,expect} from "vitest";
import {attributionSchema,parseAttribution,attributionChannel} from "./attribution";
describe("acquisition attribution",()=>{
 it("parses search campaign parameters",()=>expect(parseAttribution(new URLSearchParams("utm_source=google&utm_medium=cpc&utm_campaign=baja"))).toMatchObject({utm_source:"google",utm_campaign:"baja"}));
 it("classifies paid search",()=>expect(attributionChannel(attributionSchema.parse({utm_source:"google",utm_medium:"cpc"}))).toBe("paid_search"));
 it("prioritizes partner referral",()=>expect(attributionChannel(attributionSchema.parse({utm_source:"google",utm_medium:"cpc",referral_code:"shop-1"}))).toBe("referral"));
 it("rejects untrusted overlong referral codes",()=>expect(attributionSchema.safeParse({referral_code:"x".repeat(65)}).success).toBe(false));
 it("rejects script-like attribution values",()=>expect(attributionSchema.safeParse({utm_source:"<script>"}).success).toBe(false));
 it("defaults to direct",()=>expect(attributionChannel(attributionSchema.parse({}))).toBe("direct"));
});

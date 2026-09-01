import { describe, expect, it } from "vitest";
import { getTrimAcceleration, getWipeoutReason, nextControlState } from "./surfPhysics";

const neutral = { left: false, right: false, forward: false, back: false };

describe("surf controls", () => {
  it("maps left and right rails to opposite bank directions", () => {
    expect(nextControlState(0, 0, { ...neutral, left: true }, 1 / 60).bank).toBeGreaterThan(0);
    expect(nextControlState(0, 0, { ...neutral, right: true }, 1 / 60).bank).toBeLessThan(0);
  });

  it("drives with forward weight and slows with back weight", () => {
    expect(getTrimAcceleration(0.8, 0.2, 0.9)).toBeGreaterThan(0);
    expect(getTrimAcceleration(-0.8, 0.2, 0.9)).toBeLessThan(0);
  });

  it("classifies terminal pocket and speed conditions", () => {
    expect(getWipeoutReason(0.01, 22)).toBe("THE FOAM BALL CAUGHT YOU");
    expect(getWipeoutReason(0.5, 9)).toBe("YOU LOST TOO MUCH SPEED");
    expect(getWipeoutReason(0.5, 22)).toBeNull();
  });
});

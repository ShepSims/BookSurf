export type SurfControls = {
  left: boolean;
  right: boolean;
  forward: boolean;
  back: boolean;
};

export const nextControlState = (
  bank: number,
  trim: number,
  controls: SurfControls,
  dt: number,
) => {
  const rail = Number(controls.left) - Number(controls.right);
  const trimInput = Number(controls.forward) - Number(controls.back);
  const nextBank = bank + (rail * 0.88 - bank) * Math.min(1, dt * (rail ? 6.2 : 4.2));
  const nextTrim = trim + (trimInput * 0.92 - trim) * Math.min(1, dt * (trimInput ? 5.8 : 3.8));
  return { bank: nextBank, trim: nextTrim };
};

export const getTrimAcceleration = (trim: number, descending: number, hold: number) =>
  Math.max(0, trim) * (1.15 + 0.35 * descending) -
  Math.max(0, -trim) * (2.2 + 0.55 * hold);

export const getWipeoutReason = (pocket: number, speed: number) => {
  if (pocket < 0.018) return "THE FOAM BALL CAUGHT YOU";
  if (speed < 10.5) return "YOU LOST TOO MUCH SPEED";
  return null;
};

export const LEGACY_PLAY_PRODUCT = "doodle_credits_10" as const;
export const PLAY_PACK_IDS = ["pack_mini", "pack_regular", "pack_big"] as const;
export type PlayPackId = typeof PLAY_PACK_IDS[number];
export type PlayProductId = PlayPackId | typeof LEGACY_PLAY_PRODUCT;
export type PlayPack = { productId: PlayPackId; credits: number; normalCredits: number; offerApplied: boolean };
export type PlayCatalog = { version: 1; offerEnd: string; packs: PlayPack[] };
export function isPlayProductId(value: unknown): value is PlayProductId {
 return value === LEGACY_PLAY_PRODUCT || PLAY_PACK_IDS.includes(value as PlayPackId);
}
export function launchSchedule(delayDays = 0) {
 if (!Number.isSafeInteger(delayDays) || delayDays < 0 || delayDays > 90) throw new Error("Invalid launch delay");
 const shift = (day: string) => { const date=new Date(day+"T12:00:00Z"); date.setUTCDate(date.getUTCDate()+delayDays); return date.toISOString().slice(0,10); };
 return { launchDate: shift("2026-10-12"), reportDate: shift("2026-10-23"), offerEnd: shift("2026-10-31")+"T23:59:59+01:00" };
}
export function getPlayCatalog(at = new Date()): PlayCatalog {
 const schedule=launchSchedule(Number(process.env.DOODLE_LAUNCH_DELAY_DAYS ?? 0));
 const bonus=at.valueOf() <= new Date(schedule.offerEnd).valueOf();
 return {version:1,offerEnd:schedule.offerEnd,packs:[
  {productId:"pack_mini",credits:6,normalCredits:6,offerApplied:false},
  {productId:"pack_regular",credits:bonus?25:20,normalCredits:20,offerApplied:bonus},
  {productId:"pack_big",credits:60,normalCredits:60,offerApplied:false},
 ]};
}

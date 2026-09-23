import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOrCreateNativeTrialIdentity } from "./native-guest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ redisCommand: vi.fn() }));
vi.mock("@/lib/redis", () => ({ redisCommand: mocks.redisCommand }));

const installId = "11111111-1111-4111-8111-111111111111";
const trialId = "22222222-2222-4222-8222-222222222222";

describe("native guest identities", () => {
  beforeEach(() => {
    mocks.redisCommand.mockReset();
  });

  it("creates one trial identity per installation with a one-year TTL", async () => {
    mocks.redisCommand.mockResolvedValue("OK");
    await expect(getOrCreateNativeTrialIdentity(installId.toUpperCase())).resolves.toEqual({ id: expect.any(String) });
    expect(mocks.redisCommand).toHaveBeenCalledWith([
      "SET",
      expect.stringMatching(/^doodle:native:trial:[a-f0-9]{64}$/),
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      "EX",
      31_536_000,
      "NX",
    ]);
  });

  it("returns the existing identity after an atomic SET race", async () => {
    mocks.redisCommand.mockResolvedValueOnce(null).mockResolvedValueOnce(trialId);
    await expect(getOrCreateNativeTrialIdentity(installId)).resolves.toEqual({ id: trialId });
    expect(mocks.redisCommand).toHaveBeenLastCalledWith([
      "GET",
      expect.stringMatching(/^doodle:native:trial:[a-f0-9]{64}$/),
    ]);
  });

  it("fails closed for an invalid installation or invalid stored identity", async () => {
    await expect(getOrCreateNativeTrialIdentity("not-an-id")).rejects.toThrow("Invalid native installation");
    mocks.redisCommand.mockResolvedValueOnce(null).mockResolvedValueOnce("not-an-id");
    await expect(getOrCreateNativeTrialIdentity(installId)).rejects.toThrow("Native installation identity unavailable");
  });
});

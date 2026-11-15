import { needsFullFetch } from "src/client/sync-policy";

const NOW = 1_000_000_000;
const base = {
  known: true,
  hasProcessing: false,
  lastFullAt: NOW - 10_000,
  now: NOW,
  forced: false
};

describe("needsFullFetch", () => {
  it("asks only for changes while nothing is processing", () => {
    expect(needsFullFetch(base)).toBe(false);
  });

  it("asks for everything on the first poll and when forced", () => {
    expect(needsFullFetch({ ...base, known: false })).toBe(true);
    expect(needsFullFetch({ ...base, forced: true })).toBe(true);
  });

  // The 2-minute rule turns a stuck receipt into `failed` with no version change.
  it("asks for everything every 30 seconds while a receipt is processing", () => {
    expect(needsFullFetch({ ...base, hasProcessing: true, lastFullAt: NOW - 29_000 })).toBe(false);
    expect(needsFullFetch({ ...base, hasProcessing: true, lastFullAt: NOW - 30_000 })).toBe(true);
  });

  // Photo URLs are valid for at least one hour (src/server/photos.ts); renew well before that.
  it("asks for everything at least every 30 minutes, to renew photo URLs", () => {
    expect(needsFullFetch({ ...base, lastFullAt: NOW - 30 * 60_000 + 1 })).toBe(false);
    expect(needsFullFetch({ ...base, lastFullAt: NOW - 30 * 60_000 })).toBe(true);
  });
});

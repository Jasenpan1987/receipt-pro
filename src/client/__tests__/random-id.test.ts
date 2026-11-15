import { randomId } from "src/client/random-id";

// Must match the server's check in src/server/upload-form.ts.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("randomId", () => {
  it("makes a lower-case UUID v4", () => {
    for (let i = 0; i < 100; i++) {
      expect(randomId()).toMatch(UUID_V4);
    }
  });

  it("sets the version and variant bits whatever the random bytes are", () => {
    expect(randomId(bytes => bytes.fill(0xff))).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    expect(randomId(bytes => bytes.fill(0x00))).toBe("00000000-0000-4000-8000-000000000000");
  });
});

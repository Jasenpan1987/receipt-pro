import { isUnchanged, parseSince } from "src/server/session-sync";

describe("parseSince", () => {
  it("reads the version and session the page already has", () => {
    expect(parseSince(new URLSearchParams("since=7&sessionId=s-1"))).toEqual({
      version: 7,
      sessionId: "s-1"
    });
  });

  it("treats a missing or malformed version as nothing known", () => {
    for (const query of [
      "",
      "since=abc&sessionId=s-1",
      "since=-1&sessionId=s-1",
      "since=1.5&sessionId=s-1"
    ]) {
      expect(parseSince(new URLSearchParams(query))).toBeUndefined();
    }
  });

  it("knows 'no session yet' from an empty sessionId", () => {
    expect(parseSince(new URLSearchParams("since=0&sessionId="))).toEqual({
      version: 0,
      sessionId: null
    });
  });
});

describe("isUnchanged", () => {
  it("is unchanged when both the session and the version match", () => {
    expect(isUnchanged({ sessionId: "s-1", version: 7 }, { sessionId: "s-1", version: 7 })).toBe(
      true
    );
  });

  it("is changed when the version moved", () => {
    expect(isUnchanged({ sessionId: "s-1", version: 8 }, { sessionId: "s-1", version: 7 })).toBe(
      false
    );
  });

  // A new session starts at 0 and can reach the old number.
  it("is changed when the session is a different one with the same version", () => {
    expect(isUnchanged({ sessionId: "s-2", version: 7 }, { sessionId: "s-1", version: 7 })).toBe(
      false
    );
  });

  it("is changed when the page knows nothing yet", () => {
    expect(isUnchanged({ sessionId: "s-1", version: 7 }, undefined)).toBe(false);
  });

  it("is unchanged while there is still no session", () => {
    expect(isUnchanged({ sessionId: null, version: 0 }, { sessionId: null, version: 0 })).toBe(
      true
    );
  });
});

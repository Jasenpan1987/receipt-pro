import { fitWithin } from "src/client/compress-image";

describe("fitWithin", () => {
  it("scales the longest side down to 2048", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1536, height: 2048 });
  });

  it("never scales a small photo up", () => {
    expect(fitWithin(1200, 900)).toEqual({ width: 1200, height: 900 });
  });
});

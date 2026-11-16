import { existsSync } from "node:fs";
import { join } from "node:path";

import manifest from "src/app/manifest";

describe("web app manifest", () => {
  // T-014 acceptance: installed from the home screen, the app opens full screen on the receipt list.
  it("opens full screen on the receipt list", () => {
    const value = manifest();
    expect(value.display).toBe("standalone");
    expect(value.start_url).toBe("/");
  });

  it("points only at icons that exist", () => {
    const icons = manifest().icons ?? [];
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(existsSync(join(process.cwd(), "public", icon.src)), icon.src).toBe(true);
    }
  });
});

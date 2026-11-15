import { StableUrls } from "src/client/stable-urls";

// T-019: on Lambda each instance signs a photo URL with its own temporary credentials, so one
// photo arrived with 5 different URLs in 8 reads, and every new URL made the phone download and
// decode the photo again (63 MB for 12 receipts in 15 s).
describe("StableUrls", () => {
  it("keeps the URL it shows when the server sends a newly signed one", () => {
    const urls = new StableUrls();
    expect(urls.get("r-1", "https://s3/r-1?sig=a")).toBe("https://s3/r-1?sig=a");
    expect(urls.get("r-1", "https://s3/r-1?sig=b")).toBe("https://s3/r-1?sig=a");
  });

  it("keeps each receipt's own URL", () => {
    const urls = new StableUrls();
    urls.get("r-1", "https://s3/r-1?sig=a");
    expect(urls.get("r-2", "https://s3/r-2?sig=b")).toBe("https://s3/r-2?sig=b");
  });

  it("takes the newest URL once the shown one fails to load", () => {
    const urls = new StableUrls();
    urls.get("r-1", "https://s3/r-1?sig=a");
    urls.failed("r-1", 0);
    expect(urls.get("r-1", "https://s3/r-1?sig=b")).toBe("https://s3/r-1?sig=b");
  });

  // A photo that is gone fails with every URL; a refresh per failure would loop.
  it("asks for new URLs at most once a minute per receipt", () => {
    const urls = new StableUrls();
    expect(urls.failed("r-1", 0)).toBe(true);
    expect(urls.failed("r-1", 59_999)).toBe(false);
    expect(urls.failed("r-2", 59_999)).toBe(true);
    expect(urls.failed("r-1", 60_000)).toBe(true);
  });
});

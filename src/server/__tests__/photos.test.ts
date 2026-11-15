import { createAwsClients } from "src/server/aws";
import { photoKey, photoUrl } from "src/server/photos";

const config = {
  profile: "receipt-pro",
  accountId: "111111111111",
  region: "ap-southeast-2",
  tableName: "receipt-pro",
  bucketName: "receipt-pro-photos-test"
};

// Presigning is local: static credentials and a stub STS keep it off the network.
function offlineS3() {
  const sts = { send: vi.fn(async () => ({ Account: "111111111111" })) };
  const { s3 } = createAwsClients(config, {
    sts,
    clientConfig: { credentials: { accessKeyId: "test", secretAccessKey: "test" } }
  });
  return { s3, sts };
}

describe("photoKey", () => {
  it("groups photos by user and session", () => {
    expect(photoKey("u-1", "s-1", "r-1")).toBe("photos/u-1/s-1/r-1.jpg");
  });
});

describe("photoUrl", () => {
  const key = "photos/u-1/s-1/r-1.jpg";

  it("gives the same URL for the whole hour, so polling does not re-download the photo", async () => {
    const { s3 } = offlineS3();
    const early = await photoUrl(s3, config.bucketName, key, new Date("2026-11-15T10:00:01Z"));
    const late = await photoUrl(s3, config.bucketName, key, new Date("2026-11-15T10:59:59Z"));
    const next = await photoUrl(s3, config.bucketName, key, new Date("2026-11-15T11:00:00Z"));
    expect(late).toBe(early);
    expect(next).not.toBe(early);
  });

  it("is signed from the start of the hour and valid for two hours", async () => {
    const { s3 } = offlineS3();
    const url = new URL(
      await photoUrl(s3, config.bucketName, key, new Date("2026-11-15T10:42:00Z"))
    );
    expect(url.searchParams.get("X-Amz-Date")).toBe("20261115T100000Z");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("7200");
    expect(url.pathname).toBe(`/${key}`);
  });

  // Presigning uses the account's credentials, so it passes the account guard too.
  it("checks the account before signing", async () => {
    const { s3, sts } = offlineS3();
    await photoUrl(s3, config.bucketName, key);
    expect(sts.send).toHaveBeenCalledTimes(1);
  });
});

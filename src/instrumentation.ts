// Next.js calls `register()` once when a server process starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const { getConfig } = await import("src/server/config");
  // Throws a plain message naming every missing variable.
  getConfig();

  // Not awaited: a network problem must not hold up startup. The same check guards every
  // AWS call, so a failure here is reported now and refused again later.
  const { assertPersonalAccount } = await import("src/server/aws");
  assertPersonalAccount().then(
    account => console.info(`[receipt-pro] AWS account ${account} confirmed.`),
    (error: Error) => console.error(`[receipt-pro] ${error.message}`)
  );
}

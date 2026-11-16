// The app's service worker (T-014), registered by src/client/register-service-worker.tsx. It caches
// nothing: every request goes to the network as before. Its one job is a page with a clear message
// when a page cannot load without a network, instead of the browser's error page. Some Android
// browsers also want a service worker with a fetch handler before they install an app.
// Public (src/proxy.ts): a service worker script may not be a redirect to /login.

const OFFLINE_PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>receipt-pro</title>
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#faf6f0;color:#2b2118;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif">
<p>没有网络。连上网后再打开。</p>
</body>
</html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
  // Only page loads. API calls, photos, and build files never pass through here.
  if (event.request.mode !== "navigate") {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(OFFLINE_PAGE, {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" }
        })
    )
  );
});

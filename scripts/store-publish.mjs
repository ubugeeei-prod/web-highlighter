import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const chromeOrigin = "https://chromewebstore.googleapis.com";
const edgeOrigin = "https://api.addons.microsoftedge.microsoft.com";
const defaultPoll = Object.freeze({ attempts: 60, delayMs: 5_000 });

/** Waits without keeping store-specific timing code in the publishing clients. */
export const sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

/** Rejects missing credentials and identifiers before any network request starts. */
function required(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name} is required`);
  return value;
}

/** Returns a bounded response excerpt suitable for CI logs. */
function responseExcerpt(value) {
  return Array.from(String(value), (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? " " : character;
  })
    .join("")
    .slice(0, 1_000);
}

/** Reads JSON while preserving the HTTP status and a bounded diagnostic on failure. */
async function requestJson(fetchImpl, url, init, expectedStatus) {
  const response = await fetchImpl(url, init);
  const text = await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(
      `${init.method ?? "GET"} ${new URL(url).pathname} returned ${response.status}: ${responseExcerpt(text)}`,
    );
  }
  try {
    return text === "" ? {} : JSON.parse(text);
  } catch {
    throw new Error(`${init.method ?? "GET"} ${new URL(url).pathname} returned invalid JSON`);
  }
}

/** Polls a Chrome upload until the documented terminal state is reached. */
async function waitForChromeUpload({ fetchImpl, delay, statusUrl, headers, poll }) {
  for (let attempt = 0; attempt < poll.attempts; attempt += 1) {
    if (attempt > 0) await delay(poll.delayMs);
    const status = await requestJson(fetchImpl, statusUrl, { headers }, 200);
    if (status.lastAsyncUploadState === "SUCCEEDED") return;
    if (status.lastAsyncUploadState !== "IN_PROGRESS") {
      throw new Error(
        `Chrome upload failed with state ${status.lastAsyncUploadState ?? "missing"}`,
      );
    }
  }
  throw new Error(`Chrome upload did not finish after ${poll.attempts} status checks`);
}

/**
 * Uploads a verified ZIP to Chrome Web Store API v2 and submits it for review.
 * The caller supplies a short-lived OAuth token; the client never persists it.
 */
export async function publishChrome({
  archive,
  accessToken,
  publisherId,
  itemId,
  fetchImpl = globalThis.fetch,
  delay = sleep,
  poll = defaultPoll,
}) {
  required(accessToken, "Chrome access token");
  required(publisherId, "Chrome publisher ID");
  required(itemId, "Chrome extension ID");
  if (!(archive instanceof Uint8Array) || archive.byteLength === 0) {
    throw new Error("Chrome archive must be a non-empty byte array");
  }

  const item = `publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(itemId)}`;
  const headers = { authorization: `Bearer ${accessToken}` };
  const upload = await requestJson(
    fetchImpl,
    `${chromeOrigin}/upload/v2/${item}:upload`,
    { method: "POST", headers: { ...headers, "content-type": "application/zip" }, body: archive },
    200,
  );

  if (upload.uploadState === "IN_PROGRESS") {
    await waitForChromeUpload({
      fetchImpl,
      delay,
      statusUrl: `${chromeOrigin}/v2/${item}:fetchStatus`,
      headers,
      poll,
    });
  } else if (upload.uploadState !== "SUCCEEDED") {
    throw new Error(`Chrome upload failed with state ${upload.uploadState ?? "missing"}`);
  }

  return requestJson(
    fetchImpl,
    `${chromeOrigin}/v2/${item}:publish`,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ publishType: "DEFAULT_PUBLISH", blockOnWarnings: true }),
    },
    200,
  );
}

/** Turns an Edge Location header into a same-origin operation URL. */
export function edgeOperationUrl(location, operationPrefix) {
  required(location, "Edge operation location");
  const prefix = `${operationPrefix}/operations/`;
  const candidate = /^[A-Za-z0-9-]+$/.test(location)
    ? new URL(`${prefix}${location}`, edgeOrigin)
    : new URL(location, edgeOrigin);
  if (candidate.origin !== edgeOrigin || !candidate.pathname.startsWith(prefix)) {
    throw new Error("Edge operation location is outside the expected API endpoint");
  }
  const operationId = candidate.pathname.slice(prefix.length);
  if (candidate.search || candidate.hash || !/^[A-Za-z0-9-]+$/.test(operationId)) {
    throw new Error("Edge operation location has an invalid operation ID");
  }
  return candidate.href;
}

/** Polls a Microsoft Edge Add-ons operation and rejects every unknown state. */
async function waitForEdgeOperation({ fetchImpl, delay, url, headers, poll }) {
  for (let attempt = 0; attempt < poll.attempts; attempt += 1) {
    if (attempt > 0) await delay(poll.delayMs);
    const operation = await requestJson(fetchImpl, url, { headers }, 200);
    if (operation.status === "Succeeded") return operation;
    if (operation.status !== "InProgress") {
      const detail = operation.errorCode ?? operation.message ?? operation.status ?? "missing";
      throw new Error(`Edge operation failed: ${responseExcerpt(detail)}`);
    }
  }
  throw new Error(`Edge operation did not finish after ${poll.attempts} status checks`);
}

/**
 * Updates an existing Microsoft Edge Add-ons product through API v1.1 and
 * submits the resulting draft. Initial product creation remains a manual step.
 */
export async function publishEdge({
  archive,
  apiKey,
  clientId,
  productId,
  notes,
  fetchImpl = globalThis.fetch,
  delay = sleep,
  poll = defaultPoll,
}) {
  required(apiKey, "Edge API key");
  required(clientId, "Edge client ID");
  required(productId, "Edge product ID");
  required(notes, "Edge certification notes");
  if (!(archive instanceof Uint8Array) || archive.byteLength === 0) {
    throw new Error("Edge archive must be a non-empty byte array");
  }

  const product = `/v1/products/${encodeURIComponent(productId)}/submissions`;
  const headers = { authorization: `ApiKey ${apiKey}`, "x-clientid": clientId };
  const uploadResponse = await fetchImpl(`${edgeOrigin}${product}/draft/package`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/zip" },
    body: archive,
  });
  if (uploadResponse.status !== 202) {
    throw new Error(
      `Edge package upload returned ${uploadResponse.status}: ${responseExcerpt(await uploadResponse.text())}`,
    );
  }
  await waitForEdgeOperation({
    fetchImpl,
    delay,
    url: edgeOperationUrl(uploadResponse.headers.get("location"), `${product}/draft/package`),
    headers,
    poll,
  });

  const publishResponse = await fetchImpl(`${edgeOrigin}${product}`, {
    method: "POST",
    headers: { ...headers, "content-type": "text/plain; charset=utf-8" },
    body: notes,
  });
  if (publishResponse.status !== 202) {
    throw new Error(
      `Edge publish returned ${publishResponse.status}: ${responseExcerpt(await publishResponse.text())}`,
    );
  }
  return waitForEdgeOperation({
    fetchImpl,
    delay,
    url: edgeOperationUrl(publishResponse.headers.get("location"), product),
    headers,
    poll,
  });
}

async function main() {
  const [store, archivePath] = process.argv.slice(2);
  if (!archivePath || !["chrome", "edge"].includes(store)) {
    throw new Error("usage: vp run store-publish <chrome|edge> <archive.zip>");
  }
  const archive = readFileSync(archivePath);
  if (store === "chrome") {
    await publishChrome({
      archive,
      accessToken: process.env.CHROME_ACCESS_TOKEN,
      publisherId: process.env.CHROME_PUBLISHER_ID,
      itemId: process.env.CHROME_EXTENSION_ID,
    });
  } else {
    await publishEdge({
      archive,
      apiKey: process.env.EDGE_API_KEY,
      clientId: process.env.EDGE_CLIENT_ID,
      productId: process.env.EDGE_PRODUCT_ID,
      notes: process.env.EDGE_CERTIFICATION_NOTES,
    });
  }
  console.log(`${store} submission accepted`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

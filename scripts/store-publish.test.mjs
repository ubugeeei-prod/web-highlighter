import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { edgeOperationUrl, publishChrome, publishEdge } from "./store-publish.mjs";

const archive = readFileSync(new URL("../LICENSE", import.meta.url));
const noDelay = async () => {};
const immediatePoll = { attempts: 3, delayMs: 0 };

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

test("Chrome polls an asynchronous upload and blocks publication warnings", async () => {
  const requests = [];
  const responses = [
    json(200, { uploadState: "IN_PROGRESS" }),
    json(200, { lastAsyncUploadState: "IN_PROGRESS" }),
    json(200, { lastAsyncUploadState: "SUCCEEDED" }),
    json(200, { state: "PENDING_REVIEW" }),
  ];
  const result = await publishChrome({
    archive,
    accessToken: "short-lived-token",
    publisherId: "publisher-1",
    itemId: "extension-1",
    delay: noDelay,
    poll: immediatePoll,
    fetchImpl: async (url, init = {}) => {
      requests.push({ url, init });
      return responses.shift();
    },
  });

  assert.equal(result.state, "PENDING_REVIEW");
  assert.deepEqual(
    requests.map(({ url, init }) => [init.method ?? "GET", new URL(url).pathname]),
    [
      ["POST", "/upload/v2/publishers/publisher-1/items/extension-1:upload"],
      ["GET", "/v2/publishers/publisher-1/items/extension-1:fetchStatus"],
      ["GET", "/v2/publishers/publisher-1/items/extension-1:fetchStatus"],
      ["POST", "/v2/publishers/publisher-1/items/extension-1:publish"],
    ],
  );
  assert.equal(requests[0].init.headers.authorization, "Bearer short-lived-token");
  assert.deepEqual(JSON.parse(requests[3].init.body), {
    publishType: "DEFAULT_PUBLISH",
    blockOnWarnings: true,
  });
});

test("Chrome rejects a failed upload without publishing", async () => {
  let requests = 0;
  await assert.rejects(
    publishChrome({
      archive,
      accessToken: "token",
      publisherId: "publisher",
      itemId: "extension",
      fetchImpl: async () => {
        requests += 1;
        return json(200, { uploadState: "FAILED" });
      },
    }),
    /Chrome upload failed with state FAILED/,
  );
  assert.equal(requests, 1);
});

test("Edge uploads, polls, and publishes an existing product", async () => {
  const requests = [];
  const responses = [
    new Response("", { status: 202, headers: { location: "upload-operation" } }),
    json(200, { status: "InProgress" }),
    json(200, { status: "Succeeded" }),
    new Response("", {
      status: 202,
      headers: {
        location:
          "https://api.addons.microsoftedge.microsoft.com/v1/products/product-1/submissions/operations/publish-operation",
      },
    }),
    json(200, { status: "Succeeded", message: "submitted" }),
  ];
  const result = await publishEdge({
    archive,
    apiKey: "api-key",
    clientId: "client-id",
    productId: "product-1",
    notes: "Web Highlighter v0.1.0",
    delay: noDelay,
    poll: immediatePoll,
    fetchImpl: async (url, init = {}) => {
      requests.push({ url, init });
      return responses.shift();
    },
  });

  assert.equal(result.message, "submitted");
  assert.equal(requests[0].init.headers.authorization, "ApiKey api-key");
  assert.equal(requests[0].init.headers["x-clientid"], "client-id");
  assert.equal(requests[3].init.headers["content-type"], "text/plain; charset=utf-8");
  assert.equal(requests[3].init.body, "Web Highlighter v0.1.0");
  assert.deepEqual(
    requests.map(({ url, init }) => [init.method ?? "GET", new URL(url).pathname]),
    [
      ["POST", "/v1/products/product-1/submissions/draft/package"],
      ["GET", "/v1/products/product-1/submissions/draft/package/operations/upload-operation"],
      ["GET", "/v1/products/product-1/submissions/draft/package/operations/upload-operation"],
      ["POST", "/v1/products/product-1/submissions"],
      ["GET", "/v1/products/product-1/submissions/operations/publish-operation"],
    ],
  );
});

test("Edge rejects failed operations and untrusted operation locations", async () => {
  assert.throws(
    () => edgeOperationUrl("https://attacker.example/steal", "/v1/products/p/submissions"),
    /outside the expected API endpoint/,
  );
  assert.throws(
    () =>
      edgeOperationUrl(
        "https://api.addons.microsoftedge.microsoft.com/v1/other",
        "/v1/products/p/submissions",
      ),
    /outside the expected API endpoint/,
  );

  const responses = [
    new Response("", { status: 202, headers: { location: "operation" } }),
    json(200, { status: "Failed", errorCode: "PackageValidationError" }),
  ];
  await assert.rejects(
    publishEdge({
      archive,
      apiKey: "key",
      clientId: "client",
      productId: "product",
      notes: "notes",
      delay: noDelay,
      poll: immediatePoll,
      fetchImpl: async () => responses.shift(),
    }),
    /Edge operation failed: PackageValidationError/,
  );
});

test("store clients reject empty archives before making requests", async () => {
  const fetchImpl = () => assert.fail("network request should not start");
  await assert.rejects(
    publishChrome({
      archive: new Uint8Array(),
      accessToken: "token",
      publisherId: "publisher",
      itemId: "item",
      fetchImpl,
    }),
    /non-empty byte array/,
  );
  await assert.rejects(
    publishEdge({
      archive: new Uint8Array(),
      apiKey: "key",
      clientId: "client",
      productId: "product",
      notes: "notes",
      fetchImpl,
    }),
    /non-empty byte array/,
  );
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("runs garment generation in a persistent Cloudflare Queue", async () => {
  const [configText, apiSource, workerSource, contourSource] = await Promise.all([
    readFile(new URL("wrangler.json", root), "utf8"),
    readFile(new URL("worker/wardrobe-api.ts", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("worker/contour-cutout.ts", root), "utf8"),
  ]);
  const config = JSON.parse(configText);
  const producer = config.queues?.producers?.find((item) => item.binding === "GARMENT_JOBS");
  const consumer = config.queues?.consumers?.find((item) => item.queue === producer?.queue);

  assert.equal(producer?.queue, "forme-garment-jobs");
  assert.equal(consumer?.max_batch_timeout, 1);
  assert.equal(consumer?.max_retries, 5);
  assert.ok(consumer?.max_batch_size > 1, "batch messages should be consumed concurrently");
  assert.equal(config.limits, undefined, "free-plan deployment must not request a paid CPU override");
  assert.match(workerSource, /async queue\(batch: WardrobeQueueBatch/);
  assert.match(apiSource, /export async function handleGarmentQueue/);
  assert.match(apiSource, /IMAGE_GENERATION_TIMEOUT_MS = 3 \* 60 \* 1000/);
  assert.match(apiSource, /VISUAL_QA_TIMEOUT_MS = 45 \* 1000/);
  assert.match(apiSource, /AbortSignal\.timeout\(VISUAL_QA_TIMEOUT_MS\)/);
  assert.doesNotMatch(apiSource, /ctx\.waitUntil\(processGarment/);
  assert.match(apiSource, /generated_image_key = \?, generated_open_image_key = \?/);
  assert.doesNotMatch(apiSource, /const openJob = await createProcessingJob/);
  assert.doesNotMatch(apiSource, /MAX_BATCH_GARMENTS|value\.items\.slice\(0,\s*15\)/);
  assert.match(apiSource, /retryOrRejectCutouts/);
  assert.match(apiSource, /maskAttempt: maskAttempt \+ 1/);
  assert.match(apiSource, /error instanceof RetryableProcessingError \? 3 : 6/);
  assert.match(contourSource, /function contourCutoutPng|async function contourCutoutPng/);
  assert.match(contourSource, /if \(visited\[index\]\) data\[index \* 4 \+ 3\] = 0/);
  assert.match(apiSource, /reviewLayeringCutout/);
  assert.match(apiSource, /score >= 90/);
  assert.match(apiSource, /if \(error instanceof RetryableProcessingError\) throw error/);
  assert.match(contourSource, /planInteriorOpening/);
  assert.match(contourSource, /opaqueTransparencyPreview/);
  assert.doesNotMatch(contourSource, /clearPolygonAlpha|layeringCorridor/);
});

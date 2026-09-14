import assert from "node:assert/strict";
import test from "node:test";
import { parseAssetQrToken } from "./assetQrToken.ts";

test("parseAssetQrToken reads public URLs and raw tokens", () => {
  assert.equal(
    parseAssetQrToken("https://nexus.sadcpf.org/a/AbCdEfGhIjKlMnOpQrStUvWx"),
    "AbCdEfGhIjKlMnOpQrStUvWx",
  );
  assert.equal(parseAssetQrToken("/a/AbCdEfGhIjKlMnOpQrStUvWx"), "AbCdEfGhIjKlMnOpQrStUvWx");
  assert.equal(parseAssetQrToken("AbCdEfGhIjKlMnOpQrStUvWx"), "AbCdEfGhIjKlMnOpQrStUvWx");
  assert.equal(parseAssetQrToken("short"), null);
  assert.equal(parseAssetQrToken(""), null);
});

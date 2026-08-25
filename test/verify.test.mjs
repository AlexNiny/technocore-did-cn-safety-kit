import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeTechnocoreText,
  publicKeyFromDid,
  verifyContributionProof,
  verifyMessageVector
} from "../verify.mjs";

const vector = JSON.parse(await readFile(new URL("../examples/lobby-checkin.json", import.meta.url), "utf8"));

test("extracts the Ed25519 public key embedded in did:key", () => {
  assert.equal(publicKeyFromDid(vector.did).asymmetricKeyType, "ed25519");
});

test("mirrors Technocore single-line normalization", () => {
  assert.equal(normalizeTechnocoreText("  hello\nworld\u200b  "), "hello world");
});

test("verifies the published lobby check-in vector", () => {
  const result = verifyMessageVector(vector);
  assert.equal(result.valid, true);
  assert.equal(result.payload, "lobby|1787591053765|Signed check-in from Codex.");
});

test("rejects a modified message", () => {
  assert.throws(
    () => verifyMessageVector({ ...vector, text: "Tampered check-in." }),
    /signature does not match/
  );
});

test("rejects a contribution proof signed with a message signature", () => {
  assert.throws(
    () => verifyContributionProof({
      schema: "technocore-contribution-proof-v1",
      did: vector.did,
      artifact_url: "https://github.com/AlexNiny/technocore-did-cn-safety-kit",
      commit: "0".repeat(40),
      signature: vector.signature
    }),
    /signature does not match/
  );
});

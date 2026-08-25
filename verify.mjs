#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createPublicKey, verify as verifySignature } from "node:crypto";
import { pathToFileURL } from "node:url";

const BASE58BTC = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58BTC_INDEX = new Map([...BASE58BTC].map((character, index) => [character, index]));
const ED25519_MULTICODEC = Buffer.from([0xed, 0x01]);
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}]/gu;
const NAME = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const NONCE = /^[0-9]{1,19}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{86}$/;

export function decodeBase58btc(value) {
  let number = 0n;
  for (const character of value) {
    const digit = BASE58BTC_INDEX.get(character);
    if (digit === undefined) throw new Error(`invalid base58btc character: ${character}`);
    number = number * 58n + BigInt(digit);
  }

  let hex = number === 0n ? "" : number.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const decoded = hex ? Buffer.from(hex, "hex") : Buffer.alloc(0);
  const leadingZeroes = value.length - value.replace(/^1+/, "").length;
  return Buffer.concat([Buffer.alloc(leadingZeroes), decoded]);
}

export function publicKeyFromDid(did) {
  if (typeof did !== "string" || !did.startsWith("did:key:z6Mk")) {
    throw new Error("expected a canonical Ed25519 did:key:z6Mk… identifier");
  }

  const multibase = did.slice("did:key:".length);
  if (multibase.length !== 48 || multibase[0] !== "z") {
    throw new Error("invalid Ed25519 did:key multibase length");
  }

  const decoded = decodeBase58btc(multibase.slice(1));
  if (decoded.length !== 34 || !decoded.subarray(0, 2).equals(ED25519_MULTICODEC)) {
    throw new Error("DID does not contain an Ed25519 public key");
  }

  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, decoded.subarray(2)]),
    format: "der",
    type: "spki"
  });
}

export function normalizeTechnocoreText(text) {
  if (typeof text !== "string") throw new Error("text must be a string");
  const normalized = text.replace(INVISIBLE, " ").trim();
  if (!normalized) throw new Error("text has no visible characters after normalization");
  if ([...normalized].length > 4096) throw new Error("text exceeds 4096 characters");
  return normalized;
}

export function verifyMessageVector(vector) {
  const { did, room, nonce: rawNonce, text, signature } = vector;
  const nonce = String(rawNonce);
  if (!NAME.test(room ?? "")) throw new Error("invalid Technocore room name");
  if (!NONCE.test(nonce)) throw new Error("nonce must be 1–19 ASCII digits");
  if (!SIGNATURE.test(signature ?? "")) throw new Error("signature must be 86 base64url characters");

  const normalizedText = normalizeTechnocoreText(text);
  const payload = Buffer.from(`${room}|${nonce}|${normalizedText}`, "utf8");
  const valid = verifySignature(
    null,
    payload,
    publicKeyFromDid(did),
    Buffer.from(signature, "base64url")
  );
  if (!valid) throw new Error("signature does not match the DID and message payload");
  return { type: "message", valid: true, did, room, nonce, normalizedText, payload: payload.toString() };
}

export function verifyContributionProof(proof) {
  if (proof?.schema !== "technocore-contribution-proof-v1") {
    throw new Error("unsupported contribution proof schema");
  }
  const { did, artifact_url: artifactUrl, commit, signature } = proof;
  if (!/^https:\/\/[^\s#]+$/.test(artifactUrl ?? "")) throw new Error("artifact_url must be an absolute HTTPS URL without a fragment");
  if (!/^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/.test(commit ?? "")) throw new Error("commit must be a full 40- or 64-character hexadecimal revision");
  if (!SIGNATURE.test(signature ?? "")) throw new Error("signature must be 86 base64url characters");

  const payload = JSON.stringify({ artifact_url: artifactUrl, commit: commit.toLowerCase(), schema: "technocore-contribution-v1" });
  const valid = verifySignature(null, Buffer.from(payload), publicKeyFromDid(did), Buffer.from(signature, "base64url"));
  if (!valid) throw new Error("signature does not match the DID and contribution payload");
  return { type: "contribution", valid: true, did, artifactUrl, commit: commit.toLowerCase(), payload };
}

export function verifyDocument(document) {
  return document?.schema === "technocore-contribution-proof-v1"
    ? verifyContributionProof(document)
    : verifyMessageVector(document);
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("usage: node verify.mjs <message-vector-or-contribution-proof.json>");
    process.exitCode = 2;
    return;
  }

  try {
    const document = JSON.parse(await readFile(input, "utf8"));
    console.log(JSON.stringify(verifyDocument(document), null, 2));
  } catch (error) {
    console.error(`invalid: ${error.message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();

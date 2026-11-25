import { generateKeyPair, exportJWK, calculateJwkThumbprint, type JWK } from "jose";

/**
 * Generate an Ed25519 key pair for a site.
 * Keep `privateJwk` in your server env (never ship it to a browser).
 * Paste `publicJwk` into the dashboard when you register the site.
 */
export async function generateSiteKeys(): Promise<{ publicJwk: JWK; privateJwk: JWK }> {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
    crv: "Ed25519",
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);
  const kid = await calculateJwkThumbprint(publicJwk);
  Object.assign(publicJwk, { kid, alg: "EdDSA", use: "sig" });
  Object.assign(privateJwk, { kid, alg: "EdDSA", use: "sig" });
  return { publicJwk, privateJwk };
}

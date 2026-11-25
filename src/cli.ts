#!/usr/bin/env node
import { generateSiteKeys } from "./keys";

async function main() {
  const cmd = process.argv[2];
  if (cmd !== "keygen") {
    console.log("Usage: ow-sdk keygen");
    process.exit(cmd ? 1 : 0);
  }
  const { publicJwk, privateJwk } = await generateSiteKeys();
  console.log("PUBLIC key (paste into the dashboard when registering your site):\n");
  console.log(JSON.stringify(publicJwk));
  console.log("\nPRIVATE key (server env var OW_PRIVATE_JWK, never commit or expose it):\n");
  console.log(JSON.stringify(privateJwk));
}

main();

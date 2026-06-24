// Run this yourself from the InvoTrust repo root:
//
//   npm install genlayer-js@1.1.8
//   set DEPLOYER_PRIVATE_KEY=0xyourprivatekeyhere   (Windows cmd)
//   $env:DEPLOYER_PRIVATE_KEY="0xyourprivatekeyhere" (PowerShell)
//   node e2e/deploy-contract.mjs
//
// The key is read only from the environment variable you set in your own
// shell - this script never logs it and it never appears in any tool output.

import { createClient, createAccount, chains } from "genlayer-js";
import fs from "fs";

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!privateKey) {
  console.error("Set DEPLOYER_PRIVATE_KEY in your shell before running this script.");
  process.exit(1);
}

const account = createAccount(privateKey);
console.log("Deployer wallet address:", account.address);

const client = createClient({ chain: chains.studionet, account });

const contractCode = fs.readFileSync("genlayer/contracts/InvoiceValidator.py", "utf-8");

console.log("Deploying contract...");
const deployTxHash = await client.deployContract({
  code: contractCode,
  args: [],
});
console.log("Deploy tx hash:", deployTxHash);

console.log("Waiting for transaction receipt (this can take a while on StudioNet)...");
const receipt = await client.waitForTransactionReceipt({
  hash: deployTxHash,
  retries: 40,
  interval: 5000,
});

const newAddress =
  receipt.data?.contractAddress ??
  receipt.txDataDecoded?.contractAddress ??
  receipt.to_address ??
  receipt.recipient;

console.log("Receipt status:", receipt.status, "result:", receipt.result);
console.log("New contract address:", newAddress);

if (!newAddress) {
  console.log("Could not auto-extract the address. Full receipt below - look for a contract address field:");
  console.log(JSON.stringify(receipt, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
}

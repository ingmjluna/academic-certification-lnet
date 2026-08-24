"use strict";

/**
 * Despliega el contrato AcademicIdentity en LACNET.
 * Constructor: (string identityId, address initialOwner).
 *
 *   npm run deploy:identity
 *   node scripts/deploy-identity.js "IDENTITY-001" 0xOwner...
 *
 * Si no se pasan argumentos usa IDENTITY_ID del .env (o "IDENTITY-001")
 * y UNIVERSITY_ADDRESS (o la dirección del signer) como owner inicial.
 */

const { ContractFactory } = require("ethers");
const {
  getSigner,
  getNonce,
  loadArtifact,
  saveEnvValue,
  resolveDeployedAddress,
} = require("./lacchain");

async function main() {
  const { signer, provider, kmsAddress, originAddress } = await getSigner();
  const { abi, bytecode } = loadArtifact("AcademicIdentity");

  const identityId = process.argv[2] || process.env.IDENTITY_ID || "IDENTITY-001";
  const initialOwner =
    process.argv[3] ||
    process.env.IDENTITY_OWNER ||
    process.env.UNIVERSITY_ADDRESS ||
    originAddress;

  const nonce = await getNonce(provider);

  console.log("Desplegando AcademicIdentity...");
  console.log("  Origen (firma):", originAddress);
  console.log("  KMS address:   ", kmsAddress);
  console.log("  Nonce:         ", nonce);
  console.log("  identityId:    ", identityId);
  console.log("  initialOwner:  ", initialOwner);

  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(identityId, initialOwner, { nonce });

  const receipt = await contract.deploymentTransaction().wait();
  const address = await resolveDeployedAddress(provider, contract, receipt, originAddress);

  console.log("Contrato desplegado!");
  console.log("  AcademicIdentity:", address);
  console.log("  Tx hash:", receipt.hash);

  saveEnvValue("IDENTITY_CONTRACT_ADDRESS", address);
}

main().catch((err) => {
  console.error("Error desplegando AcademicIdentity:", err.message || err);
  process.exit(1);
});

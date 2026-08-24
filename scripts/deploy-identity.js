"use strict";

/**
 * Despliega el contrato AcademicIdentity en LACNET.
 * Constructor: (string identityId, address initialOwner).
 *
 *   npm run deploy:identity
 *   node scripts/deploy-identity.js "IDENTITY-001" 0xOwner...
 *
 * Si no se pasan argumentos usa IDENTITY_ID del .env (o "IDENTITY-001")
 * y la dirección del propio signer como owner inicial.
 */

const { ContractFactory } = require("ethers");
const { getSigner, loadArtifact, saveEnvValue } = require("./lacchain");

async function main() {
  const { signer } = getSigner();
  const { abi, bytecode } = loadArtifact("AcademicIdentity");

  const deployer = await signer.getAddress();
  const identityId = process.argv[2] || process.env.IDENTITY_ID || "IDENTITY-001";
  const initialOwner =
    process.argv[3] ||
    process.env.IDENTITY_OWNER ||
    process.env.UNIVERSITY_ADDRESS ||
    deployer;

  console.log("Desplegando AcademicIdentity...");
  console.log("  Deployer:    ", deployer);
  console.log("  identityId:  ", identityId);
  console.log("  initialOwner:", initialOwner);

  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(identityId, initialOwner);

  const receipt = await contract.deploymentTransaction().wait();
  const address = receipt.contractAddress;

  console.log("Contrato desplegado!");
  console.log("  AcademicIdentity:", address);
  console.log("  Tx hash:", receipt.hash);

  saveEnvValue("IDENTITY_CONTRACT_ADDRESS", address);
}

main().catch((err) => {
  console.error("Error desplegando AcademicIdentity:", err.message || err);
  process.exit(1);
});

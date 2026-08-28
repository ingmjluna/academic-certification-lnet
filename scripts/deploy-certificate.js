"use strict";

/**
 * Despliega el contrato AcademicCertificate (ERC-721 no transferible) en LACNET.
 *
 *   npm run deploy:certificate
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
  const { abi, bytecode } = loadArtifact("AcademicCertificate");

  const nonce = await getNonce(provider);

  console.log("Desplegando AcademicCertificate...");
  console.log("  Origen (firma):", originAddress);
  console.log("  KMS address:   ", kmsAddress);
  console.log("  Nonce:         ", nonce);

  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy({ nonce });

  const receipt = await contract.deploymentTransaction().wait();
  const address = await resolveDeployedAddress(provider, contract, receipt, originAddress);

  console.log("Contrato desplegado!");
  console.log("  AcademicCertificate:", address);
  console.log("  Tx hash:", receipt.hash);

  saveEnvValue("CERTIFICATE_CONTRACT_ADDRESS", address);
}

main().catch((err) => {
  console.error("Error desplegando AcademicCertificate:", err.message || err);
  process.exit(1);
});

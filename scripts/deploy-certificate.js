"use strict";

/**
 * Despliega el contrato AcademicCertificate (ERC-721 no transferible) en LACNET.
 * Reutiliza el bytecode/ABI compilado en Remix (carpeta abi/).
 *
 *   npm run deploy:certificate
 */

const { ContractFactory } = require("ethers");
const { getSigner, loadArtifact, saveEnvValue } = require("./lacchain");

async function main() {
  const { signer } = getSigner();
  const { abi, bytecode } = loadArtifact("AcademicCertificate");

  const deployer = await signer.getAddress();
  console.log("Desplegando AcademicCertificate...");
  console.log("  Deployer:", deployer);

  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();

  const receipt = await contract.deploymentTransaction().wait();
  const address = receipt.contractAddress;

  console.log("Contrato desplegado!");
  console.log("  AcademicCertificate:", address);
  console.log("  Tx hash:", receipt.hash);

  saveEnvValue("CERTIFICATE_CONTRACT_ADDRESS", address);
}

main().catch((err) => {
  console.error("Error desplegando AcademicCertificate:", err.message || err);
  process.exit(1);
});

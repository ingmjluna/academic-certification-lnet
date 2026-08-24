"use strict";

/**
 * Emite una credencial académica (mint del ERC-721) sobre un contrato
 * AcademicCertificate ya desplegado.
 *
 *   npm run issue
 *   node scripts/issue-credential.js <studentAddress> <ipfsCID> [credentialType]
 *
 * Si no se pasan argumentos usa STUDENT_ADDRESS, CREDENTIAL_IPFS_CID y
 * CREDENTIAL_TYPE del .env. El contrato se toma de CERTIFICATE_CONTRACT_ADDRESS.
 */

const { Contract } = require("ethers");
const { getSigner, getNonce, loadArtifact, requireEnv } = require("./lacchain");

async function main() {
  const { signer, provider } = await getSigner();
  const { abi } = loadArtifact("AcademicCertificate");

  const contractAddress = requireEnv("CERTIFICATE_CONTRACT_ADDRESS");
  const student = process.argv[2] || requireEnv("STUDENT_ADDRESS");
  const ipfsCID = process.argv[3] || requireEnv("CREDENTIAL_IPFS_CID");
  const credentialType =
    process.argv[4] || process.env.CREDENTIAL_TYPE || "AcademicCertificate";

  console.log("Emitiendo credencial...");
  console.log("  Contrato:", contractAddress);
  console.log("  Alumno:  ", student);
  console.log("  IPFS CID:", ipfsCID);
  console.log("  Tipo:    ", credentialType);

  const nonce = await getNonce(provider);
  const contract = new Contract(contractAddress, abi, signer);
  // gasLimit explícito + gasPrice 0: en el gas model todas las tx pasan por el
  // RelayHub, así que estimateGas (que simula una llamada directa) puede fallar
  // por el control de acceso. Lo salteamos.
  const tx = await contract.issueCredential(student, ipfsCID, credentialType, {
    nonce,
    gasLimit: 2000000,
    gasPrice: 0,
  });
  const receipt = await tx.wait();

  // Recuperamos el tokenId desde el evento CredentialIssued.
  let tokenId;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "CredentialIssued") {
        tokenId = parsed.args.tokenId.toString();
        break;
      }
    } catch {
      // log de otro contrato: se ignora.
    }
  }

  console.log("Credencial emitida!");
  console.log("  Tx hash: ", receipt.hash);
  console.log("  tokenId: ", tokenId ?? "(revisá los eventos de la tx)");
}

main().catch((err) => {
  console.error("Error emitiendo la credencial:", err.message || err);
  process.exit(1);
});

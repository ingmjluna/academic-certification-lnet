"use strict";

/**
 * Revoca una credencial académica ya emitida sobre un contrato
 * AcademicCertificate desplegado.
 *
 *   npm run revoke
 *   node scripts/revoke-credential.js <tokenId>
 *
 * Si no se pasa tokenId usa TOKEN_ID del .env.
 * El contrato se toma de CERTIFICATE_CONTRACT_ADDRESS.
 */

const { Contract } = require("ethers");
const { getSigner, getNonce, loadArtifact, requireEnv } = require("./lacchain");

async function main() {
  const { signer, provider } = await getSigner();
  const { abi } = loadArtifact("AcademicCertificate");

  const contractAddress = requireEnv("CERTIFICATE_CONTRACT_ADDRESS");
  const tokenId = process.argv[2] || process.env.TOKEN_ID || "1";

  console.log("Revocando credencial...");
  console.log("  Contrato:", contractAddress);
  console.log("  tokenId: ", tokenId);

  const nonce = await getNonce(provider);
  const contract = new Contract(contractAddress, abi, signer);
  // gasLimit explícito + gasPrice 0: en el gas model todas las tx pasan por el
  // RelayHub, así que estimateGas (que simula una llamada directa) puede fallar
  // por el control de acceso. Lo salteamos.
  const tx = await contract.revokeCredential(tokenId, {
    nonce,
    gasLimit: 2000000,
    gasPrice: 0,
  });
  const receipt = await tx.wait();

  // Confirmamos con el evento CredentialRevoked.
  let revokedAt;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "CredentialRevoked") {
        revokedAt = parsed.args.revokedAt.toString();
        break;
      }
    } catch {
      // log de otro contrato: se ignora.
    }
  }

  console.log("Credencial revocada!");
  console.log("  Tx hash:   ", receipt.hash);
  if (revokedAt) {
    console.log(
      "  Revocada el:",
      new Date(Number(revokedAt) * 1000).toISOString()
    );
  }
}

main().catch((err) => {
  console.error("Error revocando la credencial:", err.message || err);
  process.exit(1);
});

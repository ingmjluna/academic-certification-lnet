"use strict";

/**
 * Verifica una credencial académica leyendo el contrato AcademicCertificate.
 * Es de solo lectura: NO requiere clave privada ni firma.
 *
 *   npm run verify
 *   node scripts/verify-credential.js <tokenId>
 *
 * Si no se pasa tokenId usa TOKEN_ID del .env.
 * El contrato se toma de CERTIFICATE_CONTRACT_ADDRESS.
 */

const { Contract } = require("ethers");
const { getProvider, loadArtifact, requireEnv } = require("./lacchain");

async function main() {
  const provider = getProvider();
  const { abi } = loadArtifact("AcademicCertificate");

  const contractAddress = requireEnv("CERTIFICATE_CONTRACT_ADDRESS");
  const tokenId = process.argv[2] || process.env.TOKEN_ID || "1";

  console.log("Verificando credencial...");
  console.log("  Contrato:", contractAddress);
  console.log("  tokenId: ", tokenId);

  const contract = new Contract(contractAddress, abi, provider);

  const valid = await contract.isValid(tokenId);
  const [ipfsCID, credentialType, issuedAt, revoked] =
    await contract.getCredential(tokenId);
  const owner = await contract.ownerOf(tokenId);
  const uri = await contract.tokenURI(tokenId);

  console.log("Resultado:");
  console.log("  Válida:        ", valid);
  console.log("  Revocada:      ", revoked);
  console.log("  Titular:       ", owner);
  console.log("  Tipo:          ", credentialType);
  console.log("  IPFS CID:      ", ipfsCID);
  console.log("  tokenURI:      ", uri);
  console.log(
    "  Emitida el:    ",
    new Date(Number(issuedAt) * 1000).toISOString()
  );
}

main().catch((err) => {
  console.error("Error verificando la credencial:", err.message || err);
  process.exit(1);
});

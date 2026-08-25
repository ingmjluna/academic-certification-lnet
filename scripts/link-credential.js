"use strict";

/**
 * Vincula una credencial (tokenId del AcademicCertificate) a un contrato
 * AcademicIdentity desplegado, y lista las credenciales vinculadas.
 *
 *   npm run link
 *   node scripts/link-credential.js <tokenId>
 *
 * Si no se pasa tokenId usa TOKEN_ID del .env.
 * El contrato se toma de IDENTITY_CONTRACT_ADDRESS.
 *
 * Nota (prototipo): linkCredential es onlyOwner. Como todo pasa por el
 * RelayHub, la identidad debe haberse desplegado con el RelayHub como owner
 * (comportamiento por defecto de deploy-identity.js).
 */

const { Contract } = require("ethers");
const { getSigner, getNonce, loadArtifact, requireEnv } = require("./lacchain");

async function main() {
  const { signer, provider } = await getSigner();
  const { abi } = loadArtifact("AcademicIdentity");

  const identityAddress = requireEnv("IDENTITY_CONTRACT_ADDRESS");
  const tokenId = process.argv[2] || process.env.TOKEN_ID || "1";

  console.log("Vinculando credencial a la identidad...");
  console.log("  Identidad:", identityAddress);
  console.log("  tokenId:  ", tokenId);

  const nonce = await getNonce(provider);
  const identity = new Contract(identityAddress, abi, signer);
  // gasLimit explícito + gasPrice 0 para saltear estimateGas (gas model).
  const tx = await identity.linkCredential(tokenId, {
    nonce,
    gasLimit: 2000000,
    gasPrice: 0,
  });
  const receipt = await tx.wait();

  console.log("Credencial vinculada!");
  console.log("  Tx hash:", receipt.hash);

  const count = await identity.credentialCount();
  const list = await identity.getCredentials();
  console.log("  Total vinculadas:", count.toString());
  console.log("  tokenIds:", list.map((n) => n.toString()).join(", "));
}

main().catch((err) => {
  console.error("Error vinculando la credencial:", err.message || err);
  process.exit(1);
});

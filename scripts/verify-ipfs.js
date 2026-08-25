"use strict";

/**
 * Prueba de resolución IPFS end-to-end para una credencial:
 *
 *   ERC-721 tokenId
 *     -> tokenURI()            (on-chain)
 *     -> ipfs://<metadataCID>  -> credential.json
 *     -> campo "document"
 *     -> ipfs://<documentCID>  -> Certificado (PDF)
 *
 * Uso:
 *   npm run verify:ipfs
 *   node scripts/verify-ipfs.js <tokenId>
 *
 * Gateway configurable con IPFS_GATEWAY (por defecto Pinata).
 * El contrato se toma de CERTIFICATE_CONTRACT_ADDRESS.
 */

const { Contract } = require("ethers");
const axios = require("axios");
const { getProvider, loadArtifact, requireEnv } = require("./lacchain");

const GATEWAY = (process.env.IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs").replace(/\/+$/, "");

/** Convierte ipfs://<cid>[/path] a una URL HTTP del gateway. */
function toHttp(ipfsUri) {
  const path = ipfsUri.replace(/^ipfs:\/\//, "");
  return `${GATEWAY}/${path}`;
}

async function main() {
  const provider = getProvider();
  const { abi } = loadArtifact("AcademicCertificate");
  const contractAddress = requireEnv("CERTIFICATE_CONTRACT_ADDRESS");
  const tokenId = process.argv[2] || process.env.TOKEN_ID || "1";

  const contract = new Contract(contractAddress, abi, provider);

  console.log("Resolución IPFS de la credencial");
  console.log("  Contrato:", contractAddress);
  console.log("  tokenId: ", tokenId);
  console.log("  Gateway: ", GATEWAY);
  console.log();

  // 1) tokenURI on-chain
  const tokenUri = await contract.tokenURI(tokenId);
  console.log("1) tokenURI():", tokenUri);
  if (!tokenUri.startsWith("ipfs://")) {
    console.warn("   Aviso: el tokenURI no es un ipfs:// URI.");
  }

  // 2) credential.json (metadata)
  const metaUrl = toHttp(tokenUri);
  console.log("2) GET", metaUrl);
  const metaRes = await axios.get(metaUrl, { timeout: 40000 });
  const meta = metaRes.data;
  console.log("   name:       ", meta.name);
  console.log("   credentialType:", meta.credentialType);
  console.log("   issuer:     ", meta.issuer && meta.issuer.name);
  console.log("   subject:    ", meta.credentialSubject && meta.credentialSubject.name);
  console.log("   document:   ", meta.document);

  if (!meta.document || !meta.document.startsWith("ipfs://")) {
    throw new Error('El credential.json no tiene un campo "document" ipfs:// válido.');
  }

  // 3) document (PDF u otro binario)
  const docUrl = toHttp(meta.document);
  console.log("3) GET", docUrl);
  const docRes = await axios.get(docUrl, {
    timeout: 40000,
    responseType: "arraybuffer",
  });
  const bytes = Buffer.from(docRes.data);
  const magic = bytes.slice(0, 5).toString("latin1");
  console.log("   content-type:", docRes.headers["content-type"]);
  console.log("   tamaño:      ", bytes.length, "bytes");
  console.log("   ¿es PDF?:    ", magic.startsWith("%PDF") ? "sí (" + magic + ")" : "no (" + magic + ")");

  console.log();
  console.log("Cadena IPFS resuelta correctamente: tokenURI -> credential.json -> document.");
}

main().catch((err) => {
  const detail = err.response ? `HTTP ${err.response.status}` : err.message || err;
  console.error("Error resolviendo IPFS:", detail);
  process.exit(1);
});

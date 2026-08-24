"use strict";

/**
 * Utilidades para conectarse a LACNET / LNet a través de NaaS
 * (Node as a Service) usando el "gas model" de la red.
 *
 * Flujo de conexión (según el ejemplo oficial de LACNET):
 *   1. Login en el backend NaaS (usuario/contraseña) -> access_token.
 *   2. El access_token se inyecta como header `Authorization: Bearer` en
 *      TODAS las llamadas RPC (parcheando FetchRequest.prototype.send).
 *   3. Se obtiene la dirección KMS del usuario (GET /api/user/kms-id).
 *   4. Se firma con LACNET_PRIVATE_KEY + la KMS address + una expiración (ms).
 *
 * Toda la configuración se lee del archivo .env (ver .env.example).
 * Ref: https://gitlab.com/lacnet/lacnet-naas/ethers-send-tx-example
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { ethers, FetchRequest } = require("ethers");
const { LacchainProvider, LacchainSigner } = require("@lacchain/gas-model-provider");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_API_URL = "https://naas.lacnet.com";

/** Lanza un error legible si falta una variable de entorno obligatoria. */
function requireEnv(name) {
  const value = process.env[name];
  if (!value || String(value).trim() === "") {
    throw new Error(
      `Falta la variable de entorno ${name}. Copiá .env.example a .env y completala.`
    );
  }
  return String(value).trim();
}

/** URL base del backend NaaS (sin barra final). */
function apiBaseUrl() {
  return (process.env.LACNET_NAAS_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
}

/** Normaliza la clave privada al formato 0x-hex. */
function normalizePrivateKey(pk) {
  const clean = pk.trim().replace(/^0x/, "");
  return `0x${clean}`;
}

// --- Token de acceso NaaS (con cache simple en memoria) ---
let _tokenCache = { value: null, expiresAt: 0 };

async function getAccessToken() {
  if (_tokenCache.value && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.value;
  }
  const username = requireEnv("LACNET_NAAS_USER");
  const password = requireEnv("LACNET_NAAS_PASSWORD");

  const res = await axios.post(`${apiBaseUrl()}/api/auth/login`, {
    username,
    password,
  });
  const token = res.data && res.data.access_token;
  if (!token) throw new Error("El backend NaaS no devolvió un access_token.");

  // Cache por 4 minutos (los tokens suelen durar más; se refresca por las dudas).
  _tokenCache = { value: token, expiresAt: Date.now() + 4 * 60 * 1000 };
  return token;
}

/** Obtiene la dirección KMS asociada al usuario NaaS. */
async function getKmsAddress(token) {
  const res = await axios.get(`${apiBaseUrl()}/api/user/kms-id`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const address = res.data && res.data.address;
  if (!address) throw new Error("El backend NaaS no devolvió la dirección KMS.");
  return address;
}

/**
 * Parchea FetchRequest para adjuntar el token Bearer en cada request RPC.
 * Se instala una única vez por proceso.
 */
let _interceptorInstalled = false;
function installAuthInterceptor() {
  if (_interceptorInstalled) return;
  const originalSend = FetchRequest.prototype.send;
  FetchRequest.prototype.send = async function () {
    try {
      const token = await getAccessToken();
      this.setHeader("Authorization", `Bearer ${token}`);
    } catch (err) {
      console.error("No se pudo obtener el token NaaS:", err.message || err);
      throw err;
    }
    return originalSend.call(this);
  };
  _interceptorInstalled = true;
}

/** Milisegundos de expiración para el gas model (por defecto 5 min). */
function expirationMs() {
  const seconds = Number(process.env.LACNET_TX_EXPIRATION_SECONDS || 300);
  return Date.now() + seconds * 1000;
}

/**
 * Provider de solo lectura (autenticado vía Bearer) para llamadas `view`.
 * No requiere clave privada.
 */
function getProvider() {
  installAuthInterceptor();
  return new LacchainProvider(requireEnv("LACNET_RPC_URL"));
}

/**
 * Crea un LacchainSigner listo para desplegar / invocar contratos.
 * Devuelve además el provider y la KMS address usada.
 */
async function getSigner() {
  installAuthInterceptor();

  const privateKey = normalizePrivateKey(requireEnv("LACNET_PRIVATE_KEY"));
  const token = await getAccessToken();

  // La KMS address es autoritativa; LACNET_NODE_ADDRESS la sobreescribe si está.
  const override = (process.env.LACNET_NODE_ADDRESS || "").trim();
  const kmsAddress = override || (await getKmsAddress(token));

  const provider = new LacchainProvider(requireEnv("LACNET_RPC_URL"));
  const signer = new LacchainSigner(
    privateKey,
    provider,
    kmsAddress,
    expirationMs()
  );

  // Aviso de coherencia con UNIVERSITY_ADDRESS.
  const expected = (process.env.UNIVERSITY_ADDRESS || "").trim();
  const origin = ethers.computeAddress(privateKey);
  if (expected && expected.toLowerCase() !== origin.toLowerCase()) {
    console.warn(
      `Aviso: UNIVERSITY_ADDRESS (${expected}) no coincide con la clave privada (${origin}).`
    );
  }

  return { signer, provider, kmsAddress, originAddress: origin };
}

/** Nonce actual de la cuenta que firma (origen de la transacción). */
async function getNonce(provider) {
  const origin = ethers.computeAddress(
    normalizePrivateKey(requireEnv("LACNET_PRIVATE_KEY"))
  );
  return provider.getTransactionCount(origin, "latest");
}

/**
 * Resuelve la dirección de un contrato recién desplegado y verifica que
 * realmente tenga bytecode. En el gas model de LACNET, si la cuenta que firma
 * no está permisionada (sin bucket de gas), la meta-transacción se relaya con
 * status 1 pero el contrato NO se crea: acá lo detectamos y avisamos.
 */
async function resolveDeployedAddress(provider, contract, receipt, originAddress) {
  let address = receipt && receipt.contractAddress;
  if (!address || address === ethers.ZeroAddress) {
    address = await contract.getAddress();
  }

  const code = await provider.getCode(address);
  if (code === "0x") {
    throw new Error(
      "La transacción se relayó pero NO se desplegó ningún contrato " +
        `(sin bytecode en ${address}).\n` +
        `Causa habitual: la cuenta firmante ${originAddress} no está ` +
        "permisionada en LACNET o no tiene bucket de gas asignado. " +
        "Pedí a soporte de LNet que permisione esa dirección para la red destino."
    );
  }
  return address;
}

/** Carga { abi, bytecode } desde la carpeta versionada abi/. */
function loadArtifact(contractName) {
  const file = path.join(ROOT, "abi", `${contractName}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`No se encontró el artifact ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Persiste un valor en el .env local (reemplaza la línea VARIABLE= si existe,
 * o la agrega al final).
 */
function saveEnvValue(key, value) {
  const envPath = path.join(ROOT, ".env");
  let content = "";
  try {
    content = fs.readFileSync(envPath, "utf8");
  } catch {
    // .env inexistente: se crea desde cero.
  }

  const line = `${key}=${value}`;
  const regex = new RegExp(`^${key}=.*$`, "m");

  content = regex.test(content)
    ? content.replace(regex, line)
    : `${content.replace(/\s*$/, "")}\n${line}\n`;

  fs.writeFileSync(envPath, content);
  console.log(`> ${key} guardado en .env`);
}

module.exports = {
  ROOT,
  requireEnv,
  getAccessToken,
  getKmsAddress,
  getProvider,
  getSigner,
  getNonce,
  resolveDeployedAddress,
  loadArtifact,
  saveEnvValue,
};

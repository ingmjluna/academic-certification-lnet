"use strict";

/**
 * Utilidades compartidas para conectarse a LACNET / LNet (NaaS) usando el
 * "gas model" de la red (gas price 0 + firma vía nodo permisionado).
 *
 * Toda la configuración se lee del archivo .env (ver .env.example).
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { LacchainProvider, LacchainSigner } = require("@lacchain/gas-model-provider");

const ROOT = path.resolve(__dirname, "..");

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

/**
 * Construye la URL del RPC embebiendo las credenciales NaaS como Basic Auth
 * cuando están presentes (https://usuario:password@host/rpc).
 */
function buildRpcUrl() {
  const rawUrl = requireEnv("LACNET_RPC_URL");
  const user = process.env.LACNET_NAAS_USER;
  const password = process.env.LACNET_NAAS_PASSWORD;

  if (!user || !password) return rawUrl;

  const url = new URL(rawUrl);
  url.username = encodeURIComponent(user);
  url.password = encodeURIComponent(password);
  return url.toString();
}

/**
 * Crea un LacchainSigner listo para desplegar / invocar contratos.
 * El signer firma localmente con LACNET_PRIVATE_KEY y adjunta el nodeAddress
 * y la expiración que exige el gas model de LACNET.
 */
function getSigner() {
  const privateKey = requireEnv("LACNET_PRIVATE_KEY");
  const nodeAddress = requireEnv("LACNET_NODE_ADDRESS");

  const expirationSeconds = Number(
    process.env.LACNET_TX_EXPIRATION_SECONDS || 1800
  );
  const expiration = Math.floor(Date.now() / 1000) + expirationSeconds;

  const provider = new LacchainProvider(buildRpcUrl());
  const signer = new LacchainSigner(
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`,
    provider,
    nodeAddress,
    expiration
  );

  return { signer, provider, expiration };
}

/**
 * Provider de solo lectura (no requiere clave privada) para hacer llamadas
 * `view` como getCredential / isValid.
 */
function getProvider() {
  return new LacchainProvider(buildRpcUrl());
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
 * Persiste la dirección de un contrato desplegado en el .env local
 * (reemplaza la línea VARIABLE= si existe, o la agrega al final).
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
  buildRpcUrl,
  getSigner,
  getProvider,
  loadArtifact,
  saveEnvValue,
};

"use strict";

/**
 * Copia el { abi, bytecode } de los artifacts de Hardhat (carpeta artifacts/,
 * ignorada por git) a la carpeta versionada abi/, que es la que consumen los
 * scripts de despliegue.
 *
 * Se ejecuta automáticamente con `npm run compile`.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONTRACTS = ["AcademicCertificate", "AcademicIdentity"];

for (const name of CONTRACTS) {
  const artifactPath = path.join(
    ROOT,
    "artifacts",
    "contracts",
    `${name}.sol`,
    `${name}.json`
  );

  if (!fs.existsSync(artifactPath)) {
    console.error(`No se encontró el artifact ${artifactPath}. ¿Compilaste?`);
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const out = {
    contractName: name,
    abi: artifact.abi,
    bytecode: artifact.bytecode,
  };
  fs.writeFileSync(
    path.join(ROOT, "abi", `${name}.json`),
    JSON.stringify(out, null, 2)
  );
  console.log(`abi/${name}.json actualizado (bytecode ${((artifact.bytecode.length - 2) / 2) | 0} bytes)`);
}

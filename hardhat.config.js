require("dotenv").config();

/**
 * Configuración de compilación para LACNET / LNet.
 *
 * IMPORTANTE: evmVersion = "paris".
 * La red Besu de LACChain (testnet) no soporta el opcode PUSH0 (introducido en
 * "shanghai") ni opcodes posteriores. Compilar con "paris" evita PUSH0 y hace
 * que el bytecode sea desplegable. Con targets más nuevos (shanghai/cancun/
 * prague) el CREATE revierte silenciosamente en el gas model.
 */
module.exports = {
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
    cache: "./cache",
  },
};

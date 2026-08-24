# academic-certification-lnet

Proyecto Node.js para **desplegar y gestionar credenciales académicas** sobre la
red **LACNET / LNet** (entorno NaaS de testnet) reutilizando el **bytecode/ABI**
ya compilado en Remix.

Incluye dos contratos:

- **`AcademicCertificate`** — ERC-721 **no transferible** (soulbound) con control
  de acceso por roles (`ISSUER_ROLE`). Cada token representa una credencial
  académica que apunta a un documento en IPFS.
- **`AcademicIdentity`** — contrato `Ownable` que agrupa (vincula) los tokenIds
  de las credenciales de una identidad.

El despliegue usa el **gas model de LACNET** (gas price 0) a través de
[`@lacchain/gas-model-provider`](https://github.com/lacchain/gas-model-provider),
siguiendo el flujo oficial de **NaaS (Node as a Service)**
([ejemplo LACNET](https://gitlab.com/lacnet/lacnet-naas/ethers-send-tx-example)):

1. Login en el backend NaaS (usuario/contraseña) → `access_token`.
2. El token se inyecta como header `Authorization: Bearer` en cada llamada RPC.
3. Se obtiene la **KMS address** del usuario (`GET /api/user/kms-id`).
4. Se firma con `LACNET_PRIVATE_KEY` + la KMS address + una expiración, y se
   envía la transacción con un nonce explícito.

## Estructura

```
academic-certification-lnet/
├── abi/                      # ABI + bytecode versionado (reutilizado por los scripts)
│   ├── AcademicCertificate.json
│   └── AcademicIdentity.json
├── contracts/
│   ├── AcademicCertificate.sol
│   └── AcademicIdentity.sol
├── scripts/
│   ├── lacchain.js           # helper: provider/signer + carga de artifacts
│   ├── sync-abi.js           # copia abi+bytecode de artifacts/ a abi/
│   ├── deploy-certificate.js
│   ├── deploy-identity.js
│   ├── issue-credential.js
│   └── verify-credential.js
├── metadata/
│   └── credential.json       # ejemplo de metadatos de credencial
├── hardhat.config.js         # compila con evmVersion "paris" (ver más abajo)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

> ⚠️ **EVM target obligatorio: `paris`.** La red Besu de LACChain (testnet) no
> soporta el opcode `PUSH0` (introducido en "shanghai") ni opcodes posteriores.
> Si compilás con un target más nuevo (shanghai/cancun/prague, que es el
> **default de Solidity ≥ 0.8.20 / Remix**), el bytecode contiene `PUSH0` y el
> despliegue **revierte silenciosamente** (la meta-tx se relaya con status 1
> pero no se crea el contrato). Por eso `hardhat.config.js` fija
> `evmVersion: "paris"`. **No reutilices bytecode compilado en Remix con el
> target por defecto.**

> `artifacts/` y `cache/` (salidas de compilación de Remix/Hardhat) están en
> `.gitignore`. Por eso el ABI y el bytecode que necesitan los scripts se
> guardan versionados en `abi/`.

## Requisitos previos

- **Node.js >= 18**
- Una cuenta **permisionada** en LACNET/LNet (dirección + clave privada).
- Credenciales de una **cuenta NaaS** (email/contraseña) con acceso al RPC.
  La KMS address se obtiene automáticamente del backend NaaS.

## Configuración

1. Instalá dependencias:

   ```bash
   npm install
   ```

2. Copiá el ejemplo de entorno y completá tus valores **privados**:

   ```bash
   cp .env.example .env
   ```

   | Variable | Descripción |
   |---|---|
   | `LACNET_NAAS_USER` / `LACNET_NAAS_PASSWORD` | Email + contraseña de tu cuenta NaaS (login que genera el `access_token`). |
   | `LACNET_NAAS_API_URL` | Backend NaaS (`https://naas.lacnet.com`). |
   | `LACNET_RPC_URL` | RPC del NaaS (`https://testnet-naas.lacnet.com/rpc`). |
   | `LACNET_CHAIN_ID` | `648539` para la testnet NaaS. |
   | `LACNET_NODE_ADDRESS` | **Opcional.** Si se deja vacío, la KMS address se obtiene automáticamente de NaaS. Solo completar para forzar una dirección. |
   | `LACNET_PRIVATE_KEY` | Clave privada de la cuenta que firma/despliega. **Debe estar permisionada en LACNET (con bucket de gas)**, si no la tx se relaya pero no se ejecuta. **Nunca subir.** |
   | `LACNET_TX_EXPIRATION_SECONDS` | Validez de la tx en el gas model (por defecto 300 = 5 min). |
   | `CERTIFICATE_CONTRACT_ADDRESS` / `IDENTITY_CONTRACT_ADDRESS` | Se completan solas al desplegar; las usan issue/verify. |
   | `STUDENT_ADDRESS`, `CREDENTIAL_IPFS_CID`, `CREDENTIAL_TYPE`, `TOKEN_ID` | Valores por defecto para emitir/verificar. |

   > **El `.env` real nunca se sube a GitHub** (está en `.gitignore`). Solo se
   > versiona `.env.example`.

3. (Opcional) Recompilá los contratos con el target correcto. Ya hay un `abi/`
   versionado y listo, pero si modificás los `.sol`:

   ```bash
   npm run compile   # hardhat compile (evmVersion paris) + sync-abi
   ```

## Uso

### Desplegar los contratos

```bash
npm run deploy:certificate    # despliega AcademicCertificate y guarda CERTIFICATE_CONTRACT_ADDRESS en .env
npm run deploy:identity       # despliega AcademicIdentity (identityId, owner) y guarda IDENTITY_CONTRACT_ADDRESS
```

`deploy:identity` acepta argumentos opcionales:

```bash
node scripts/deploy-identity.js "IDENTITY-001" 0xOwnerAddress...
```

### Emitir una credencial (mint)

```bash
npm run issue
# o con argumentos explícitos:
node scripts/issue-credential.js 0xAlumno... <ipfsCID> AcademicCertificate
```

Imprime el `tokenId` obtenido del evento `CredentialIssued`.

### Verificar una credencial (solo lectura, sin clave privada)

```bash
npm run verify
# o:
node scripts/verify-credential.js <tokenId>
```

Muestra si la credencial es válida, su titular, tipo, CID de IPFS, `tokenURI`
y la fecha de emisión.

## Recompilar / actualizar el ABI

Si modificás los `.sol`, recompilá con `npm run compile`. Esto ejecuta
`hardhat compile` (con `evmVersion: "paris"`, ver `hardhat.config.js`) y luego
`scripts/sync-abi.js`, que copia el `abi` + `bytecode` a la carpeta versionada
`abi/`. **No compiles en Remix con el target por defecto** (genera `PUSH0` y no
despliega). Se usa OpenZeppelin `5.0.2` a propósito: versiones más nuevas usan
el opcode `mcopy` (Cancun), incompatible con `paris`.

## Nota sobre el prototipo (control de acceso vía relay)

En el gas model **todas** las transacciones pasan por el RelayHub, así que
dentro del contrato `msg.sender` es el RelayHub, no la universidad. Como
`AcademicCertificate`/`AcademicIdentity` usan OpenZeppelin (`msg.sender`), al
desplegar por el relay el `ISSUER_ROLE`/`owner` quedan asignados al **RelayHub**.
Por eso `issue-credential.js` envía la tx con `gasLimit` explícito (para saltear
`estimateGas`, que simula una llamada directa y falla el control de acceso).
Funciona para una demo, pero **no es seguro para producción**: para eso hay que
hacer los contratos *relay-aware* (patrón `BaseRelayRecipient` + `_msgSender()`)
o asignar el rol/owner por parámetro del constructor.

## Seguridad

- No compartas ni commitees `LACNET_PRIVATE_KEY` ni `LACNET_NAAS_PASSWORD`.
- Revisá que `.env` esté siempre ignorado antes de hacer `git add`.

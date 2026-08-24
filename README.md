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
│   ├── deploy-certificate.js
│   ├── deploy-identity.js
│   ├── issue-credential.js
│   └── verify-credential.js
├── metadata/
│   └── credential.json       # ejemplo de metadatos de credencial
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

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
   | `LACNET_PRIVATE_KEY` | Clave privada de la cuenta que firma/despliega. **Nunca subir.** |
   | `LACNET_TX_EXPIRATION_SECONDS` | Validez de la tx en el gas model (por defecto 300 = 5 min). |
   | `CERTIFICATE_CONTRACT_ADDRESS` / `IDENTITY_CONTRACT_ADDRESS` | Se completan solas al desplegar; las usan issue/verify. |
   | `STUDENT_ADDRESS`, `CREDENTIAL_IPFS_CID`, `CREDENTIAL_TYPE`, `TOKEN_ID` | Valores por defecto para emitir/verificar. |

   > **El `.env` real nunca se sube a GitHub** (está en `.gitignore`). Solo se
   > versiona `.env.example`.

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

Si modificás los contratos, recompilalos (Remix o Hardhat) y regenerá los
archivos de `abi/` con el nuevo `abi` y `bytecode` (campo `data.bytecode.object`
en los artifacts de Remix) para que los scripts usen el bytecode actualizado.

## Seguridad

- No compartas ni commitees `LACNET_PRIVATE_KEY` ni `LACNET_NAAS_PASSWORD`.
- Revisá que `.env` esté siempre ignorado antes de hacer `git add`.

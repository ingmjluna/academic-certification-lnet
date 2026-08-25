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
│   ├── revoke-credential.js
│   ├── link-credential.js
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

### Revocar una credencial

```bash
npm run revoke
# o:
node scripts/revoke-credential.js <tokenId>
```

Marca la credencial como revocada (evento `CredentialRevoked`). Tras revocar,
`verify` mostrará `Válida: false` / `Revocada: true`.

### Vincular una credencial a una identidad

```bash
npm run link
# o:
node scripts/link-credential.js <tokenId>
```

Llama a `AcademicIdentity.linkCredential(tokenId)` y lista las credenciales
vinculadas (`getCredentials` / `credentialCount`).

> `linkCredential` es `onlyOwner`. En el gas model el `msg.sender` es el
> RelayHub, por eso `deploy-identity.js` usa el RelayHub como owner por defecto
> (si no, la vinculación vía NaaS no sería invocable). Es una decisión propia
> del prototipo; en producción se resuelve con contratos *relay-aware*.

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

## El modelo de gas de LNET y el RelayHub (fundamento)

### 1. Redes públicas permisionadas sin comisiones

LNET (antes LACChain) opera una red pública permisionada basada en Hyperledger
Besu en la que **el precio del gas es cero** (`gasPrice = 0`). Eliminar las
comisiones evita la especulación con una criptomoneda nativa, pero reintroduce
el problema que las comisiones resolvían: **prevenir el abuso de recursos**
(spam, denegación de servicio). Para ello, LNET no permite que una cuenta
cualquiera escriba directamente en la cadena, sino que impone un **modelo de
gas** en el que toda transacción es intermediada y contabilizada por un conjunto
de contratos de sistema.

### 2. Meta-transacciones y el RelayHub

El componente central de ese modelo es el **RelayHub** (en esta testnet,
`0xB9e9C5C528C266f2A1C7Eeec1975595232C8E475`). El flujo es el de una
**meta-transacción**:

1. La aplicación firma la intención de transacción con su clave privada
   (`LACNET_PRIVATE_KEY`) e indica el nodo escritor y una expiración.
2. Un **nodo permisionado** (identificado por su KMS address) reenvía esa
   transacción al **RelayHub**, que verifica permisos y cupo de gas del emisor.
3. El RelayHub ejecuta la llamada al contrato destino **en nombre** del emisor.

La consecuencia técnica fundamental es que, **dentro del contrato invocado, la
variable `msg.sender` no es la cuenta de la universidad, sino la dirección del
RelayHub**, porque es el RelayHub quien realiza la llamada final. Todas las
transacciones de todos los usuarios que operan por el mismo relay comparten ese
`msg.sender`.

Para recuperar el emisor original, LNET provee un **trusted forwarder**
(`0xa4B5eE2906090ce2cDbf5dfff944db26f397037D`), que expone `getRelayHub()` y
`getMsgSender()`. Un contrato *relay-aware* (patrón `BaseRelayRecipient`)
sustituye `msg.sender` por `_msgSender()`, que consulta al forwarder y devuelve
la cuenta real. Los contratos de este repositorio, al basarse en OpenZeppelin
(que usa `msg.sender` vía `Context`), **no** implementan ese patrón (ver §4).

### 3. La particularidad sobre `AcademicIdentity`

`AcademicIdentity` hereda de `Ownable` y protege `linkCredential(tokenId)` con
el modificador `onlyOwner`, que internamente compara `owner()` contra
`msg.sender`. Aquí aparece la particularidad del modelo de gas:

- Si se despliega la identidad asignando como `owner` a la cuenta de la
  universidad (`0x8147…`), la comprobación `onlyOwner` **nunca se satisface a
  través del NaaS**, porque en tiempo de ejecución `msg.sender` es el RelayHub,
  no la universidad. La vinculación resultaría permanentemente inaccesible.
- Existe además una asimetría con la estimación de gas: `eth_estimateGas`
  simula una llamada **directa** desde la cuenta firmante (`from = 0x8147…`),
  que *sí* pasaría `onlyOwner`; por eso la estimación tiene éxito aunque la
  transacción real (vía RelayHub) revertiría. Para evitar ese falso positivo,
  los scripts envían la transacción con `gasLimit` explícito, omitiendo la
  estimación.

**Decisión de diseño (prototipo):** para que la vinculación sea operativa a
través del NaaS, `deploy-identity.js` asigna como `owner` **al propio RelayHub**
(obtenido dinámicamente con `getRelayHub()`). De este modo, cuando el RelayHub
ejecuta `linkCredential`, se cumple `msg.sender == owner()` y la operación es
válida. La misma lógica explica por qué `AcademicCertificate` funciona sin
reconfiguración: su constructor concede `DEFAULT_ADMIN_ROLE` e `ISSUER_ROLE` a
`msg.sender`, que —al desplegarse vía relay— es el RelayHub; y como las
posteriores llamadas a `issueCredential`/`revokeCredential` también llegan por
el RelayHub, el control de acceso se satisface.

### 4. Implicancia de seguridad y camino a producción

Delegar `owner`/roles en el RelayHub es **adecuado para un prototipo de TFM**,
pero **no es seguro para producción**: como el RelayHub es un contrato de
sistema compartido, el control de acceso deja de discriminar entre usuarios
(cualquier emisor que opere por el mismo relay compartiría el mismo
`msg.sender`). La solución correcta es hacer los contratos **relay-aware**:

1. Adoptar el patrón `BaseRelayRecipient` + `_msgSender()` (o `ERC2771Context`
   con el forwarder compatible de LNET), de modo que el control de acceso se
   evalúe contra la **cuenta real de la universidad** y no contra el RelayHub.
2. Alternativamente, fijar `owner`/roles mediante **parámetros del constructor**
   y validar la autoría con `_msgSender()`.

En resumen: la naturaleza *meta-transaccional* del modelo de gas de LNET
desplaza la identidad efectiva del emisor al RelayHub, y todo diseño de control
de acceso sobre esta red debe tenerlo en cuenta explícitamente.

## Explorer (testnet)

Explorer de la testnet de LNet: **https://explorer-testnet.l-net.io/**

- Contrato: `https://explorer-testnet.l-net.io/address/<direccion>`
- Transacción: `https://explorer-testnet.l-net.io/tx/<hash>`

Como todo pasa por el gas model / RelayHub, en el detalle de la tx el `From`
aparece como el RelayHub y el `To` como el contrato del gas model. Los eventos
(`CredentialIssued`, `Transfer`) quedan en el log del contrato del certificado.

## Seguridad

- No compartas ni commitees `LACNET_PRIVATE_KEY` ni `LACNET_NAAS_PASSWORD`.
- Revisá que `.env` esté siempre ignorado antes de hacer `git add`.

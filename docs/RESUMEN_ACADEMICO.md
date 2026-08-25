# Blockchain para la emisión y verificación de certificaciones académicas digitales

**Autor:** Marcos Luna
**Contexto:** Trabajo Fin de Máster — prototipo funcional sobre la red LACNET / LNet (testnet)

---

## Resumen (abstract)

Este trabajo estudia el uso de tecnología *blockchain* para la **emisión y
verificación de certificaciones académicas digitales**, con el objetivo de dotar
a los títulos y credenciales de propiedades de **inmutabilidad, autenticidad,
unicidad y verificabilidad sin intermediarios**. El estudio se centra en el
ecosistema **Ethereum** y sus contratos inteligentes, en el estándar de tokens
no fungibles **ERC-721** (empleado aquí en su modalidad *no transferible* o
*soulbound*), en el estándar de identidad **ERC-725** como marco para la
**gestión de identidad digital descentralizada**, y en el sistema de
**almacenamiento distribuido IPFS** para la persistencia de los documentos y
metadatos. Se presenta un prototipo funcional desplegado sobre una red pública
permisionada (LACNET / LNet), que implementa el ciclo de vida completo de una
credencial: emisión, consulta, revocación, vinculación a una identidad y
verificación de la cadena de referencias off-chain.

---

## 1. Planteamiento del problema

La certificación académica tradicional se apoya en documentos (analíticos,
diplomas) cuya autenticidad depende de la **confianza en la institución emisora**
y en procesos de verificación **manuales, lentos y centralizados**. Estos
esquemas son vulnerables a la falsificación, dependen de la disponibilidad de la
institución (que puede desaparecer o perder registros) y no permiten al titular
demostrar la validez de su credencial de forma autónoma.

La *blockchain* propone un **registro distribuido, append-only y verificable
criptográficamente** que permite anclar la existencia y el estado de una
credencial sin depender de una autoridad central para su verificación posterior.
La pregunta que guía el trabajo es: *¿cómo diseñar un sistema de certificación
académica que aproveche estas propiedades usando estándares abiertos del
ecosistema Ethereum, garantizando a la vez privacidad e interoperabilidad?*

---

## 2. Marco tecnológico

### 2.1. Ethereum y contratos inteligentes

Ethereum es una plataforma de cadena de bloques con capacidad de cómputo
mediante **contratos inteligentes**: programas deterministas ejecutados por la
*Ethereum Virtual Machine* (EVM) cuyo estado es replicado y validado por la red.
Sobre esta base se construyen los **estándares ERC** (*Ethereum Request for
Comments*), que definen interfaces comunes e interoperables para tokens e
identidad.

### 2.2. Redes públicas permisionadas: LACNET / LNet

El prototipo no se despliega sobre la red principal de Ethereum, sino sobre
**LACNET / LNet**, una red pública permisionada (basada en Hyperledger Besu,
compatible con la EVM) orientada a casos de uso institucionales en América
Latina. Su rasgo distintivo es un **modelo de gas sin comisiones**
(`gasPrice = 0`): para prevenir el abuso de recursos sin cobrar por transacción,
toda operación se canaliza a través de un contrato de sistema, el **RelayHub**,
mediante **meta-transacciones**. Este mecanismo tiene implicaciones directas
sobre el control de acceso de los contratos y se documenta en detalle en el
[README](../README.md#el-modelo-de-gas-de-lnet-y-el-relayhub-fundamento).

> Consideración de compatibilidad: la red no soporta el opcode `PUSH0`
> (introducido en la actualización *Shanghai*), por lo que los contratos se
> compilan con `evmVersion: "paris"`.

### 2.3. ERC-721: credenciales como tokens no transferibles

**ERC-721** es el estándar de *tokens no fungibles* (NFT): cada token es único y
distinguible, identificado por un `tokenId`, y expone metadatos a través de la
función `tokenURI`. En este trabajo, cada **credencial académica se representa
como un token ERC-721**, lo que aporta unicidad y trazabilidad de propiedad.

Ahora bien, una credencial académica **no debe poder transferirse ni venderse**:
está intrínsecamente ligada a su titular. Por ello el contrato implementa el
patrón de **token no transferible** (*soulbound token*, SBT — conceptualizado por
Weyl, Ohlhaver y Buterin, 2022, y estandarizado de forma mínima en **ERC-5192**),
bloqueando toda transferencia posterior a la emisión (*mint*). En la
implementación (`AcademicCertificate.sol`) esto se logra sobreescribiendo la
función interna `_update` de OpenZeppelin: se permite la creación (`from == 0`)
pero se revierte cualquier transferencia entre cuentas.

El contrato añade, además:
- **Control de acceso por roles** (OpenZeppelin `AccessControl`): solo cuentas
  con `ISSUER_ROLE` pueden emitir o revocar.
- **Revocabilidad**: una credencial puede marcarse como revocada sin borrarse,
  preservando la trazabilidad histórica.
- **Metadatos verificables**: `tokenURI` devuelve un URI `ipfs://` que apunta a
  la metadata de la credencial (véase §2.6).

### 2.4. ERC-725 y la identidad digital descentralizada

**ERC-725** (Fabian Vogelsteller) define un **contrato de identidad** controlado
por claves criptográficas, capaz de (i) ejecutar operaciones en nombre de la
identidad (`ERC-725X`) y (ii) almacenar pares clave-valor de datos arbitrarios
(`ERC-725Y`). Suele combinarse con **ERC-735** (gestión de *claims* o
atestaciones verificables asociadas a la identidad). En conjunto, proporcionan
la base para una **identidad digital autosoberana** (*Self-Sovereign Identity*,
SSI): el sujeto controla su identidad y las afirmaciones que otros hacen sobre
ella, sin depender de un proveedor central.

En el prototipo, el contrato `AcademicIdentity.sol` implementa una **versión
simplificada** de esta idea: una identidad (`identityId`) con un propietario
(`Ownable`) que **agrupa (vincula) las credenciales** que le pertenecen
(`linkCredential`, `getCredentials`). Conceptualmente cumple el papel de un
agregador de atestaciones —el núcleo de ERC-725/735— aunque **no implementa la
interfaz completa** de gestión de claves y *claims*. La evolución natural hacia
producción consiste en sustituir este registro por una identidad ERC-725/735
completa, o por identificadores descentralizados conformes a **W3C DID** con
**Credenciales Verificables (W3C Verifiable Credentials)**, estándares hacia los
que converge la interoperabilidad de credenciales (incluido **Open Badges 3.0**).

### 2.5. Almacenamiento distribuido con IPFS

Registrar documentos completos (PDF, imágenes) directamente en la cadena es
costoso e impracticable. La solución adoptada es el **InterPlanetary File System
(IPFS)**, un sistema de archivos distribuido con **direccionamiento por
contenido**: cada objeto se identifica por un **CID** (*Content Identifier*)
derivado del *hash* de su contenido. Esto aporta dos propiedades esenciales para
la certificación:

1. **Integridad**: el CID es una huella criptográfica del contenido; cualquier
   alteración del documento produce un CID distinto. Anclar el CID en la cadena
   equivale a anclar una prueba de integridad del documento.
2. **Descentralización del almacenamiento**: el contenido puede servirse desde
   cualquier nodo/*gateway* que lo aloje.

Como IPFS no garantiza persistencia por sí mismo, el contenido debe estar
**"pineado"** (*pinning*) en al menos un servicio (en el prototipo, Pinata) para
asegurar su disponibilidad.

### 2.6. Arquitectura de referencias off-chain

La solución separa el **ancla on-chain** (el token) de los **datos off-chain**
(metadatos y documento), encadenándolos por CID:

```
ERC-721 tokenId
   │   tokenURI()                      (on-chain, en el contrato)
   ▼
ipfs://<metadataCID>  ──►  credential.json      (metadata de la credencial)
   │   campo "document"
   ▼
ipfs://<documentCID>  ──►  Certificado (PDF)     (documento firmado)
```

El `credential.json` describe la credencial (nombre, tipo, emisor, sujeto,
fecha) y referencia el documento en su campo `document`. El script
`verify-ipfs.js` recorre y valida esta cadena completa partiendo únicamente del
`tokenId`.

---

## 3. Arquitectura de la solución

| Componente | Estándar / tecnología | Rol en el sistema |
|---|---|---|
| `AcademicCertificate.sol` | ERC-721 + AccessControl (no transferible) | Emite, revoca y expone credenciales como NFT soulbound |
| `AcademicIdentity.sol` | Identidad simplificada (base ERC-725/DID) | Agrupa las credenciales de una identidad |
| `credential.json` + PDF | IPFS (CID) | Metadatos y documento verificables off-chain |
| LACNET / LNet | EVM permisionada, modelo de gas / RelayHub | Infraestructura de despliegue sin comisiones |
| Scripts Node.js (ethers + gas-model-provider) | — | Automatizan el ciclo de vida vía NaaS |

**Ciclo de vida de una credencial**

1. **Emisión** (`issueCredential`): la institución acuña un token ERC-721 a la
   dirección del titular, registrando el CID de la metadata, el tipo y la fecha.
2. **Consulta / verificación** (`getCredential`, `isValid`, `verify-ipfs`):
   cualquier tercero valida on-chain la existencia y vigencia, y off-chain la
   integridad del documento, **sin intervención de la institución**.
3. **Revocación** (`revokeCredential`): la institución invalida la credencial
   preservando su historia.
4. **Vinculación** (`linkCredential`): la credencial se asocia a una identidad
   (`AcademicIdentity`), habilitando una vista agregada del titular.

---

## 4. Propiedades garantizadas

- **Inmutabilidad y trazabilidad**: la emisión y la revocación quedan registradas
  como transacciones irreversibles y auditables.
- **Autenticidad**: solo cuentas autorizadas (`ISSUER_ROLE`) emiten; la firma
  criptográfica prueba la autoría.
- **Unicidad**: cada credencial es un token ERC-721 único e irrepetible.
- **No transferibilidad**: la credencial no puede cederse a otra cuenta (SBT).
- **Integridad del documento**: el CID de IPFS es una huella del contenido.
- **Verificabilidad autónoma**: el titular o un empleador verifican la credencial
  directamente contra la cadena e IPFS, sin depender de la institución.

---

## 5. Limitaciones y trabajo futuro

- **Control de acceso y meta-transacciones**: por el modelo de gas de LNET, el
  `msg.sender` efectivo es el RelayHub; el prototipo asigna roles/propiedad al
  RelayHub para operar. En producción, los contratos deben ser *relay-aware*
  (patrón `BaseRelayRecipient`/`_msgSender()` o `ERC2771Context`) para que el
  control de acceso recaiga sobre la cuenta real de la institución.
- **Identidad completa**: migrar `AcademicIdentity` a **ERC-725/735** o a **W3C
  DID + Verifiable Credentials** para gestión de claves y *claims* estandarizada.
- **Interoperabilidad de credenciales**: alinear la metadata con **Open Badges
  3.0 / W3C VC** para portabilidad entre plataformas.
- **Privacidad**: minimizar datos personales on-chain; emplear *hashes*,
  divulgación selectiva y pruebas de conocimiento cero cuando corresponda.
- **Persistencia de IPFS**: garantizar el *pinning* redundante (múltiples
  servicios/nodos) para la disponibilidad a largo plazo.

---

## 6. Conclusión

El prototipo demuestra que es viable construir un sistema de **certificación
académica descentralizada** combinando estándares abiertos del ecosistema
Ethereum: **ERC-721** para representar credenciales únicas y no transferibles,
un modelo de **identidad descentralizada** inspirado en **ERC-725** para
agruparlas, e **IPFS** para el almacenamiento verificable de documentos, todo
sobre una red pública permisionada sin comisiones. El resultado son credenciales
**inmutables, auténticas y verificables de forma autónoma**, reduciendo la
dependencia de procesos manuales y centralizados. Las limitaciones identificadas
(control de acceso *relay-aware*, identidad ERC-725/DID completa, privacidad e
interoperabilidad) trazan una hoja de ruta clara hacia una implementación de
producción.

---

## Referencias (estándares y fuentes)

- ERC-721: Non-Fungible Token Standard. https://eips.ethereum.org/EIPS/eip-721
- ERC-5192: Minimal Soulbound Tokens. https://eips.ethereum.org/EIPS/eip-5192
- ERC-725: General Data Key/Value Store & Execution. https://eips.ethereum.org/EIPS/eip-725
- ERC-735: Claim Holder. https://github.com/ethereum/EIPs/issues/735
- W3C Decentralized Identifiers (DID). https://www.w3.org/TR/did-core/
- W3C Verifiable Credentials Data Model. https://www.w3.org/TR/vc-data-model/
- Open Badges 3.0 (1EdTech). https://www.imsglobal.org/spec/ob/v3p0
- IPFS Documentation. https://docs.ipfs.tech/
- Weyl, Ohlhaver & Buterin (2022): *Decentralized Society: Finding Web3's Soul*.
- LACNET / LNet — Developer Portal. https://docs.lacnet.com/

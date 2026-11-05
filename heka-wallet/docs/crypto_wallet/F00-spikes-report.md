# F00 — Spike report (DSRDSC-295)

Detailed write-up of spikes A–D for the crypto wallet module: what each spike checked, how, the code that did it, the numbers, the traps found on the way and the decision for the sub-feature it gates. The short version (tables and decisions only) is in [F00 → Results](F00-cleanup-and-spikes.md#results). The design these spikes test is in [`../Idea and high-level design.md`](../Idea%20and%20high-level%20design.md).

| Spike | Gates | Decision |
| --- | --- | --- |
| A — viem in React Native | F02 (and F03) | **Go** on viem; the seed must come from native PBKDF2 |
| B — Hedera through the JSON-RPC relay | F05 | **Go**; units checked at the edge, long pending states, fee preview per operation |
| C — keys in Askar | F03 | **Go** on a raw Askar session entry (`category: 'crypto'`) |
| D — gas paid in USDC | F08 | **Go** on Base Sepolia; quote from the Circle rate of the previous receipt |

Status on 2026-11-06: all four decided. Not done: a transfer with real USDC on Hedera (B, the Circle faucet delivered nothing), passkey backup + restore (C, backup off on the test build).

---

## 1. How the spikes were run

### 1.1 Where the code lives

All spike code is on branch **`spike/crypto-wallet-f00`**, which is never merged. Code examples below are excerpts from that branch, sometimes shortened; paths are relative to `heka-wallet/app/`.

| File | Role |
| --- | --- |
| `src/spikes/crypto/flag.ts` | the dev-only switch |
| `src/spikes/crypto/config.ts` | chains, RPC URLs, token and contract addresses, Pimlico URL |
| `src/spikes/crypto/spikeLog.ts` | on-screen log + `measure()` timer |
| `src/spikes/crypto/spikeWallet.ts` | spike mnemonic and accounts #0–#3 |
| `src/spikes/crypto/spikeA.ts` … `spikeD.ts` | one file per spike; one exported function per button |
| `src/spikes/crypto/CryptoSpikeScreen.tsx` | the "Crypto spikes" screen |
| `src/navigators/SettingsStack.tsx`, `navigators/types.ts`, `utils/useWalletSettings.tsx` | route and the Settings row |

Dependencies added on the branch: `viem` **2.57.8** and `@hashgraph/sdk` **2.81.0** (the same version `@credo-ts/hedera` already resolves, so no second copy; declared only because lint forbids importing a transitive dependency).

### 1.2 The dev-only screen

The screen appears in **Settings → App settings → Crypto spikes**, below Bifold's "Developer" row, only when developer mode is on (tap the "Powered by" card 10 times) **and** the flag is on:

```ts
// src/spikes/crypto/flag.ts — no viem import, so navigation can read it cheaply
import { Config } from 'react-native-config'

// Debug builds always; a release build only with ENABLE_CRYPTO_SPIKE=true (for release timings)
export const isCryptoSpikeEnabled = __DEV__ || Config.ENABLE_CRYPTO_SPIKE === 'true'
```

The route loads the screen lazily, so viem and the native clipboard module are not loaded at start-up and not in Jest (an eager import broke `SettingsStack.spec.tsx`: Jest has no `RNCClipboard`):

```tsx
// src/navigators/SettingsStack.tsx
{isCryptoSpikeEnabled && (
  <Stack.Screen
    name={Screens.CryptoSpike}
    // Loaded on open: keeps viem and the clipboard module out of start-up and of Jest
    getComponent={() => require('../spikes/crypto/CryptoSpikeScreen').CryptoSpikeScreen}
    options={{ title: 'Crypto spikes' }}
  />
)}
```

The flag is read at **runtime** (`react-native-config`), so a release build of the spike branch always carries the spike code and viem in its JS bundle, whatever `ENABLE_CRYPTO_SPIKE` says; the flag only hides the row. Two release APKs built with the flag `true` and `false` differed by 12 bytes. (Before the flag existed, a `__DEV__`-only guard let the minifier drop the subtree: +52 bytes.) The branch is never merged, so this does not reach real builds.

### 1.3 Buttons, log and timings

Each button runs one async function. The screen wraps it, logs `--- <title>`, then `OK <title>` or `FAIL <title>: <error>`. Every line is also sent to `console.log('[SPIKE] …')`, so `adb logcat | grep "\[SPIKE\]"` shows the same log. "Copy log" puts the whole log on the clipboard.

```ts
// src/spikes/crypto/spikeLog.ts (excerpt)
export const spikeLog = (message: string): void => {
  const line = `${new Date().toISOString().slice(11, 23)} ${message}`
  console.log(`[SPIKE] ${line}`)
  lines = [...lines, line]
  notify()
}

// Runs fn, logs "<label>: <ms> ms" and returns its result
export const measure = async <T>(label: string, fn: () => T | Promise<T>): Promise<T> => {
  const start = performance.now()
  const result = await fn()
  spikeLog(`${label}: ${(performance.now() - start).toFixed(1)} ms`)
  return result
}
```

### 1.4 Spike accounts

One BIP-39 mnemonic, generated on first use and kept in AsyncStorage (debug build, testnet only). Four accounts at `m/44'/60'/0'/0/i`; the same address works on Base Sepolia and on Hedera (ECDSA alias):

| # | Address | Role |
| --- | --- | --- |
| 0 | `0x47341f3d96411012cCEBfad66DEb24e7718be038` (Hedera `0.0.11338782`) | funder: ETH + USDC on Base Sepolia; HBAR + tokens on Hedera |
| 1 | `0x942f42bC4281B979df5C7E3CF9168c047A0D667a` (Hedera `0.0.11338920`) | fresh alias that receives the first transfer (auto-create, HIP-904) |
| 2 | `0x896776F99de9b608e2EDc2449ABb1e17B2e3eb28` (Hedera `0.0.11338924`) | Hedera `CryptoCreate` account with no auto associations (HIP-719) |
| 3 | `0x1f4fAbff0D4198bA4C3527162A8437B0ea286276` | Spike D payer: USDC only, **zero ETH** |

The screen derives the accounts when it opens, from one native seed (see §2.4):

```ts
// src/spikes/crypto/spikeWallet.ts (excerpt)
import quickCrypto from 'react-native-quick-crypto'
import { HDAccount, HDKey, hdKeyToAccount } from 'viem/accounts'

// BIP-39 seed with native PBKDF2-SHA512, 2048 rounds, empty passphrase
export const nativeSeedFromMnemonic = (mnemonic: string): Uint8Array =>
  new Uint8Array(quickCrypto.pbkdf2Sync(mnemonic.normalize('NFKD'), 'mnemonic', 2048, 64, 'sha512'))

export const loadSpikeAccounts = async (): Promise<HDAccount[]> => {
  const mnemonic = await loadOrCreateMnemonic()
  const seed = await measure<Uint8Array>('native PBKDF2 seed (react-native-quick-crypto)', () =>
    nativeSeedFromMnemonic(mnemonic)
  )
  const root = HDKey.fromMasterSeed(seed)
  const derived: HDAccount[] = []
  for (let i = 0; i < SPIKE_ACCOUNT_COUNT; i++) {
    derived.push(
      await measure<HDAccount>(`hdKeyToAccount #${i} (BIP-32 only)`, () => hdKeyToAccount(root, { addressIndex: i }))
    )
  }
  return derived
}
```

### 1.5 Networks, endpoints and fixed addresses

```ts
// src/spikes/crypto/config.ts (excerpt)
export const BASE_SEPOLIA: EvmSpikeChain = {
  chain: baseSepolia,
  rpcUrl: 'https://sepolia.base.org',
  usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  explorerTx: (hash) => `https://sepolia.basescan.org/tx/${hash}`,
}
export const ARBITRUM_SEPOLIA: EvmSpikeChain = {
  chain: arbitrumSepolia,
  rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
  usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  explorerTx: (hash) => `https://sepolia.arbiscan.io/tx/${hash}`,
}
export const HEDERA_USDC_TOKEN_ID = '0.0.429274'
export const HEDERA_TESTNET = {
  chain: hederaTestnet,
  rpcUrl: 'https://testnet.hashio.io/api',
  mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
}
// Same address on every testnet Circle lists for v0.8
export const CIRCLE_PAYMASTER_V08: Address = '0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966'

export const pimlicoBundlerUrl = (chainId: number): string =>
  Config.PIMLICO_API_KEY
    ? `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${Config.PIMLICO_API_KEY}`
    : `https://public.pimlico.io/v2/${chainId}/rpc`
```

Sources for the addresses: Circle's "USDC contract addresses" and "Paymaster addresses" pages (2026-11-05). EntryPoint 0.8 `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108` and the Simple7702 implementation `0xe6Cae83BdE06E4c305530e199D7217f42808555B` come from viem 2.57.8 and were checked deployed on both testnets with `eth_getCode`.

### 1.6 Environment, devices, funding

| | |
| --- | --- |
| Device | Huawei P30 Pro (2019 flagship, Kirin 980), Android, **debug build**. A budget phone is slower — the pure-JS numbers would be worse, the native ones stay small |
| `app/.env` | `PIMLICO_API_KEY` (Spike D, keyed bundler endpoint); `ENABLE_CRYPTO_SPIKE=true` only for the release-build run. A changed `.env` needs a native rebuild |
| Funding | Base Sepolia: 0.0001 ETH + 20 USDC to #0 and 20 USDC to #3 (faucets). Hedera: 20 HBAR from the portal faucet to #0's **EVM address** (that created it as a hollow account), later 10 HBAR more. The Circle faucet wants a `0.0.x` id for Hedera, not an EVM address, and hit its 2-hour limit — the HIP-904 / HIP-719 checks used a test token instead (§3.5) |
| iOS | not run (no Mac) |

### 1.7 Release build for timings

Release signing reads four environment variables; without them `:app:packageRelease` fails with `SigningConfig "release" is missing required property "storeFile"`. For measurements only, sign with the project's debug keystore (PowerShell, in `heka-wallet/app/android`):

```powershell
$env:UPLOAD_KEYSTORE_PATH = "$PWD\app\debug.keystore"
$env:UPLOAD_KEYSTORE_PASSWORD = "android"
$env:UPLOAD_KEY_ALIAS = "androiddebugkey"
$env:UPLOAD_KEY_PASSWORD = "android"
.\gradlew.bat assembleRelease
(Get-Item app\build\outputs\apk\release\app-release.apk).Length
adb install -r app\build\outputs\apk\release\app-release.apk
```

The APK is a real release build (minified, Hermes bytecode, `__DEV__ = false`); only the signature differs.

---

## 2. Spike A — viem in React Native (gates F02)

### 2.1 Question

Does viem run in this React Native app (Hermes, the existing polyfills), how fast are key derivation and signing, what does it add to the bundle, and what does a public RPC allow for transfer history?

### 2.2 Steps

| Button | What it does |
| --- | --- |
| Reload accounts | mnemonic → seed → accounts #0–#3, timed (§1.4) |
| A1a Runtime globals | checks which globals viem may need exist |
| A1b Signature timings | one `signMessage`, `signTransaction` (EIP-1559), `signTypedData` with #0, no network |
| A1c PBKDF2: pure JS vs native | the same account via viem's `mnemonicToAccount` and via native PBKDF2, timed; addresses compared |
| A2 Balances | ETH and USDC of #0 and #1 on Base Sepolia |
| A3 / A4 | 0.00001 ETH and 0.01 USDC #0 → #1, with receipt latency and gas |
| A5 | USDC `Transfer` logs of #0 over 10 000 blocks |
| A6 | largest `getLogs` block range the public RPC accepts |

### 2.3 Code

Runtime check:

```ts
// src/spikes/crypto/spikeA.ts (excerpt)
const GLOBALS_TO_CHECK = ['crypto', 'TextEncoder', 'TextDecoder', 'BigInt', 'structuredClone',
  'AbortController', 'URL', 'fetch', 'WebSocket'] as const

export const checkRuntimeGlobals = (): void => {
  const scope = globalThis as unknown as Record<string, unknown>
  const missing = GLOBALS_TO_CHECK.filter((name) => scope[name] === undefined)
  const cryptoScope = scope.crypto as { getRandomValues?: unknown } | undefined
  spikeLog(`engine: ${'HermesInternal' in scope ? 'Hermes' : 'not Hermes'}`)
  spikeLog(`crypto.getRandomValues: ${typeof cryptoScope?.getRandomValues === 'function' ? 'present' : 'MISSING'}`)
  spikeLog(`missing globals: ${missing.length ? missing.join(', ') : 'none'}`)
}
```

Pure JS vs native PBKDF2 — the key comparison of this spike:

```ts
// src/spikes/crypto/spikeA.ts (excerpt)
export const comparePbkdf2 = async (): Promise<void> => {
  const mnemonic = getSpikeMnemonic()
  const viemAccount = await measure<HDAccount>('pure JS: mnemonicToAccount #0', () =>
    mnemonicToAccount(mnemonic, { addressIndex: 0 })
  )
  const nativeAccount = await measure<HDAccount>('native: PBKDF2 seed + HDKey + hdKeyToAccount #0', () =>
    hdKeyToAccount(HDKey.fromMasterSeed(nativeSeedFromMnemonic(mnemonic)), { addressIndex: 0 })
  )
  spikeLog(`addresses ${viemAccount.address === nativeAccount.address ? 'match' : 'DIFFER'}`)
}
```

Sends on Base Sepolia:

```ts
// src/spikes/crypto/spikeA.ts (excerpt)
const walletClient = (index: number) =>
  createWalletClient({ account: getSpikeAccount(index), chain: BASE_SEPOLIA.chain, transport: http(BASE_SEPOLIA.rpcUrl) })

const hash = await walletClient(0).writeContract({
  address: BASE_SEPOLIA.usdc,
  abi: erc20Abi,
  functionName: 'transfer',
  args: [getSpikeAccount(1).address, parseUnits('0.01', 6)],
})
const receipt = await publicClient().waitForTransactionReceipt({ hash })
```

History in 200-block chunks (the public RPC limit, see §2.4):

```ts
// src/spikes/crypto/spikeA.ts (excerpt)
const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const LOG_WINDOW_BLOCKS = 10_000n
const LOG_CHUNK_BLOCKS = 200n

const readChunked = async (filter: { from?: Address; to?: Address }) => {
  const logs = []
  for (let start = fromBlock; start <= latest; start += LOG_CHUNK_BLOCKS) {
    const end = start + LOG_CHUNK_BLOCKS - 1n < latest ? start + LOG_CHUNK_BLOCKS - 1n : latest
    logs.push(
      ...(await client.getLogs({ address: BASE_SEPOLIA.usdc, event: TRANSFER_EVENT, args: filter, fromBlock: start, toBlock: end }))
    )
  }
  return logs
}
```

A6 doubles the range from 1 000 blocks until the RPC rejects it, then bisects between the last accepted and the first rejected range.

### 2.4 Results

| Measurement | Result |
| --- | --- |
| Engine / missing globals | Hermes; `crypto.getRandomValues` present; **no missing globals** — no shim beyond the existing `app/shim.js` |
| `generateMnemonic(english, 128)` | 74 ms |
| Mnemonic → account, viem `mnemonicToAccount` (pure-JS PBKDF2-SHA512, 2 048 rounds) | **7 681–10 277 ms** per call (debug); **3 071 ms** (release) |
| Mnemonic → seed, native PBKDF2 (`react-native-quick-crypto`) | **4.9–5.3 ms** (debug); **1.8 ms** (release) |
| BIP-32 derivation per account | 85–94 ms (debug), 62–64 ms (release); 645–662 ms on the first call after app start in both |
| Native seed + HDKey + account | 103.5 ms (debug), 73.1 ms (release); same address as viem |
| `signMessage` / `signTransaction` (EIP-1559) / `signTypedData` | 96.6 / 34.9 / 45.6 ms (debug); 61.9 / 17.8 / 21.6 ms (release) |
| ETH send | sign + broadcast 982 ms; receipt 1 896 ms; 21 000 gas × 0.006 gwei + 165 wei L1 data fee |
| USDC send | sign + broadcast 948 ms; receipt 1 212 ms; 62 147 gas |
| `getLogs` limit, `https://sepolia.base.org` | **200 blocks** ("eth_getLogs is limited to a 200 range"; 194 accepted, 202 rejected; same from Node and from the phone) ≈ 6.7 min of chain |
| 10 000 blocks in 200-block chunks | 50 requests, 7.9–8.7 s per filter (≈ 170 ms each); found the 0.01 USDC sent and the 20 USDC faucet transfer |
| JS bundle (minified production bundle, `hermesc -O`) | baseline 37 977 761 B JS / 45 419 231 B HBC. `viem` + `viem/accounts` + `viem/account-abstraction`: **+1 970 266 B JS (+5.2 %), +2 605 462 B HBC (+5.7 %)**. With the `viem/chains` index for three chains: +2 724 689 B JS, +3 640 009 B HBC — the index alone ≈ 0.75 MB JS |
| Release build (`ENABLE_CRYPTO_SPIKE=true`, signed with the debug keystore, §1.7) | engine Hermes, no missing globals — same as debug |
| Release APK (universal, 4 ABIs) | 230 509 220 B. The JS bundle is **stored uncompressed** (`assets/index.android.bundle`, Hermes bytecode): 27 039 972 B with the spike vs 24 631 212 B without → **+2 408 760 B (+2.4 MB, +9.8 % of the bundle, +1.0 % of the APK)** for viem (core + `viem/chains` index) and the spike code |

How the bundle was measured: (1) minified bundles (`react-native bundle --dev false --minify true` + `hermesc -O`) with a temporary entry importing `./index` plus the viem modules, to split viem core from the `viem/chains` index; (2) for the APK, the exact Gradle steps for Hermes — `react-native bundle --dev false --minify false`, then `hermesc -emit-binary -O -output-source-map` (the RN Gradle plugin turns minify off when Hermes is on) — with and without the three files that wire the spike in. Step (2) reproduced the bundle inside the release APK byte for byte (27 039 972 B).

### 2.5 Traps found

**1. Pure-JS PBKDF2 is unusable for unlock.** viem's `mnemonicToAccount` runs BIP-39's PBKDF2 (2 048 × HMAC-SHA512) in JavaScript through `@scure/bip39` / `@noble/hashes`. On Hermes that takes 8–10 s per call in a debug build and 3.1 s in a release build on a 2019 flagship, and every derived account repeats it. The app already ships a native PBKDF2. Production code for F03:

```ts
// Derive once per unlock; never call mnemonicToAccount in the app
const seed = new Uint8Array(quickCrypto.pbkdf2Sync(mnemonic.normalize('NFKD'), 'mnemonic', 2048, 64, 'sha512'))
const root = HDKey.fromMasterSeed(seed)
const account = hdKeyToAccount(root, { addressIndex: i }) // m/44'/60'/0'/0/i
```

The empty-passphrase salt is the literal string `mnemonic` (BIP-39). The address was checked equal to viem's.

**2. Typecheck fails after adding viem.** The wallet's `tsconfig.json` uses `"moduleResolution": "node"`, which ignores package `exports`. viem's types import `ox/*` subpaths (`ox/tempo/…`, `ox/webauthn/…`), and `node` resolution lands on ox's raw `.ts` sources, which need DOM types the app does not load (`AuthenticatorAttestationResponse`, `window.location`). `skipLibCheck` does not cover `.ts` files. Fix in `heka-wallet/tsconfig.json`:

```json
"paths": {
  "ox": ["node_modules/ox/_types/index.d.ts"],
  "ox/*": ["node_modules/ox/_types/*"]
}
```

**3. `tsc` crash: "Fatal process out of memory: Zone".** After timing account derivation through the generic `measure<T>()`, `yarn typecheck` died at ~820 MB heap. It passes with `node --stack-size=4000`, so it is deep recursion while inferring viem's `HDAccount` type through a generic, not memory. Fix: give the type explicitly at the generic boundary.

```ts
// crashes tsc
const account = await measure('derive', () => hdKeyToAccount(root, { addressIndex: 0 }))
// fine
const account = await measure<HDAccount>('derive', () => hdKeyToAccount(root, { addressIndex: 0 }))
```

**4. Metro does not tree-shake.** Importing three chains from `viem/chains` pulls every chain definition (≈ 0.75 MB JS). Import chain definitions one by one or use `defineChain`.

**5. Public RPC history.** 200 blocks per `getLogs` call on public Base Sepolia. A History screen cannot rely on it: a keyed RPC with a larger window, or an indexer (F11).

### 2.6 Decision

**Go on viem for F02.** Fallback to ethers v6 not needed. Conditions: native PBKDF2 for the seed; chain definitions imported one by one; the `ox` `paths` mapping; explicit viem types at generic boundaries; history not from public-RPC `getLogs`.

---

## 3. Spike B — Hedera through the JSON-RPC relay (gates F05)

### 3.1 Question

Can the same viem code drive Hedera testnet (`eip155:296`) through the Hashio JSON-RPC relay: account auto-creation from an EVM alias, hollow-account completion, HTS tokens without and with association, and what are the gas, units, latency and Mirror Node lag?

### 3.2 Steps

| Button | What it does |
| --- | --- |
| B1 | long-zero EVM address of USDC `0.0.429274`; `symbol()` / `decimals()` through the relay |
| B2 | chain id, `eth_gasPrice`, latest `baseFeePerGas`; Mirror Node state of #0–#2 (key, tinybar, token, max auto associations) |
| B3 | 1 HBAR #0 → #1; relay receipt, Mirror Node lag, #0's key before and after |
| B4b | creates an HTS test token with the SDK (USDC stand-in while the faucet was limited) |
| B token: USDC / test token | which token B2, B5, B7 use |
| B5 | 0.01 token #0 → #1 (auto-created, no association: HIP-904) |
| B6 | `CryptoCreate` of #2 with the SDK: ECDSA key with alias, `maxAutomaticTokenAssociations 0` |
| B7 | #2 `associate()` through the HIP-719 facade, then receives 0.01 token |

### 3.3 Code

Long-zero address of an HTS entity:

```ts
// src/spikes/crypto/spikeB.ts
// "0.0.429274" -> 20-byte long-zero EVM address of the entity number
export const longZeroAddress = (entityId: string): Address => {
  const num = BigInt(entityId.split('.')[2])
  return `0x${num.toString(16).padStart(40, '0')}` as Address
}
// longZeroAddress('0.0.429274') === '0x0000000000000000000000000000000000068cda'
```

HBAR through the relay — the value is in 18-decimal weibar, like ETH:

```ts
// src/spikes/crypto/spikeB.ts (excerpt)
const walletClient = (index: number) =>
  createWalletClient({ account: getSpikeAccount(index), chain: hederaTestnet, transport: http('https://testnet.hashio.io/api') })

const hash = await walletClient(0).sendTransaction({ to: getSpikeAccount(1).address, value: parseEther('1') }) // 1 HBAR
const receipt = await publicClient().waitForTransactionReceipt({ hash })
```

Mirror Node as the read path and the confirmation of a relay receipt:

```ts
// src/spikes/crypto/spikeB.ts (excerpt)
// Mirror Node account by EVM address; null when the ledger does not know it yet
const mirrorAccount = async (address: Address): Promise<MirrorAccount | null> => {
  const response = await fetch(`${HEDERA_TESTNET.mirrorNodeUrl}/api/v1/accounts/${address}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Mirror Node ${response.status} for ${address}`)
  return (await response.json()) as MirrorAccount // account, key (null = hollow), balance.balance (tinybar), balance.tokens
}

// After the relay receipt: wait for the same transaction on Mirror Node
await pollMirror('contract result', async () => {
  const response = await fetch(`${HEDERA_TESTNET.mirrorNodeUrl}/api/v1/contracts/results/${hash}`)
  return response.ok ? true : null
})
```

HIP-719 association through the token's facade:

```ts
// src/spikes/crypto/spikeB.ts (excerpt)
const HIP719_ABI = parseAbi(['function associate() returns (uint256)', 'function isAssociated() view returns (bool)'])

const associated = await client.readContract({
  address: token.address, abi: HIP719_ABI, functionName: 'isAssociated', account: account2.address,
})
if (!associated) {
  await walletClient(2).writeContract({ address: token.address, abi: HIP719_ABI, functionName: 'associate' })
}
```

`CryptoCreate` and `TokenCreate` with `@hashgraph/sdk` from React Native, paid by #0's ECDSA key taken from the viem account:

```ts
// src/spikes/crypto/spikeB.ts (excerpt)
const sdkKey = (index: number): PrivateKey => {
  const privateKey = getSpikeAccount(index).getHdKey().privateKey
  if (!privateKey) throw new Error(`#${index} has no private key`)
  return PrivateKey.fromBytesECDSA(privateKey)
}

const client = Client.forTestnet().setOperator(payer.account, sdkKey(0)) // payer.account = '0.0.11338782'
try {
  const response = await new AccountCreateTransaction()
    .setECDSAKeyWithAlias(sdkKey(2))
    .setInitialBalance(new Hbar(2))
    .setMaxAutomaticTokenAssociations(0)
    .freezeWith(client)
    .sign(sdkKey(2))
    .then((tx) => tx.execute(client))
  const receipt = await response.getReceipt(client)
} finally {
  client.close()
}
```

### 3.4 Results

| Measurement | Result |
| --- | --- |
| USDC long-zero | `0x0000000000000000000000000000000000068cda`; `symbol()` USDC, `decimals()` 6 through the relay; Mirror Node: "USD Coin", `FUNGIBLE_COMMON` |
| Chain id / `eth_gasPrice` | 296 / 1 300 000 000 000–1 320 000 000 000 = **18-decimal weibar** (130–132 tinybar per gas) |
| EIP-1559 | supported — transactions go out as type `eip1559`; `eth_feeHistory` answers |
| HBAR to a fresh alias (portal faucet → #0; B3 → #1) | auto-created **hollow** (`key: null`), max auto associations −1 |
| First relay send from hollow #0 | **completes it** — key `ECDSA_SECP256K1` afterwards |
| 1 HBAR sent with `parseEther('1')` | arrived as 100 000 000 tinybar (18 → 8 decimals) |
| HTS token to auto-created #1, no association (HIP-904) | success |
| `associate()` by #2 (max auto associations 0), then receive (HIP-719) | success |
| `CryptoCreate` / `TokenCreate` through the SDK in React Native | 2.1 s / 1.9 s; work with `@hashgraph/sdk` 2.81.0 |
| Relay receipt latency | 7.0–73 s (8.2 s at 12:06, 45 s broadcast + 73 s receipt at 13:01) |
| Mirror Node lag behind the relay receipt | 75–207 ms; 1.5 s for the SDK-created account; 10.8 s until a new token was readable through the relay |

Gas and fees (effective price 123–124 tinybar per gas; fees cross-checked with Mirror Node `charged_tx_fee`):

| Operation | Gas | Fee |
| --- | --- | --- |
| Plain HBAR transfer to an existing account | 21 000 | 0.026 HBAR |
| HTS token transfer | 36 868 | 0.045 HBAR |
| HBAR transfer that auto-creates the recipient | 607 856 | 0.754 HBAR |
| `associate()` (HIP-719) | 726 488 | ≈ 0.89 HBAR |
| `CryptoCreate` (SDK) | — | 0.731 HBAR + initial balance |
| `TokenCreate` (SDK) | — | **14.59 HBAR** |

### 3.5 Traps found

**1. Units change between calls.** `baseFeePerGas` came back as `1240000000000` (weibar) at 11:57 and as `124` (tinybar) at 13:00; `eth_gasPrice` stayed in weibar. F05 must normalise and sanity-check units at the edge (`crypto/evm/hedera/`), not trust one call.

**2. Latency varies by an order of magnitude.** 7–73 s to a relay receipt within one hour. The UI needs a pending state that tolerates tens of seconds; Hashio is for development only.

**3. Fees depend heavily on the operation.** Auto-create and `associate()` cost ~30× a plain transfer; token creation costs ~15 HBAR. The fee preview needs the operation type, not one gas figure. An account with ~1 HBAR could not afford `associate()` (viem's estimate × max fee exceeded the balance).

**4. The Circle faucet on Hedera wants the `0.0.x` id**, not the EVM address ("Please enter a valid wallet address for Hedera"), and the account must exist first. The id comes from Mirror Node `GET /api/v1/accounts/{evmAddress}`.

**5. Revert reasons are readable.** A USDC transfer without balance reverted with `CONTRACT_REVERT_EXECUTED, INSUFFICIENT_TOKEN_BALANCE` — usable for user messages.

**6. `@hashgraph/sdk` is frozen.** 2.81.0 is its last release; development continues as `@hiero-ledger/sdk` (2.90.1). The app ships 2.81.0 through `@credo-ts/hedera` (and 2.78.0 through `@hiero-did-sdk/*`).

### 3.6 Decision

**Go on the relay path for F05.** Conditions: unit normalisation at the edge; Mirror Node as the read path and the confirmation of relay receipts; a pending state of tens of seconds; fee preview per operation type; Hashio for dev only. Not done: a transfer with real USDC (the faucet delivered nothing; the test token covers the same HTS paths); HashPack / Blade import not tried.

---

## 4. Spike C — the seed in Askar (gates F03)

### 4.1 Question

Can the seed live in the agent's Askar store — through Credo's `GenericRecordsApi` or a raw Askar session — and does it survive lock / unlock, a PIN change (store rekey) and backup / restore? Does the DC API agent, which opens the same store, see or break it?

### 4.2 Steps

| Button | What it does |
| --- | --- |
| C1 | writes a **dummy** phrase both ways (not the spike mnemonic) |
| C2/C4 | reads both back; counts generic records tagged `type: 'crypto-seed'` |
| C3 | opens the DC API agent on the same store, lists what it sees, shuts it down, re-reads with the main agent |
| C5 | deletes both records |

Between C2/C4 runs the user locked / restarted the app and changed the PIN.

### 4.3 Code

Both ways of writing, from the screen's main agent (`useHekaAgent()`):

```ts
// src/spikes/crypto/spikeC.ts (excerpt)
import { AskarStoreManager } from '@credo-ts/askar'
import type { Session } from '@openwallet-foundation/askar-shared'

const withRawSession = <T>(agent: HekaWalletAgent, callback: (session: Session) => Promise<T>): Promise<T> =>
  agent.dependencyManager.resolve(AskarStoreManager).withSession(agent.context, callback)

// 1. Credo generic record
await agent.genericRecords.save({
  id: 'spike-crypto-seed',
  content: { seed: TEST_SEED, version: 1, createdAt: new Date().toISOString() },
  tags: { type: 'crypto-seed' },
})

// 2. Raw Askar entry in its own category
await withRawSession(agent, async (session) => {
  const entry = { category: 'spike-crypto', name: 'seed', value: TEST_SEED, tags: { version: '1' } }
  if (await session.fetch({ category: 'spike-crypto', name: 'seed' })) await session.replace(entry)
  else await session.insert(entry)
})

// Read
const entry = await withRawSession(agent, (session) => session.fetch({ category: 'spike-crypto', name: 'seed' }))
const value = entry ? String(entry.value) : undefined
```

The device run used `category: 'crypto'`; the spike now uses `spike-crypto`, so a leftover test entry (the public "abandon … about" phrase) can never be read as the real seed. F03 owns `crypto` / `seed` and should refuse well-known test phrases.

The DC API agent check:

```ts
// src/spikes/crypto/spikeC.ts (excerpt)
const secret = await getWalletSecret() // Bifold useAuth()
const dcAgent = await createDcApiAgent(secret) // same store id and key as the main agent
try {
  const all = await dcAgent.genericRecords.getAll()
  const tagged = await dcAgent.genericRecords.findAllByQuery({ type: 'crypto-seed' })
  const raw = await withRawSession(dcAgent, (session) => session.fetchAll({ category: 'spike-crypto' }))
} finally {
  await dcAgent.shutdown()
}
```

### 4.4 Results

| Measurement | Result |
| --- | --- |
| Write: `GenericRecordsApi.save` / raw `insert` | 12.9 / 11.3 ms |
| Read: generic `findById` / raw `fetch` | 24–180 ms (180 on the first call) / 11.7–17.1 ms |
| DC API agent (`createDcApiAgent` 989 ms, shutdown 8.8 ms) | **sees** the record both ways: `getAll()` returns `spike-crypto-seed`, the tag query finds 1, the raw category has 1 entry. Does not corrupt it — the main agent reads both intact afterwards |
| PIN change (Bifold `rekeyWallet` → `rotateStoreKey`) | both records intact in the running agent |
| Full app restart, unlock with the new PIN | both records intact; store opened with the rotated key |
| Passkey backup + restore | not checked — `ENABLE_WALLET_BACKUP=false` on the test build; no second device |

### 4.5 Traps found

**The store is shared, so the seed is visible to any agent that opens it.** The design said only the main agent reads the seed; in fact the DC API agent could list it through Credo's generic records and through the raw category. Nothing in the DC API agent's code asks for either today, so the separation holds by code, not by storage. A raw category is less exposed than a generic record: no Credo API lists category `crypto`, while any code calling `genericRecords.getAll()` sees a generic record.

The backup (`exportStore`) copies the whole store, so it includes the raw entry — untested here.

### 4.6 Decision

**Go on a raw Askar session entry** (`category: 'crypto'`, `name: 'seed'`, value = the mnemonic, tags `{ version }`). It survives lock / unlock and the PIN rekey, no Credo API lists it, and it reads faster than a generic record. The `expo-secure-store` fallback is not needed. For the Phase 4.1 security review: separation from the DC API agent is by code only.

---

## 5. Spike D — gas paid in USDC (gates F08)

### 5.1 Question

Can an EOA holding **zero ETH** send USDC on Base Sepolia, paying gas in USDC, through an EIP-7702 upgrade to the Simple7702 account, Pimlico's bundler and Circle Paymaster v0.8 with an EIP-2612 permit? What does it cost, which rate source predicts the fee, and does revoking the delegation leave a working EOA?

### 5.2 Steps

| Button | What it does |
| --- | --- |
| D chain | Base Sepolia (default) or Arbitrum Sepolia (fallback) |
| D0 | 10 USDC #0 → #3 (plain EOA transfer by #0) |
| D1 | #3's ETH (must be 0), USDC, code; paymaster and EntryPoint 0.8 deployed? |
| D2 | one 0.01 USDC transfer #3 → #0 as a user operation, gas paid in USDC; authorization on first use; quotes before, net fee after |
| D4 | D2 ten times, for the quote comparison |
| D5 | revoke the delegation, then a plain EOA round trip with #3 |

### 5.3 Code

The 7702 account. `toSimple7702SmartAccount` needs a private-key account as owner, so the HD key is converted:

```ts
// src/spikes/crypto/spikeD.ts (excerpt)
const ownerAccount = (index: number): PrivateKeyAccount => {
  const privateKey = getSpikeAccount(index).getHdKey().privateKey
  if (!privateKey) throw new Error(`#${index} has no private key`)
  return privateKeyToAccount(toHex(privateKey))
}

const owner = ownerAccount(3)
const account = await toSimple7702SmartAccount({ client, owner }) // same address as the EOA
```

The permit to the paymaster. The deadline is `maxUint256` because a paymaster cannot read `block.timestamp` under ERC-4337 rules; the signature is unwrapped from ERC-6492 as Circle's sample does:

```ts
// src/spikes/crypto/spikeD.ts (excerpt)
const PERMIT_ABI = parseAbi([
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function nonces(address owner) view returns (uint256)',
])

const signPermit = async (client: PublicClient, account: ToSimple7702SmartAccountReturnType): Promise<Hex> => {
  const [name, version, nonce] = await Promise.all([
    client.readContract({ address: usdc, abi: PERMIT_ABI, functionName: 'name' }),
    client.readContract({ address: usdc, abi: PERMIT_ABI, functionName: 'version' }),
    client.readContract({ address: usdc, abi: PERMIT_ABI, functionName: 'nonces', args: [account.address] }),
  ])
  const wrapped = await account.signTypedData({
    domain: { name, version, chainId, verifyingContract: usdc },
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Permit',
    message: { owner: account.address, spender: CIRCLE_PAYMASTER_V08, value: parseUnits('10', 6), nonce, deadline: maxUint256 },
  })
  return parseErc6492Signature(wrapped).signature
}
```

The paymaster object, the bundler client with Pimlico's gas price, and the send:

```ts
// src/spikes/crypto/spikeD.ts (excerpt)
const paymaster = {
  async getPaymasterData() {
    const permitSignature = await signPermit(client, account)
    return {
      paymaster: CIRCLE_PAYMASTER_V08,
      paymasterData: encodePacked(['uint8', 'address', 'uint256', 'bytes'], [0, usdc, PERMIT_AMOUNT, permitSignature]),
      paymasterVerificationGasLimit: 200_000n,
      paymasterPostOpGasLimit: 35_000n,
      isFinal: true,
    }
  },
}

const bundlerClient = createBundlerClient({
  account,
  client,
  paymaster,
  transport: http(pimlicoBundlerUrl(chainId)),
  userOperation: {
    estimateFeesPerGas: async () => {
      const { standard } = await bundlerRequest<PimlicoGasPrice>('pimlico_getUserOperationGasPrice', [])
      return { maxFeePerGas: hexToBigInt(standard.maxFeePerGas), maxPriorityFeePerGas: hexToBigInt(standard.maxPriorityFeePerGas) }
    },
  },
})

// First use only: delegate the EOA to the Simple7702 implementation
const delegated = (await client.getCode({ address: account.address })) !== undefined
const authorization = delegated
  ? undefined
  : await owner.signAuthorization({
      chainId,
      nonce: await client.getTransactionCount({ address: owner.address }),
      address: account.authorization.address, // 0xe6Cae83BdE06E4c305530e199D7217f42808555B
    })

const calls = [{ to: usdc, abi: erc20Abi, functionName: 'transfer', args: [recipient, parseUnits('0.01', 6)] } as const]
const userOpHash = await bundlerClient.sendUserOperation({ calls, authorization })
const result = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash })
// Explorer link: result.receipt.transactionHash, not the user-operation hash
```

Pimlico-specific JSON-RPC methods are not in viem's typed schema; the spike calls them through an untyped request:

```ts
// src/spikes/crypto/spikeD.ts
const bundlerRequest = async <T>(method: string, params: unknown[]): Promise<T> => {
  const client = createClient({ transport: http(pimlicoBundlerUrl(spikeChain.chain.id)) })
  const request = client.request as unknown as (args: { method: string; params: unknown[] }) => Promise<T>
  return request({ method, params })
}
```

The net fee. The paymaster pulls a **prefund** and **refunds** the unused part in the same transaction; reading only the first transfer overstates the fee more than 2× (the first run of the spike did exactly that):

```ts
// src/spikes/crypto/spikeD.ts (excerpt)
const usdcTransfers = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: result.receipt.logs })
  .filter((log) => log.address.toLowerCase() === usdc.toLowerCase())
const sumTransfers = (from: Address, to: Address) =>
  usdcTransfers
    .filter((log) => log.args.from.toLowerCase() === from.toLowerCase() && log.args.to.toLowerCase() === to.toLowerCase())
    .reduce((sum, log) => sum + log.args.value, 0n)

const prefund = sumTransfers(account.address, CIRCLE_PAYMASTER_V08)
const refund = sumTransfers(CIRCLE_PAYMASTER_V08, account.address)
const fee = prefund - refund
// Rate for the next quote: USDC units per 1e18 wei
const impliedRate = (fee * 10n ** 18n) / result.actualGasCost
```

Revocation: the authorization to the zero address is carried by a type-4 transaction that **another account** sends, because #3 has no ETH. When the signer is not the sender, its current nonce is used as is:

```ts
// src/spikes/crypto/spikeD.ts (excerpt)
const authorization = await owner.signAuthorization({
  chainId,
  nonce: await client.getTransactionCount({ address: owner.address }),
  address: zeroAddress,
})
const hash = await walletClient(0).sendTransaction({ authorizationList: [authorization], to: owner.address, value: 0n })
// afterwards getCode(#3) is empty; #3 can send a plain EIP-1559 transaction again
```

### 5.4 Results

| Measurement | Result |
| --- | --- |
| Contracts (Base Sepolia and Arbitrum Sepolia) | Circle Paymaster v0.8 (141-byte proxy), EntryPoint 0.8, Simple7702 implementation — all deployed |
| Sends from #3 with **0 ETH** | 11 of 11 succeeded (Pimlico keyed endpoint); #3's ETH stayed 0 |
| First send (authorization + transfer) | `actualGasUsed` 259 670; `actualGasCost` 0.0000015710035 ETH; net fee **0.005131 USDC**; prepare 1.08 s, send 1.38 s, receipt 3.1 s; #3's code `0xef0100e6cae83bde06e4c305530e199d7217f42808555b` afterwards |
| Later sends (10×) | `actualGasUsed` 199 911 each (bundle transaction 193 895 gas at 0.006 gwei); `actualGasCost` 0.00000120946155 ETH; net fee **0.004046 USDC** each; prepare 0.60–0.97 s, send 0.88–1.12 s, receipt 1.26–2.52 s |
| Prefund / refund (checked on tx `0x4de14ac9…24e4`) | 0.00903 USDC pulled, 0.004984 refunded; balance drop 0.014046 = 0.01 sent + 0.004046 fee |
| Cost vs a plain EOA USDC transfer | 199 911 vs 62 147 gas ≈ **3.2×**; the first send +60 k gas for the delegation |
| Revocation (type 4, sent by #0) | 36 800 gas; #3's code empty afterwards; plain EIP-1559 send #3 → #0 (21 000 gas) works |

Rate source for the fee quote (10 sends):

| Source | Quote at actual cost | Error |
| --- | --- | --- |
| Circle's effective rate (fee / `actualGasCost`) | — | 3 345.3 USDC/ETH (first send 3 266.1) |
| (a) Pimlico `pimlico_getTokenQuotes` (`exchangeRate` 2 466 002 650 = 2 466 USDC/ETH) | 0.002983 USDC | **−26.3 %** (−18.9 % with Circle's 10 % surcharge) |
| (b) Rate implied by the previous receipt (net) | 0.004046 USDC | **0 %** from the second send on (gas is deterministic) |
| (b) at the prepared maximum (gas limits × `maxFeePerGas`) | 0.009208 USDC | 2.28 × actual ≈ the paymaster's prefund — a natural "up to" ceiling. Taken from a separate `prepareUserOperation`; `sendUserOperation({ calls })` prepares again, so the sent op can differ slightly. F08 should quote and send the same prepared op |

Pimlico's token quote names its own ERC-20 paymaster (`0x888888888888Ec68A58AB8094Cc1AD20Ba3D2402`), not Circle's; its rate is not Circle's.

### 5.5 Traps found

1.  **Read the net fee.** The paymaster's prefund is about 2.2× the real fee and is refunded in the same transaction.
2.  **Do not use Pimlico's token quote for Circle's paymaster** — it prices a different paymaster (−26 %).
3.  **The owner must be a private-key account.** `toSimple7702SmartAccount` takes a `PrivateKeyAccount`, not viem's `HDAccount`: convert with `privateKeyToAccount(toHex(hdKey.privateKey))` inside the signing scope.
4.  **The user-operation hash is not a transaction hash.** Explorer links use `result.receipt.transactionHash`.
5.  **Revocation needs ETH from somewhere.** An account with zero ETH cannot send its own type-4 transaction; another account (or the bundler path) has to carry the authorization.

### 5.6 Decision

**Go on Base Sepolia for F08.** The Arbitrum Sepolia fallback is not needed (all contracts are also there). Fee quote: "≈ gas × the Circle rate implied by the last receipt", with the prepared maximum (≈ the prefund) as "up to"; a first-ever quote, before any receipt, needs a seeded rate per chain. Gas per USDC send ≈ 3.2 × a plain transfer.

---

## 6. Inputs for the next sub-features

| For | Take from the spikes |
| --- | --- |
| F01 scaffold | `ox` `paths` mapping in `tsconfig.json`; explicit viem types at generic boundaries; chain definitions imported one by one; viem at an exact version |
| F02 EVM adapter | viem confirmed; history needs a keyed RPC or an indexer (public Base Sepolia `getLogs` = 200 blocks); receipts in 1–2 s on Base Sepolia |
| F03 key provider | native PBKDF2 seed → `HDKey` → `hdKeyToAccount`; raw Askar entry `category: 'crypto'`; derivation 85–94 ms per account (cache addresses) |
| F05 Hedera entry | unit normalisation at the edge; Mirror Node for reads and receipt confirmation; pending of tens of seconds; fee preview per operation type (§3.4) |
| F08 gas in USDC | Simple7702 + Pimlico + Circle Paymaster v0.8 as coded in §5.3; net fee = prefund − refund; quote from the previous receipt's rate |
| Phase 4.1 security review | the DC API agent can read the seed (shared store); passkey backup carries the seed (untested); the 7702 implementation address to pin |

## 7. Not done or pending

| Item | Why | Next step |
| --- | --- | --- |
| One transfer with real USDC on Hedera | the Circle faucet answered "Tokens sent" (2026-11-06) but nothing reached `0.0.11338782` in 10 min | optional, in F05: fund #0 with USDC, "B token: USDC", B5 and B7 |
| Passkey backup + restore of the seed | backup off on the test build; no second device | with `ENABLE_WALLET_BACKUP=true`: back up, clear app data, restore, C2/C4 |
| Budget-phone timings | only a 2019 flagship was available | re-run "Reload accounts", A1b, A1c on a budget phone |
| iOS | no Mac | — |
| HashPack / Blade import of the phrase | nice-to-have | import the spike mnemonic and compare addresses |

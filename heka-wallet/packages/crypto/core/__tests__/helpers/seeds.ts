import type { Hex } from 'viem'

/** Public vectors; the provider refuses to store them, so the derivation tests use them directly. */
export const JUNK_MNEMONIC = 'test test test test test test test test test test test junk'
export const JUNK_PAYMENT_0 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
export const JUNK_PAYMENT_1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
export const JUNK_PAYMENT_0_KEY: Hex = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
// Recorded 2026-11-10 from viem HDKey at m/44'/60'/1'/0/{0,1}.
export const JUNK_BINDING_0 = '0x8C8d35429F74ec245F8Ef2f4Fd1e551cFF97d650'
export const JUNK_BINDING_1 = '0x40FBBE484b8Ee6139Af08446950B088e10b2306A'

export const ABANDON_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
export const ABANDON_PAYMENT_0 = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'

/** Generated for these tests only; holds no funds. */
export const OTHER_MNEMONIC = 'wave wonder voice way faculty naive luggage abandon dilemma luxury target mistake'
export const OTHER_PAYMENT_0 = '0xb182e49BeEC615c3e97D1a90330565b286b4a257'
export const OTHER_RAW_KEY: Hex = '0x5f9590f976115289df984b1a77ffe6dc1e8bd8b1594fa98b4d0d19225337ba6e'

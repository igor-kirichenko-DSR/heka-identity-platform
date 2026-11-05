import type { Address } from 'viem'

/** The OP-Stack GasPriceOracle predeploy: same address on every OP-Stack chain; its getL1Fee prices the L1 data fee. */
export const OP_GAS_PRICE_ORACLE: Address = '0x420000000000000000000000000000000000000F'

/** Multicall3 is deployed at the same address on Base and Base Sepolia. */
export const MULTICALL3_ADDRESS: Address = '0xcA11bde05977b3631167028862bE2a173976CA11'

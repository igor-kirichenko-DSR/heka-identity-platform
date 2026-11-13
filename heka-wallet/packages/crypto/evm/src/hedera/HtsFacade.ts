import type { Address, Chain, PublicClient, Transport } from 'viem'

import { parseAbi } from 'viem'

/** HIP-719: association through the token's own EVM facade. */
export const HTS_FACADE_ABI = parseAbi([
  'function associate() returns (uint256)',
  'function isAssociated() view returns (bool)',
])

/** Whether `holder` can receive the token. The facade answers for the caller, so the call is made as the holder. */
export const isAssociated = (
  client: PublicClient<Transport, Chain>,
  token: Address,
  holder: Address
): Promise<boolean> =>
  client.readContract({ address: token, abi: HTS_FACADE_ABI, functionName: 'isAssociated', account: holder })

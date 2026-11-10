import type { KeyProvider } from '@heka-wallet/crypto-core'
import type { Address, Hex, LocalAccount, TransactionSerializableEIP1559 } from 'viem'

import { sameAddress } from '@heka-wallet/crypto-core'
import { parseTransaction } from 'viem'

import { EvmAdapterError } from './errors'

/** The chain id and type are set by the signer, never by the caller. */
export type UnsignedEvmTransaction = Omit<TransactionSerializableEIP1559, 'chainId' | 'type'>

export interface EvmSigner {
  readonly address: Address
  /** Returns the serialized signed transaction, pinned to the signer's chain (EIP-155). */
  signTransaction(tx: UnsignedEvmTransaction): Promise<Hex>
}

/** Opens the payment key only for fn; the key never leaves the KeyProvider scope. */
export const withEvmAccount = <T>(
  keys: KeyProvider,
  index: number,
  sender: string,
  chainId: number,
  fn: (signer: EvmSigner) => Promise<T>
): Promise<T> =>
  keys.withAccount('payment', index, async (account: LocalAccount) => {
    if (!sameAddress(account.address, sender)) {
      throw new EvmAdapterError(`Key #${index} does not belong to the sender ${sender}`)
    }
    const signer: EvmSigner = {
      address: account.address,
      signTransaction: async (tx) => {
        const serialized = await account.signTransaction({ ...tx, type: 'eip1559', chainId })
        if (parseTransaction(serialized).chainId !== chainId) {
          throw new EvmAdapterError(`Signed payload is not pinned to chain ${chainId}`)
        }
        return serialized
      },
    }
    return fn(signer)
  })

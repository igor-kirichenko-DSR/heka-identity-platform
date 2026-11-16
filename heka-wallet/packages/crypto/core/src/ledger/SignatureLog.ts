import type { CoreLogger } from '../logger'
import type { SigningBranch, SigningKind } from '../requests'
import type { ChainId } from '../types'
import type { LedgerStorage } from './LedgerStorage'

import { LedgerError } from '../errors'
import { isChainId } from '../utils'

/** What the holder signed, for their own audit. Never the payload or the signature. */
export interface SignatureRecord {
  /** The relying party's request id. */
  id: string
  /** scheme://host[:port] of the request URL. */
  origin: string
  kind: SigningKind
  chainId: ChainId
  branch: SigningBranch
  address: string
  /** Epoch milliseconds. */
  signedAt: number
}

const KINDS: readonly string[] = ['eip712', 'siwe', 'personal_sign']
const BRANCHES: readonly string[] = ['payment', 'binding']

const keyOf = (record: Pick<SignatureRecord, 'origin' | 'id'>): string => `${record.origin}|${record.id}`

const parse = (value: string): SignatureRecord => {
  const data: unknown = JSON.parse(value)
  if (typeof data !== 'object' || data === null) throw new LedgerError('A signature entry is not an object')
  const { id, origin, kind, chainId, branch, address, signedAt } = data as Record<string, unknown>
  if (
    typeof id !== 'string' ||
    typeof origin !== 'string' ||
    typeof address !== 'string' ||
    typeof signedAt !== 'number' ||
    typeof kind !== 'string' ||
    !KINDS.includes(kind) ||
    typeof branch !== 'string' ||
    !BRANCHES.includes(branch) ||
    typeof chainId !== 'string' ||
    !isChainId(chainId)
  ) {
    throw new LedgerError('A signature entry is malformed')
  }
  return { id, origin, kind: kind as SigningKind, chainId, branch: branch as SigningBranch, address, signedAt }
}

/** The signed requests, on its own storage category (the send ledger holds sends only). */
export class SignatureLog {
  constructor(
    private readonly storage: LedgerStorage,
    private readonly logger: CoreLogger
  ) {}

  async put(record: SignatureRecord): Promise<void> {
    await this.storage.put(
      keyOf(record),
      JSON.stringify({
        id: record.id,
        origin: record.origin,
        kind: record.kind,
        chainId: record.chainId,
        branch: record.branch,
        address: record.address,
        signedAt: record.signedAt,
      }),
      { origin: record.origin, kind: record.kind, branch: record.branch }
    )
  }

  /** Newest first; an unreadable entry is logged and left out. */
  async list(): Promise<SignatureRecord[]> {
    const records: SignatureRecord[] = []
    for (const { key, value } of await this.storage.list()) {
      try {
        records.push(parse(value))
      } catch (error) {
        this.logger.error('Skipping an unreadable signature entry', { key, error: String(error) })
      }
    }
    return records.sort((a, b) => b.signedAt - a.signedAt)
  }
}

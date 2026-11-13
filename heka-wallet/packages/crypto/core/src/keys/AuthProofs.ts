import type { AuthProof } from './KeyProvider'

import { AuthProofError } from '../errors'

/** How long after the PIN or biometry check a proof is accepted. */
export const AUTH_PROOF_MAX_AGE_MS = 60_000

interface ProofState {
  issuedAt: number
  used: boolean
}

/** Issues opaque one-use proofs and checks them; a proof from another registry is unknown here. */
export class AuthProofRegistry {
  private readonly proofs = new WeakMap<object, ProofState>()

  constructor(private readonly now: () => number = Date.now) {}

  issue(): AuthProof {
    const proof = Object.freeze({})
    this.proofs.set(proof, { issuedAt: this.now(), used: false })
    return proof as AuthProof
  }

  /** Accepts a proof once; refuses one that is missing, foreign, used or older than AUTH_PROOF_MAX_AGE_MS. */
  consume(proof: AuthProof | undefined): void {
    const state = typeof proof === 'object' && proof !== null ? this.proofs.get(proof) : undefined
    if (!state) throw new AuthProofError('Authentication is required')
    if (state.used) throw new AuthProofError('Authentication was already used; confirm again')
    state.used = true
    const age = this.now() - state.issuedAt
    if (age < 0 || age > AUTH_PROOF_MAX_AGE_MS) throw new AuthProofError('Authentication has expired; confirm again')
  }
}

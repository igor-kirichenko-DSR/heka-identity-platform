import { registerAs } from '@nestjs/config'

/**
 * Accreditation credentials (phase 7 of docs/role-model-and-oidc-providers.md): the parent wallet signs an SD-JWT VC
 * for every public DID of an organization (`Administration` accredits it) and of an issuer (its organization
 * accredits it). A relying party follows the chain up to a trust anchor; revoking an accreditation cuts off
 * everything the child signed. Issuance needs `ROLE_MODEL_ENABLED=true`, because only then the hierarchy exists.
 */
export interface AccreditationConfig {
  /** `ACCREDITATION_ENABLED`: issue, revoke and check accreditations. */
  enabled: boolean
  /** `ACCREDITATION_VALIDITY_DAYS`: lifetime of an accreditation; `POST /prepare-wallet` renews expired ones. */
  validityDays: number
  /** `ACCREDITATION_STATUS_LIST_SIZE`: entries per status list. */
  statusListSize: number
  /** `ACCREDITATION_STATUS_LIST_TTL`: seconds a relying party may cache a status list. */
  statusListTtl: number
  /**
   * `ACCREDITATION_TRUST_ANCHORS`: comma-separated DIDs the chain must end at. Empty means the DIDs of the
   * `Administration` wallet.
   */
  trustAnchors: string[]
}

const positiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = value ? parseInt(value, 10) : NaN
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export default registerAs('accreditation', (): AccreditationConfig => ({
  enabled: process.env.ACCREDITATION_ENABLED?.toLowerCase() === 'true',
  validityDays: positiveInt(process.env.ACCREDITATION_VALIDITY_DAYS, 365),
  statusListSize: positiveInt(process.env.ACCREDITATION_STATUS_LIST_SIZE, 16384),
  statusListTtl: positiveInt(process.env.ACCREDITATION_STATUS_LIST_TTL, 300),
  trustAnchors: (process.env.ACCREDITATION_TRUST_ANCHORS ?? '')
    .split(',')
    .map((did) => did.trim())
    .filter(Boolean),
}))

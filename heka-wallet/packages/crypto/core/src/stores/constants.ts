/** The only account index used until multi-account support exists. */
export const DEFAULT_ACCOUNT_INDEX = 0

/** Balance polling starts at this interval and doubles after every poll. */
export const BALANCE_POLL_INITIAL_MS = 10_000

/** Upper bound of the balance polling interval. */
export const BALANCE_POLL_MAX_MS = 120_000

/** How often a pending send's status is checked. */
export const TX_STATUS_POLL_MS = 5_000

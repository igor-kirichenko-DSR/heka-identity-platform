/** Words in a newly created recovery phrase. */
export const NEW_PHRASE_WORDS = 12

/** Words the holder puts back in order to prove the phrase was written down. */
export const VERIFY_WORD_COUNT = 4

/** Wait after the last form change before asking the adapter for a fee quote. */
export const FEE_QUOTE_DEBOUNCE_MS = 500

/** How long the "copied" feedback stays. */
export const COPY_FEEDBACK_MS = 2000

/** Side of the Receive QR code. */
export const RECEIVE_QR_SIZE = 220

/** AsyncStorage key of the holder's default chain; a chain id, not a secret. */
export const DEFAULT_CHAIN_STORAGE_KEY = 'crypto.defaultChain'

/** Characters kept at each end of a shortened address. */
export const SHORT_ADDRESS_CHARS = 6

/** Columns of the recovery phrase grid on the new-phrase and reveal screens. */
export const NEW_PHRASE_COLUMNS = 3

/** Columns of the answer slots on the verify screen. */
export const VERIFY_GRID_COLUMNS = 3

/** Minimum width of a candidate word chip, so short words stay easy to hit. */
export const CANDIDATE_CHIP_MIN_WIDTH = 72

/** Width and height of the logo shown on the register intro and end screens. */
export const REGISTER_ILLUSTRATION_WIDTH = 160
export const REGISTER_ILLUSTRATION_HEIGHT = 80

/** Minimum height of the import input. */
export const IMPORT_INPUT_MIN_HEIGHT = 120

/** Minimum height of a recovery phrase tile. */
export const WORD_TILE_MIN_HEIGHT = 100

/** Size of a step dot, and the width of the current one. */
export const STEP_DOT_SIZE = 8
export const STEP_DOT_ACTIVE_WIDTH = 24

/** Right padding of an input that has an icon or symbol drawn inside its right edge. */
export const ADDRESS_ACCESSORY_WIDTH = 56
export const AMOUNT_ACCESSORY_WIDTH = 120

/** Debug builds only: how many quick taps copy the new phrase, and the longest pause between two of them. */
export const DEBUG_COPY_TAPS = 5
export const DEBUG_COPY_TAP_GAP_MS = 800

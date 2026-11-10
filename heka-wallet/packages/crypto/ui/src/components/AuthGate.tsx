import { PinConfirmation } from '@heka-wallet/shared'
import React from 'react'

export interface AuthGateProps {
  visible: boolean
  title: string
  onSuccess: () => void
  onClose: () => void
}

/** The PIN step of useAuthProof; biometry needs no UI of its own. */
export const AuthGate: React.FC<AuthGateProps> = ({ visible, title, onSuccess, onClose }) =>
  visible ? <PinConfirmation title={title} onSuccess={onSuccess} onClose={onClose} /> : null

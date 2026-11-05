import { useCallback, useEffect, useState } from 'react'

import { useRegisterFlow } from '../navigators/RegisterFlowContext'
import { useCrypto } from '../provider/CryptoContext'

export type BackupState = 'idle' | 'running' | 'done' | 'failed'

/** The Done screen: offer the passkey backup where the app has it, then leave the register flow. */
export const useBackupPrompt = () => {
  const { backup, logger, wallet } = useCrypto()
  const { setFinishing, setPhrase } = useRegisterFlow()
  const [state, setState] = useState<BackupState>('idle')

  // The phrase is stored now; drop the in-memory copy (cleared here, not before Done is on screen).
  useEffect(() => setPhrase(undefined), [setPhrase])

  const backupNow = useCallback(async () => {
    if (!backup) return
    setState('running')
    try {
      await backup.backupNow()
      setState('done')
    } catch (error) {
      logger.error('Backup after storing the seed failed', { error: String(error) })
      setState('failed')
    }
  }, [backup, logger])

  const finish = useCallback(() => setFinishing(false), [setFinishing])

  return { isAvailable: !!backup, isRawKey: wallet.status === 'raw', state, backupNow, finish }
}

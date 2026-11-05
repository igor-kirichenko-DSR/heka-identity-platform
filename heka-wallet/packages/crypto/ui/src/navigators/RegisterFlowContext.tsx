import React, { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react'

/** Which way the holder came in; it decides the step count of the progress header. */
export type RegisterKind = 'create' | 'import'

export interface RegisterFlow {
  kind: RegisterKind | undefined
  setKind: (kind: RegisterKind) => void
  /** The new phrase until it is verified and stored; kept in memory only. */
  phrase: string | undefined
  setPhrase: (phrase: string | undefined) => void
  /** True from the moment a seed is being stored until the holder leaves the Done screen. */
  isFinishing: boolean
  setFinishing: (finishing: boolean) => void
}

const RegisterFlowContext = createContext<RegisterFlow | null>(null)

export const RegisterFlowProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [phrase, setPhrase] = useState<string>()
  const [isFinishing, setFinishing] = useState(false)
  const [kind, setKind] = useState<RegisterKind>()
  const value = useMemo(
    () => ({ kind, setKind, phrase, setPhrase, isFinishing, setFinishing }),
    [kind, phrase, isFinishing]
  )
  return <RegisterFlowContext.Provider value={value}>{children}</RegisterFlowContext.Provider>
}

export const useRegisterFlow = (): RegisterFlow => {
  const flow = useContext(RegisterFlowContext)
  if (!flow) throw new Error('useRegisterFlow must be used inside RegisterFlowProvider')
  return flow
}

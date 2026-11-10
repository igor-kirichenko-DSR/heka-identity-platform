import React, { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react'

export interface RegisterFlow {
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
  const value = useMemo(() => ({ phrase, setPhrase, isFinishing, setFinishing }), [phrase, isFinishing])
  return <RegisterFlowContext.Provider value={value}>{children}</RegisterFlowContext.Provider>
}

export const useRegisterFlow = (): RegisterFlow => {
  const flow = useContext(RegisterFlowContext)
  if (!flow) throw new Error('useRegisterFlow must be used inside RegisterFlowProvider')
  return flow
}

import type { CryptoMainStackParams } from '../navigators/types'
import type { StackScreenProps } from '@react-navigation/stack'

import { observer } from 'mobx-react-lite'
import React, { useEffect } from 'react'

import { AuthGate } from '../components/AuthGate'
import { SendForm } from '../components/SendForm'
import { SendStatus } from '../components/SendStatus'
import { useSendForm } from '../hooks/useSendForm'
import { useSendSubmit } from '../hooks/useSendSubmit'
import { CryptoScreens } from '../navigators/routes'

type Props = StackScreenProps<CryptoMainStackParams, CryptoScreens.Send>

export const Send: React.FC<Props> = observer(({ navigation, route }) => {
  const form = useSendForm()
  const { submit, sent, isSending, error, gateProps } = useSendSubmit()
  const prefill = route.params?.prefill
  const { applyPrefill } = form

  // A scanned payment request arrives as params once; applied, then cleared so a re-render does not re-apply it.
  useEffect(() => {
    if (!prefill) return
    applyPrefill(prefill)
    navigation.setParams({ prefill: undefined })
  }, [prefill, applyPrefill, navigation])

  const onSend = () => {
    if (form.request && form.quote) void submit(form.request, form.quote)
  }

  return (
    <>
      {sent ? (
        <SendStatus sent={sent} onDone={() => navigation.goBack()} />
      ) : (
        <SendForm
          form={form}
          onScan={() => navigation.navigate(CryptoScreens.ScanAddress)}
          onSend={onSend}
          isSending={isSending}
          submitError={error}
        />
      )}
      <AuthGate {...gateProps} />
    </>
  )
})

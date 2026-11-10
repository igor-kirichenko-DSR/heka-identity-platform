import { act, fireEvent, screen } from '@testing-library/react-native'
import React, { useEffect } from 'react'
import { Text } from 'react-native'

import { useRegisterFlow } from '../../../src/navigators/RegisterFlowContext'
import { RegisterDone } from '../../../src/screens/register/RegisterDone'
import { makeServices, OTHER_MNEMONIC, OTHER_RAW_KEY, renderWithServices } from '../../helpers/services'

jest.mock('@bifold/core', () => require('../../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../../helpers/mocks').i18nMock())

/** Starts in the state a stored seed leaves: finishing, phrase still in memory. */
const FlowState: React.FC = () => {
  const { isFinishing, setFinishing, phrase, setPhrase } = useRegisterFlow()
  useEffect(() => {
    setFinishing(true)
    setPhrase(OTHER_MNEMONIC)
  }, [setFinishing, setPhrase])
  return <Text testID="FlowState">{`${isFinishing}|${phrase ?? ''}`}</Text>
}

const renderDone = (services = makeServices()) =>
  renderWithServices(
    <>
      <FlowState />
      <RegisterDone />
    </>,
    services
  )

describe('RegisterDone', () => {
  it('runs the passkey backup when the app has it', async () => {
    const backupNow = jest.fn(async () => undefined)
    renderDone(makeServices(undefined, { backup: { backupNow } }))

    await act(async () => fireEvent.press(screen.getByTestId('CryptoBackupNow')))

    expect(backupNow).toHaveBeenCalled()
    expect(screen.getByText('Crypto.Register.Done.BackupDone')).toBeTruthy()
    expect(screen.queryByTestId('CryptoBackupNow')).toBeNull()
  })

  it('reports a failed backup and still offers it again', async () => {
    const backupNow = jest.fn(async () => Promise.reject(new Error('passkey cancelled')))
    renderDone(makeServices(undefined, { backup: { backupNow } }))

    await act(async () => fireEvent.press(screen.getByTestId('CryptoBackupNow')))

    expect(screen.getByText('Crypto.Register.Done.BackupFailed')).toBeTruthy()
    expect(screen.getByTestId('CryptoBackupNow')).toBeTruthy()
  })

  it('says the phrase is the backup when the app has no passkey backup', () => {
    renderDone()

    expect(screen.getByText('Crypto.Register.Done.PhraseIsBackup')).toBeTruthy()
    expect(screen.queryByTestId('CryptoBackupNow')).toBeNull()
  })

  it('reminds a raw-key wallet to keep its key', async () => {
    const services = makeServices()
    await services.wallet.importRawKey(OTHER_RAW_KEY)

    renderDone(services)

    expect(screen.getByText('Crypto.Register.Done.RawKeyText')).toBeTruthy()
  })

  it('drops the phrase from memory and leaves the register flow', () => {
    renderDone()
    expect(screen.getByTestId('FlowState').props.children).toBe('true|')

    fireEvent.press(screen.getByTestId('CryptoOpenWallet'))

    expect(screen.getByTestId('FlowState').props.children).toBe('false|')
  })
})

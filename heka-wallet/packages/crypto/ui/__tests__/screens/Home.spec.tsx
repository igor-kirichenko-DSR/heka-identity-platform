import type { Account, AssetDescriptor } from '@heka-wallet/crypto-core'

import Clipboard from '@react-native-clipboard/clipboard'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import React from 'react'

import { CryptoScreens } from '../../src/navigators/routes'
import { Home } from '../../src/screens/Home'
import { navigation, screenProps } from '../helpers/navigation'
import {
  BASE_SEPOLIA,
  makeChain,
  makeServices,
  OTHER_MNEMONIC,
  OTHER_PAYMENT_0,
  renderWithServices,
  type TestServices,
  usdcOn,
} from '../helpers/services'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())
jest.mock('react-i18next', () => require('../helpers/mocks').i18nMock())
jest.mock('@react-native-clipboard/clipboard', () => require('../helpers/mocks').clipboardMock())

const HEDERA_EVM = 'eip155:296'
const ETH = BigInt('1500000000000000000')
const USDC = BigInt(2250000)

const ready = async (services: TestServices) => {
  services.adapters.forEach((adapter) =>
    adapter.getBalances.mockImplementation(async (_account: Account, assets: AssetDescriptor[]) =>
      Object.fromEntries(assets.map((asset) => [asset.id, asset.kind === 'native' ? ETH : USDC]))
    )
  )
  await services.wallet.importPhrase(OTHER_MNEMONIC)
  services.balances.start()
  await services.balances.refresh()
  return services
}

describe('Home', () => {
  const started: TestServices[] = []
  const setup = async (chains = [makeChain(BASE_SEPOLIA)]) => {
    const services = await ready(makeServices(chains))
    started.push(services)
    renderWithServices(<Home {...screenProps()} />, services)
    await act(async () => undefined)
    return services
  }

  afterEach(() => started.splice(0).forEach((services) => services.balances.dispose()))

  it('shows the balances of the current chain from bigint values', async () => {
    await setup()

    expect(screen.getByText('1.5 ETH')).toBeTruthy()
    expect(screen.getByText('2.25 USDC')).toBeTruthy()
  })

  it('shows the stablecoin as the hero balance and the native asset as a block', async () => {
    await setup([makeChain(BASE_SEPOLIA, { assets: [usdcOn(BASE_SEPOLIA)] })])

    expect(screen.getByText('Crypto.Home.BalanceOf {"symbol":"USDC"}')).toBeTruthy()
    expect(screen.getByTestId('CryptoBalance-USDC')).toBeTruthy()
    expect(screen.getByTestId('CryptoBalance-ETH')).toBeTruthy()
  })

  it('switches the chain', async () => {
    const services = await setup([makeChain(BASE_SEPOLIA), makeChain(HEDERA_EVM, { name: 'Hedera' })])

    fireEvent.press(screen.getByTestId('CryptoChain-Hedera'))

    expect(services.accounts.currentChainId).toBe(HEDERA_EVM)
  })

  it('copies the address', async () => {
    await setup()

    fireEvent.press(screen.getByTestId('CryptoCopyAddress'))

    expect(Clipboard.setString).toHaveBeenCalledWith(OTHER_PAYMENT_0)
  })

  it('refreshes the balances on pull-to-refresh', async () => {
    const services = await setup()
    const calls = services.adapters[0].getBalances.mock.calls.length

    await act(async () => screen.getByTestId('CryptoHome').props.refreshControl.props.onRefresh())

    expect(services.adapters[0].getBalances.mock.calls.length).toBeGreaterThan(calls)
  })

  it('opens Settings from the card', async () => {
    await setup()

    fireEvent.press(screen.getByTestId('CryptoSettings'))

    expect(navigation.navigate).toHaveBeenCalledWith(CryptoScreens.Settings)
  })

  it('opens Receive and Send', async () => {
    await setup()

    fireEvent.press(screen.getByTestId('CryptoReceive'))
    fireEvent.press(screen.getByTestId('CryptoSend'))

    expect(navigation.navigate).toHaveBeenCalledWith(CryptoScreens.Receive)
    expect(navigation.navigate).toHaveBeenCalledWith(CryptoScreens.Send)
  })

  it('shows no activation banner and no enable button on a chain without them', async () => {
    await setup()

    expect(screen.queryByTestId('CryptoActivationBanner')).toBeNull()
    expect(screen.queryByTestId('CryptoEnable-USDC')).toBeNull()
  })

  describe('Hedera specifics from the adapter', () => {
    const hedera = makeChain(HEDERA_EVM, { name: 'Hedera', assets: [usdcOn(HEDERA_EVM)] })

    const setupHedera = async (enabled: boolean) => {
      const services = makeServices([hedera])
      const adapter = services.adapters[0] as TestServices['adapters'][number] & {
        activationState: jest.Mock
        isAssetEnabled: jest.Mock
        enableAsset: jest.Mock
      }
      adapter.activationState = jest.fn(async () => 'pending')
      adapter.isAssetEnabled = jest.fn(async () => enabled)
      adapter.enableAsset = jest.fn(async () => ({ txId: '0x1' }))
      await ready(services)
      started.push(services)
      renderWithServices(<Home {...screenProps()} />, services)
      await act(async () => undefined)
      return adapter
    }

    it('shows the activation banner while the account is pending', async () => {
      await setupHedera(true)

      await waitFor(() => expect(screen.getByTestId('CryptoActivationBanner')).toBeTruthy())
      expect(screen.queryByTestId('CryptoEnable-USDC')).toBeNull()
    })

    it('enables USDC after the PIN', async () => {
      const adapter = await setupHedera(false)
      await waitFor(() => expect(screen.getByTestId('CryptoEnable-USDC')).toBeTruthy())

      act(() => {
        fireEvent.press(screen.getByTestId('CryptoEnable-USDC'))
      })
      expect(adapter.enableAsset).not.toHaveBeenCalled()
      await act(async () => fireEvent.press(screen.getByTestId('PinSuccess')))

      await waitFor(() => expect(adapter.enableAsset).toHaveBeenCalled())
      expect(adapter.enableAsset).toHaveBeenCalledWith(
        expect.objectContaining({ chainId: HEDERA_EVM }),
        expect.objectContaining({ symbol: 'USDC' }),
        expect.anything()
      )
    })

    it('does not enable USDC when the PIN is cancelled', async () => {
      const adapter = await setupHedera(false)
      await waitFor(() => expect(screen.getByTestId('CryptoEnable-USDC')).toBeTruthy())

      act(() => {
        fireEvent.press(screen.getByTestId('CryptoEnable-USDC'))
      })
      await act(async () => fireEvent.press(screen.getByTestId('PinClose')))

      expect(adapter.enableAsset).not.toHaveBeenCalled()
    })
  })
})

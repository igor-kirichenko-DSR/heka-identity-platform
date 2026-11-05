import AsyncStorage from '@react-native-async-storage/async-storage'

import { DEFAULT_CHAIN_STORAGE_KEY } from '../../src/constants'
import { AsyncStorageChainPreference } from '../../src/provider/AsyncStorageChainPreference'

describe('AsyncStorageChainPreference', () => {
  beforeEach(() => AsyncStorage.clear())

  it('has no default chain before one is saved', async () => {
    expect(await new AsyncStorageChainPreference().get()).toBeUndefined()
  })

  it('reads back the saved chain', async () => {
    const preference = new AsyncStorageChainPreference()

    await preference.set('eip155:84532')

    expect(await preference.get()).toBe('eip155:84532')
  })

  it('ignores a stored value that is not a chain id', async () => {
    await AsyncStorage.setItem(DEFAULT_CHAIN_STORAGE_KEY, 'not-a-chain')

    expect(await new AsyncStorageChainPreference().get()).toBeUndefined()
  })
})

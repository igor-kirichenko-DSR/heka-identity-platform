import { render } from '@testing-library/react-native'
import React from 'react'

import { CryptoContext, useOptionalCrypto } from '../../src/provider/CryptoContext'
import { makeServices } from '../helpers/services'

describe('useOptionalCrypto', () => {
  it('returns null without a provider', () => {
    let value: unknown = 'unset'
    const Probe = () => {
      value = useOptionalCrypto()
      return null
    }
    render(<Probe />)
    expect(value).toBeNull()
  })

  it('returns the services inside a provider', () => {
    const services = makeServices()
    let value: unknown
    const Probe = () => {
      value = useOptionalCrypto()
      return null
    }
    render(
      <CryptoContext.Provider value={services}>
        <Probe />
      </CryptoContext.Provider>
    )
    expect(value).toBe(services)
  })
})

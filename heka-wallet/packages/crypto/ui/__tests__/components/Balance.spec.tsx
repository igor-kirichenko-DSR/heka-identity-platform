import { render, screen } from '@testing-library/react-native'
import React from 'react'
import { ActivityIndicator } from 'react-native'

import { AssetBalanceBlock } from '../../src/components/AssetBalanceBlock'
import { HeroBalance } from '../../src/components/HeroBalance'

jest.mock('@bifold/core', () => require('../helpers/mocks').bifoldMock())
jest.mock('@heka-wallet/shared', () => require('../helpers/mocks').sharedMock())

describe('HeroBalance', () => {
  it('shows the label and the amount without a spinner', () => {
    const { UNSAFE_queryByType } = render(<HeroBalance label="USDC" amount="12.5 USDC" />)

    expect(screen.getByText('USDC')).toBeTruthy()
    expect(screen.getByText('12.5 USDC')).toBeTruthy()
    expect(UNSAFE_queryByType(ActivityIndicator)).toBeNull()
  })

  it('shows a spinner while the balance is loading', () => {
    const { UNSAFE_queryByType } = render(<HeroBalance label="USDC" />)

    expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy()
  })
})

describe('AssetBalanceBlock', () => {
  it('shows the label and the amount without a spinner', () => {
    const { UNSAFE_queryByType } = render(<AssetBalanceBlock label="ETH" amount="0.5 ETH" />)

    expect(screen.getByText('ETH')).toBeTruthy()
    expect(screen.getByText('0.5 ETH')).toBeTruthy()
    expect(UNSAFE_queryByType(ActivityIndicator)).toBeNull()
  })

  it('shows a spinner while the balance is loading', () => {
    const { UNSAFE_queryByType } = render(<AssetBalanceBlock label="ETH" />)

    expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy()
  })
})

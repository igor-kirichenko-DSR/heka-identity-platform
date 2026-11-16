import type { SigningRequest } from '@heka-wallet/crypto-core'

import { testIdWithKey } from '@bifold/core'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { ListItem } from './ListItem'
import { ListSection } from './ListSection'

interface Props {
  origin: string
  chainName: string
  address: string
  branch: SigningRequest['branch']
}

/** Who asks, on which chain, and with which address and branch the holder would sign. */
export const SignSummary: React.FC<Props> = ({ origin, chainName, address, branch }) => {
  const { t } = useTranslation()

  return (
    <ListSection title={t('Crypto.Sign.Request')}>
      <ListItem label={t('Crypto.Sign.Origin')} paragraph={origin} testID={testIdWithKey('CryptoSignOrigin')} />
      <ListItem label={t('Crypto.Sign.Chain')} paragraph={chainName} />
      <ListItem label={t('Crypto.Sign.Address')} paragraph={address} testID={testIdWithKey('CryptoSignAddress')} />
      <ListItem label={t('Crypto.Sign.Branch')} paragraph={t(`Crypto.Sign.Branches.${branch}`)} />
    </ListSection>
  )
}

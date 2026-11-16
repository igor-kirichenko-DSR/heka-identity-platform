import type { SigningRequest } from '@heka-wallet/crypto-core'

import { testIdWithKey } from '@bifold/core'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Text } from 'react-native'

import { ListItem } from './ListItem'
import { ListSection } from './ListSection'
import { TypedDataTree } from './TypedDataTree'

interface Props {
  request: SigningRequest
}

/** What the holder is about to sign, decoded per kind. */
export const SignContent: React.FC<Props> = ({ request }) => {
  const { t } = useTranslation()
  const title = t('Crypto.Sign.Content')

  switch (request.kind) {
    case 'eip712':
      return (
        <ListSection title={title}>
          <ListItem label={t('Crypto.Sign.PrimaryType')} paragraph={request.payload.primaryType} />
          <TypedDataTree value={{ domain: request.payload.domain, message: request.payload.message }} />
        </ListSection>
      )
    case 'siwe':
      return (
        <ListSection title={title}>
          <ListItem label={t('Crypto.Sign.Site')} paragraph={request.payload.domain} />
          {!!request.payload.statement && (
            <ListItem label={t('Crypto.Sign.Statement')} paragraph={request.payload.statement} />
          )}
          <ListItem label={t('Crypto.Sign.Uri')} paragraph={request.payload.uri} />
          <ListItem label={t('Crypto.Sign.Nonce')} paragraph={request.payload.nonce} />
          {!!request.payload.expirationTime && (
            <ListItem label={t('Crypto.Sign.Expires')} paragraph={request.payload.expirationTime} />
          )}
        </ListSection>
      )
    default:
      return (
        <ListSection title={title}>
          <Text testID={testIdWithKey('CryptoSignNonce')}>{request.payload.message}</Text>
        </ListSection>
      )
  }
}

import type { TxStatus } from '@heka-wallet/crypto-core'

import { testIdWithKey } from '@bifold/core'
import { type HekaTheme, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text } from 'react-native'

const useStyles = ({ Spacing, BorderRadius, ColorPalette, TextTheme }: HekaTheme) =>
  StyleSheet.create({
    chip: {
      ...TextTheme.caption,
      alignSelf: 'flex-start',
      paddingHorizontal: Spacing.xs,
      paddingVertical: Spacing.xxxxs,
      borderRadius: BorderRadius.small,
      overflow: 'hidden',
    },
    pending: { backgroundColor: ColorPalette.notification.info, color: ColorPalette.grayscale.white },
    success: { backgroundColor: ColorPalette.semantic.successTransparent, color: ColorPalette.semantic.success },
    failed: { backgroundColor: ColorPalette.semantic.errorTransparent, color: ColorPalette.semantic.error },
    unknown: { backgroundColor: ColorPalette.notification.warn, color: ColorPalette.notification.warnText },
  })

export const StatusChip: React.FC<{ status: TxStatus }> = ({ status }) => {
  const styles = useStyles(useHekaTheme())
  const { t } = useTranslation()

  return (
    <Text style={[styles.chip, styles[status]]} testID={testIdWithKey(`CryptoStatus-${status}`)}>
      {t(`Crypto.Status.${status}`)}
    </Text>
  )
}

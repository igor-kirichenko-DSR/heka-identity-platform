import { Loader, useHekaTheme } from '@heka-wallet/shared'
import React from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import { Modal, Portal } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

const useStyles = (height?: number) => {
  const { LoadingTheme } = useHekaTheme()

  return StyleSheet.create({
    container: {
      minHeight: height,
      width: '100%',
      flexDirection: 'column',
      justifyContent: 'center',
      alignSelf: 'center',
      backgroundColor: LoadingTheme.backgroundColor,
    },
  })
}

const LoadingView: React.FC = () => {
  const { height } = useWindowDimensions()
  const styles = useStyles(height)

  return (
    <SafeAreaView style={styles.container}>
      <Loader />
    </SafeAreaView>
  )
}

export { Loader }

export default LoadingView

export const LoaderModal: React.FC = () => {
  return (
    <Portal theme={{ colors: { backdrop: 'rgba(0,0,0, 0.5)' } }}>
      <Modal visible dismissable={false} style={{ backgroundColor: 'transparent' }}>
        <Loader />
      </Modal>
    </Portal>
  )
}

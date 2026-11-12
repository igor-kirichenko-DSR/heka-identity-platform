// Module mocks shared by the crypto-ui tests: jest.mock('<module>', () => require('../helpers/mocks').<factory>()).
import type { PropsWithChildren } from 'react'

import React from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'

/** The Bifold store state the hooks read; tests change it before rendering. */
export const bifoldState = {
  authentication: { didAuthenticate: true },
  preferences: { useBiometry: false },
}

export const preventScreenCapture = jest.fn()

interface ButtonProps {
  title: string
  onPress?: () => void
  disabled?: boolean
  testID?: string
  children?: React.ReactNode
}

const MockButton: React.FC<ButtonProps> = ({ title, onPress, disabled, testID, children }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ disabled: !!disabled }}
  >
    <Text>{title}</Text>
    {children}
  </TouchableOpacity>
)

/** Stands in for the deep import of Bifold's ButtonLoading: jest.mock('@bifold/core/src/components/animated/ButtonLoading', ...). */
export const buttonLoadingMock = () => ({
  __esModule: true,
  default: () => <Text testID="ButtonLoading">loading</Text>,
})

const MockQRRenderer: React.FC<{ value: string }> = ({ value }) => <Text testID="QRRenderer">{value}</Text>

interface ScanCameraProps {
  handleCodeScan: (value: string) => Promise<void>
}

/** Pressing the fake camera "scans" the value a test put in scanValue. */
export const scanValue = { current: '' }
const MockScanCamera: React.FC<ScanCameraProps> = ({ handleCodeScan }) => (
  <TouchableOpacity testID="ScanCamera" onPress={() => void handleCodeScan(scanValue.current)}>
    <Text>camera</Text>
  </TouchableOpacity>
)

export const bifoldMock = () => ({
  __esModule: true,
  Button: MockButton,
  KeyboardView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  ButtonType: { Primary: 1, Secondary: 2, Critical: 0, Tertiary: 3 },
  QRRenderer: MockQRRenderer,
  ScanCamera: MockScanCamera,
  testIdWithKey: (key: string) => key,
  usePreventScreenCapture: preventScreenCapture,
  useStore: () => [bifoldState, jest.fn()],
})

const themeProxy: unknown = new Proxy(
  {},
  {
    get: (_target, property) => (property === 'then' ? undefined : themeProxy),
  }
)

interface PinProps {
  title?: string
  onSuccess: () => void
  onClose: () => void
}

const MockPinConfirmation: React.FC<PinProps> = ({ onSuccess, onClose }) => (
  <View testID="PinConfirmation">
    <TouchableOpacity testID="PinSuccess" onPress={onSuccess}>
      <Text>pin ok</Text>
    </TouchableOpacity>
    <TouchableOpacity testID="PinClose" onPress={onClose}>
      <Text>pin close</Text>
    </TouchableOpacity>
  </View>
)

const MockScreenInfoText: React.FC<{ title: string; textLines: string[] }> = ({ title, textLines }) => (
  <View>
    <Text>{title}</Text>
    {textLines.map((line) => (
      <Text key={line}>{line}</Text>
    ))}
  </View>
)

interface InputProps {
  label?: string
  value?: string
  error?: string
  onChangeText?: (value: string) => void
  testID?: string
}

const MockTextInput: React.FC<InputProps> = ({ label, value, error, onChangeText, testID }) => (
  <View>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} testID={testID} />
    {!!error && <Text>{error}</Text>}
  </View>
)

const MockIconButton: React.FC<{ onPress: () => void; label?: string; testId?: string }> = ({
  onPress,
  label,
  testId,
}) => (
  <TouchableOpacity onPress={onPress} testID={testId}>
    <Text>{label}</Text>
  </TouchableOpacity>
)

const MockBootstrapIcon: React.FC<{ name: string }> = ({ name }) => <Text testID={`Icon-${name}`}>{name}</Text>

export const authenticateByBiometry = jest.fn<Promise<void>, [string]>()

export const sharedMock = () => ({
  __esModule: true,
  useHekaTheme: () => themeProxy,
  useGlobalStyles: () => themeProxy,
  IconSizes: themeProxy,
  PinConfirmation: MockPinConfirmation,
  ScreenInfoText: MockScreenInfoText,
  TextInput: MockTextInput,
  IconButton: MockIconButton,
  BootstrapIcon: MockBootstrapIcon,
  authenticateByBiometry,
  isBiometryCancelledError: (name: string) => name === 'UserCancel',
  // Deterministic order, so tests know which words are taken out.
  randomSort: <T,>(items: T[]) => [...items],
})

/** t(key) → key, and interpolation values appended, so tests assert on keys. */
export const i18nMock = () => {
  const t = (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key)
  return { useTranslation: () => ({ t }) }
}

export const clipboardMock = () => ({ __esModule: true, default: { setString: jest.fn() } })

export const Passthrough: React.FC<PropsWithChildren> = ({ children }) => <>{children}</>

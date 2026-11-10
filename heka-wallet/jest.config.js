// eslint-disable-next-line @typescript-eslint/no-var-requires
const baseConfig = require('./jest-helpers/jest.config-base')

const getTestRegexForPath = (path) => `(${path}/__tests__/.*(\\.|/)(test|spec))\\.[jt]sx?$`

module.exports = {
  projects: [
    {
      ...baseConfig,
      displayName: 'heka-ssi-wallet',
      testRegex: getTestRegexForPath('app'),
    },
    {
      ...baseConfig,
      displayName: '@heka-wallet/shared',
      testRegex: getTestRegexForPath('packages/shared'),
    },
    {
      ...baseConfig,
      displayName: '@heka-wallet/crypto-ui',
      testRegex: getTestRegexForPath('packages/crypto/ui'),
      moduleNameMapper: {
        ...baseConfig.moduleNameMapper,
        '^react-dom$': '<rootDir>/packages/crypto/ui/__tests__/helpers/reactDomShim.js',
      },
    },
    {
      // Pure TypeScript package: Node environment, no React Native preset or setup files
      displayName: '@heka-wallet/crypto-core',
      testEnvironment: 'node',
      testRegex: getTestRegexForPath('packages/crypto/core'),
      moduleFileExtensions: ['ts', 'js', 'json'],
      transform: { '^.+\\.[jt]s$': 'babel-jest' },
      cacheDirectory: '.jest/cache',
      clearMocks: true,
    },
    {
      displayName: '@heka-wallet/crypto-evm',
      testEnvironment: 'node',
      testRegex: getTestRegexForPath('packages/crypto/evm'),
      moduleFileExtensions: ['ts', 'js', 'json'],
      transform: { '^.+\\.[jt]s$': 'babel-jest' },
      cacheDirectory: '.jest/cache',
      clearMocks: true,
    },
  ],
}

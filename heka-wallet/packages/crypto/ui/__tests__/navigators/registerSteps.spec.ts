import { registerStep } from '../../src/navigators/registerSteps'
import { CryptoScreens } from '../../src/navigators/routes'

describe('registerStep', () => {
  it.each([
    [CryptoScreens.NewMnemonic, undefined, 0, 3],
    [CryptoScreens.VerifyMnemonic, 'create', 1, 3],
    [CryptoScreens.RegisterDone, 'create', 2, 3],
    [CryptoScreens.ImportWallet, 'import', 0, 2],
    [CryptoScreens.RegisterDone, 'import', 1, 2],
  ] as const)('%s of a %s flow is step %i of %i', (screen, kind, currentStepIndex, stepsCount) => {
    expect(registerStep(screen, kind)).toEqual({ currentStepIndex, stepsCount })
  })

  it('counts Import as an import step even when the kind was not remembered', () => {
    expect(registerStep(CryptoScreens.ImportWallet, undefined)).toEqual({ currentStepIndex: 0, stepsCount: 2 })
  })

  it('has no step for the intro', () => {
    expect(registerStep(CryptoScreens.RegisterIntro, 'create')).toBeUndefined()
  })
})

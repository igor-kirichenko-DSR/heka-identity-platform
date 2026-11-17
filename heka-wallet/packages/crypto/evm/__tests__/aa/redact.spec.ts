import { redactSecrets, safeMessage } from '../../src/aa'

describe('redactSecrets', () => {
  it('hides the API key of a bundler URL in a viem error text', () => {
    const text = 'URL: https://api.pimlico.io/v2/84532/rpc?apikey=pim_secret123\nRequest body: {}'
    expect(redactSecrets(text)).toBe('URL: https://api.pimlico.io/v2/84532/rpc?apikey=***\nRequest body: {}')
  })

  it('hides a key in the middle of a query and in other spellings', () => {
    expect(redactSecrets('https://rpc.example/x?a=1&api_key=abc&b=2')).toBe('https://rpc.example/x?a=1&api_key=***&b=2')
    expect(redactSecrets('https://rpc.example/x?key=abc')).toBe('https://rpc.example/x?key=***')
  })

  it('leaves a message without a secret as it is', () => {
    expect(redactSecrets('AA33 reverted: amount exceeds allowance')).toBe('AA33 reverted: amount exceeds allowance')
  })
})

describe('safeMessage', () => {
  it('redacts the message of an Error and stringifies anything else', () => {
    expect(safeMessage(new Error('failed at https://b.example/rpc?apikey=zzz'))).toBe(
      'failed at https://b.example/rpc?apikey=***'
    )
    expect(safeMessage('plain')).toBe('plain')
  })
})

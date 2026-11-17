import type { Address } from 'viem'

import { ForeignDelegationError } from '@heka-wallet/crypto-core'
import { createClient } from 'viem'
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'
import { recoverAuthorizationAddress } from 'viem/utils'

import { prepareSimple7702, readDelegation, toPrivateKeyOwner } from '../../src/aa'
import { createRpcMock, hex } from '../helpers/rpc'

const IMPLEMENTATION: Address = '0xe6Cae83BdE06E4c305530e199D7217f42808555B'
const FOREIGN: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const CHAIN_ID = 84532
const NONCE = 7
const MNEMONIC = 'test test test test test test test test test test test junk'

const delegationCode = (target: Address) => `0xef0100${target.slice(2).toLowerCase()}`

const clientWithCode = (code: string) => {
  const mock = createRpcMock({
    eth_getCode: () => code,
    eth_getTransactionCount: () => hex(NONCE),
    eth_chainId: () => hex(CHAIN_ID),
  })
  return { mock, client: createClient({ transport: mock.transport }) }
}

const owner = privateKeyToAccount(generatePrivateKey())

describe('readDelegation', () => {
  it('reports no delegation for an account without code', async () => {
    const { client } = clientWithCode('0x')
    expect(await readDelegation(client, owner.address, IMPLEMENTATION)).toBe('none')
  })

  it('reports the pinned implementation', async () => {
    const { client } = clientWithCode(delegationCode(IMPLEMENTATION))
    expect(await readDelegation(client, owner.address, IMPLEMENTATION)).toBe('pinned')
  })

  it('reports a delegation to another address as foreign', async () => {
    const { client } = clientWithCode(delegationCode(FOREIGN))
    expect(await readDelegation(client, owner.address, IMPLEMENTATION)).toBe('foreign')
  })

  it('reports contract code that is not a delegation as foreign', async () => {
    const { client } = clientWithCode('0x6080604052')
    expect(await readDelegation(client, owner.address, IMPLEMENTATION)).toBe('foreign')
  })
})

describe('prepareSimple7702', () => {
  const prepare = (code: string) => {
    const { client, mock } = clientWithCode(code)
    return { mock, run: () => prepareSimple7702({ client, owner, implementation: IMPLEMENTATION, chainId: CHAIN_ID }) }
  }

  it('signs an authorization for the pinned implementation on first use', async () => {
    const { run } = prepare('0x')
    const result = await run()
    expect(result.delegated).toBe(false)
    expect(result.authorization).toMatchObject({ chainId: CHAIN_ID, nonce: NONCE })
    expect(result.authorization?.address.toLowerCase()).toBe(IMPLEMENTATION.toLowerCase())
    expect(result.account.address).toBe(owner.address)
    expect(await recoverAuthorizationAddress({ authorization: result.authorization! })).toBe(owner.address)
  })

  it('sends no authorization when the account already points at the pinned implementation', async () => {
    const result = await prepare(delegationCode(IMPLEMENTATION)).run()
    expect(result.delegated).toBe(true)
    expect(result.authorization).toBeUndefined()
  })

  it('refuses a foreign delegation before anything is signed', async () => {
    const { run, mock } = prepare(delegationCode(FOREIGN))
    await expect(run()).rejects.toBeInstanceOf(ForeignDelegationError)
    expect(mock.callsOf('eth_getTransactionCount')).toHaveLength(0)
  })
})

describe('toPrivateKeyOwner', () => {
  it('keeps a private-key account as it is', () => {
    expect(toPrivateKeyOwner(owner)).toBe(owner)
  })

  it('converts an HD account to a private-key account with the same address', () => {
    const hd = mnemonicToAccount(MNEMONIC)
    const converted = toPrivateKeyOwner(hd)
    expect(converted.address).toBe(hd.address)
    expect(typeof converted.signAuthorization).toBe('function')
  })
})

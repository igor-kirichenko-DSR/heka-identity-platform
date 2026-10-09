import { createMock } from '@golevelup/ts-vitest'
import { EntityManager } from '@mikro-orm/core'
import { ConfigType } from '@nestjs/config'
import { StatusList } from '@sd-jwt/jwt-status-list'

import { Agent } from 'common/agent'
import { TokenStatusList } from 'common/entities'
import ExpressConfig from 'config/express'

import { TokenStatus, TokenStatusListService } from '../token-status-list.service'

describe('TokenStatusListService', () => {
  let service: TokenStatusListService
  let em: EntityManager
  let lists: TokenStatusList[]

  beforeEach(() => {
    lists = []
    em = createMock<EntityManager>()
    // The transaction runs on the same fake entity manager
    vi.mocked(em.transactional).mockImplementation(((callback: (em: EntityManager) => Promise<unknown>) =>
      callback(em)) as never)
    vi.mocked(em.find).mockImplementation((() => Promise.resolve(lists)) as never)
    vi.mocked(em.findOneOrFail).mockImplementation(((_entity: unknown, where: { id: string }) =>
      Promise.resolve(lists.find((list) => list.id === where.id))) as never)
    vi.mocked(em.persist).mockImplementation(((list: TokenStatusList) => {
      lists.push(list)
      return em
    }) as never)

    service = new TokenStatusListService(
      createMock<Agent>(),
      em,
      { enabled: true, validityDays: 365, statusListSize: 2, statusListTtl: 300, trustAnchors: [] },
      { appEndpoint: 'https://heka.example' } as ConfigType<typeof ExpressConfig>,
    )
  })

  test('allocates consecutive entries and starts a new list when one is full', async () => {
    const first = await service.allocate('Organization_org-1', 'did:key:org')
    const second = await service.allocate('Organization_org-1', 'did:key:org')
    const third = await service.allocate('Organization_org-1', 'did:key:org')

    expect([first.index, second.index]).toEqual([0, 1])
    expect(second.list).toBe(first.list)
    expect(third.list).not.toBe(first.list)
    expect(third.index).toBe(0)
    expect(lists).toHaveLength(2)
    expect(first.list).toMatchObject({ walletId: 'Organization_org-1', issuerDid: 'did:key:org', size: 2 })
  })

  test('a new list has every entry valid', async () => {
    const { list } = await service.allocate('Organization_org-1', 'did:key:org')

    // The list is padded to whole bytes
    expect(StatusList.decompressStatusList(list.list, 1).statusList.slice(0, 2)).toEqual([0, 0])
  })

  test('setStatus marks one entry invalid and leaves the others', async () => {
    const { list } = await service.allocate('Organization_org-1', 'did:key:org')

    await service.setStatus(list.id, 1, TokenStatus.Invalid)

    expect(StatusList.decompressStatusList(list.list, 1).statusList.slice(0, 2)).toEqual([0, 1])
    expect(await service.getStatus(list.id, 1)).toBe(TokenStatus.Invalid)
    expect(await service.getStatus(list.id, 0)).toBe(TokenStatus.Valid)
  })

  test('the status list URI is public and under the app endpoint', () => {
    expect(service.uri('list-1')).toBe('https://heka.example/accreditations/status-lists/list-1')
  })
})

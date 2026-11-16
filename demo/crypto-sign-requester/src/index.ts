// A test relying party for the Heka Wallet signing-request channel. Not for production use.
//
//   yarn start                                                # serves on 0.0.0.0:8787; the wallet is told http://10.0.2.2:8787 (Android emulator)
//   REQUESTER_BASE_URL=http://<host LAN address>:8787 yarn start   # a real device on the same network
//
// A request is created the first time the wallet (or you) GETs /requests/<id>?kind=...&branch=...&chain=...
import http from 'node:http'

import qrcode from 'qrcode-terminal'

import {
  type Branch,
  buildRequest,
  type Kind,
  type SigningRequestJson,
  verifyResponse,
  type WalletResponse,
} from './requests'

const PORT = Number(process.env.PORT ?? 8787)
const BASE_URL = (process.env.REQUESTER_BASE_URL ?? `http://10.0.2.2:${PORT}`).replace(/\/$/, '')
const DEFAULT_CHAIN = 'eip155:84532'
const MAX_BODY = 16 * 1024
const KINDS: Kind[] = ['eip712', 'siwe', 'personal_sign']
const BRANCHES: Branch[] = ['payment', 'binding']

interface Entry {
  request: SigningRequestJson
  result: { status: 'pending' } | { status: 'verified' | 'invalid'; address: string; reason?: string }
}

const entries = new Map<string, Entry>()

const send = (res: http.ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const readBody = (req: http.IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
      if (body.length > MAX_BODY) reject(new Error('body too large'))
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })

const link = (id: string, kind: Kind, branch: Branch, chain: string): string => {
  const requestUri = `${BASE_URL}/requests/${encodeURIComponent(id)}?kind=${kind}&branch=${branch}&chain=${chain}`
  return `heka-sign://?request_uri=${encodeURIComponent(requestUri)}`
}

const handle = async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
  const url = new URL(req.url ?? '/', BASE_URL)
  const [, root, id, leaf] = url.pathname.split('/')
  if (root !== 'requests' || !id) return send(res, 404, { error: 'not found' })

  if (req.method === 'GET' && !leaf) {
    let entry = entries.get(id)
    if (!entry) {
      const kind = url.searchParams.get('kind') as Kind
      const branch = (url.searchParams.get('branch') ?? 'binding') as Branch
      const chain = url.searchParams.get('chain') ?? DEFAULT_CHAIN
      if (!KINDS.includes(kind) || !BRANCHES.includes(branch)) return send(res, 400, { error: 'bad kind or branch' })
      entry = { request: buildRequest({ id, kind, branch, chain, baseUrl: BASE_URL }), result: { status: 'pending' } }
      entries.set(id, entry)
    }
    return send(res, 200, entry.request)
  }

  const entry = entries.get(id)
  if (!entry) return send(res, 404, { error: 'unknown request' })

  if (req.method === 'POST' && leaf === 'response') {
    const response = JSON.parse(await readBody(req)) as WalletResponse
    const verdict = await verifyResponse(entry.request, response)
    entry.result = { status: verdict.valid ? 'verified' : 'invalid', address: response.address, reason: verdict.reason }
    console.log(`[${id}] ${entry.result.status}`, verdict.reason ?? '', response.address)
    return send(res, 200, { ok: verdict.valid })
  }

  if (req.method === 'GET' && leaf === 'result') return send(res, 200, entry.result)
  return send(res, 404, { error: 'not found' })
}

http
  .createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      console.error(error)
      send(res, 400, { error: 'bad request' })
    })
  })
  .listen(PORT, '0.0.0.0', () => {
    console.log(`Requester on :${PORT}, wallet reaches it at ${BASE_URL}`)
    for (const kind of KINDS) {
      const text = link(`demo-${kind}`, kind, 'binding', DEFAULT_CHAIN)
      console.log(`\n${kind} (binding):\n${text}`)
      if (kind === 'siwe') qrcode.generate(text, { small: true })
    }
    console.log(`\nResult of a request: GET ${BASE_URL}/requests/<id>/result`)
  })

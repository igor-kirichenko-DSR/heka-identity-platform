import OriginalConfig from 'src/config/agent'

export default () => {
  const config = OriginalConfig()

  config.initConfig.allowInsecureHttpUrls = true

  // Force the credo agent's DIDComm endpoints to point at the in-process
  // HTTP/WS inbound transports on `localhost`. Without this override, a
  // developer-machine `.env` (loaded automatically by NestJS ConfigModule)
  // can leak `EXPRESS_HOST` / `AGENT_HTTP_ENDPOINT` into the test process,
  // causing every OOB invitation to embed an unreachable endpoint and the
  // holder's outbound DIDComm POST to hang against an HTTP server that
  // does not handle DIDComm. The cross-tenant connection / Aries issuance /
  // Aries verification e2e tests then time out indefinitely.
  const httpEndpoint = `http://localhost:${config.httpPort}`
  const wsEndpoint = `ws://localhost:${config.wsPort}`
  config.httpEndpoint = httpEndpoint
  config.wsEndpoint = wsEndpoint
  config.didCommConfig = {
    ...config.didCommConfig,
    endpoints: [httpEndpoint, wsEndpoint],
    // Both DIDComm parties in the tests live in this single process. Credo processes inbound messages
    // one at a time by default, so when a handler replies to the in-process inbound transport, the
    // nested request cannot be processed until the outer one completes, while the outer one is waiting
    // for the nested HTTP response. That cycle is only broken by the inbound transport timeout, which
    // costs 10 seconds per hop and logs "Error processing inbound message: Timeout has occurred".
    // Processing messages concurrently removes the cycle altogether.
    processDidCommMessagesConcurrently: true,
  }

  return config
}

import type { W3cJwtVerifiablePresentation } from '@credo-ts/core'
import type {
  OpenId4VcJwtIssuerDid,
  OpenId4VcVerificationSessionRecord,
  OpenId4VpVerifiedAuthorizationResponse,
} from '@credo-ts/openid4vc'

import { ClaimFormat, MdocDeviceResponse, SdJwtVc, VerifiablePresentation, W3cCredentialSubject } from '@credo-ts/core'
import { OpenId4VcVerificationSessionRepository, OpenId4VcVerificationSessionState } from '@credo-ts/openid4vc'
import { Injectable, InternalServerErrorException, UnprocessableEntityException } from '@nestjs/common'

import { AccreditationService } from 'accreditation/accreditation.service'
import { AccreditationCheckDto } from 'accreditation/dto'
import { TenantAgent } from 'common/agent'

import {
  OpenId4VcVerificationSessionCreateRequestDto,
  OpenId4VcVerificationSessionCreateRequestResponse,
  GetVerificationSessionByQueryDto,
  OpenId4VcVerificationSessionRecordDto,
} from './dto'

/** Metadata of a verification session record created with `requireAccreditation`. */
const REQUIRE_ACCREDITATION = '_heka/requireAccreditation'

/** The parts of a W3C presentation (JWT or JSON-LD, v1 or v2) that name the credential issuers. */
interface W3cPresentationLike {
  verifiableCredential?: W3cCredentialLike | W3cCredentialLike[]
}
interface W3cCredentialLike {
  issuerId?: string
  credential?: { issuerId?: string }
}

@Injectable()
export class OpenId4VcVerificationSessionService {
  public constructor(private readonly accreditationService: AccreditationService) {}

  /**
   * Create a Verification Sessions request
   */
  public async createRequest(
    tenantAgent: TenantAgent,
    req: OpenId4VcVerificationSessionCreateRequestDto,
  ): Promise<OpenId4VcVerificationSessionCreateRequestResponse> {
    if (!req.presentationExchange && !req.dcql) {
      throw new UnprocessableEntityException('Either presentationExchange or dcql must be provided')
    }

    const isDcApi = req.responseMode === 'dc_api' || req.responseMode === 'dc_api.jwt'

    let requestSigner: OpenId4VcJwtIssuerDid | { method: 'none' }
    if (isDcApi && !req.requestSigner?.did) {
      requestSigner = { method: 'none' }
    } else {
      if (!req.requestSigner?.did) {
        throw new UnprocessableEntityException('requestSigner.did is required')
      }
      const { didDocument } = await tenantAgent.dids.resolve(req.requestSigner.did)
      if (!didDocument || !didDocument.verificationMethod?.length) {
        throw new UnprocessableEntityException(`Unable to resolve signing key for DID: ${req.requestSigner.did}`)
      }
      requestSigner = { method: 'did', didUrl: didDocument.verificationMethod[0].id }
    }

    const { authorizationRequest, verificationSession, authorizationRequestObject } =
      await tenantAgent.openid4vc.verifier.createAuthorizationRequest({
        requestSigner,
        verifierId: req.publicVerifierId,
        presentationExchange: req.presentationExchange,
        dcql: req.dcql,
        version: req.version ?? (req.dcql ? 'v1' : 'v1.draft21'),
        responseMode: req.responseMode,
        expectedOrigins: isDcApi && requestSigner.method === 'none' ? undefined : req.expectedOrigins,
      })

    if (req.requireAccreditation) {
      verificationSession.metadata.set(REQUIRE_ACCREDITATION, { required: true })
      await tenantAgent.dependencyManager
        .resolve(OpenId4VcVerificationSessionRepository)
        .update(tenantAgent.context, verificationSession)
    }

    return {
      verificationSession:
        OpenId4VcVerificationSessionRecordDto.fromOpenId4VcVerificationSessionRecord(verificationSession),
      authorizationRequest,
      authorizationRequestObject: isDcApi ? authorizationRequestObject : undefined,
    }
  }

  /**
   * Find all OpenID4VC verification sessions by query
   */
  public async getVerificationSessionsByQuery(
    tenantAgent: TenantAgent,
    query: GetVerificationSessionByQueryDto,
  ): Promise<OpenId4VcVerificationSessionRecordDto[]> {
    const verificationSessionRepository = tenantAgent.dependencyManager.resolve(OpenId4VcVerificationSessionRepository)
    const verificationSessions = await verificationSessionRepository.findByQuery(tenantAgent.context, {
      nonce: query.nonce,
      verifierId: query.publicVerifierId,
      authorizationRequestUri: query.authorizationRequestUri,
      state: query.state,
      payloadState: query.payloadState,
    })

    return verificationSessions.map((session) =>
      OpenId4VcVerificationSessionRecordDto.fromOpenId4VcVerificationSessionRecord(session),
    )
  }

  /**
   * Get an OpenID4VC verification session by verification session id
   */
  public async getVerificationSession(
    tenantAgent: TenantAgent,
    verificationSessionId: string,
  ): Promise<OpenId4VcVerificationSessionRecordDto> {
    const verificationSessionRepository = tenantAgent.dependencyManager.resolve(OpenId4VcVerificationSessionRepository)
    const verificationSessionRecord = await verificationSessionRepository.getById(
      tenantAgent.context,
      verificationSessionId,
    )

    return await this.toDto(tenantAgent, verificationSessionRecord)
  }

  /** The record with, once the response is verified, the disclosed attributes and the accreditation check. */
  private async toDto(
    tenantAgent: TenantAgent,
    record: OpenId4VcVerificationSessionRecord,
  ): Promise<OpenId4VcVerificationSessionRecordDto> {
    if (record.state !== OpenId4VcVerificationSessionState.ResponseVerified) {
      return OpenId4VcVerificationSessionRecordDto.fromOpenId4VcVerificationSessionRecord(record)
    }

    const verifiedAuthorizationResponse = await tenantAgent.openid4vc.verifier.getVerifiedAuthorizationResponse(
      record.id,
    )
    const sharedAttributes = OpenId4VcVerificationSessionService.getSharedAttributes(verifiedAuthorizationResponse)

    let accreditation: AccreditationCheckDto | undefined
    if (record.metadata.get<{ required: boolean }>(REQUIRE_ACCREDITATION)?.required) {
      const presentations = [
        ...(verifiedAuthorizationResponse.presentationExchange?.presentations ?? []),
        ...Object.values(verifiedAuthorizationResponse.dcql?.presentations ?? {}).flat(),
      ]
      accreditation = await this.accreditationService.check(
        presentations.flatMap((presentation) => OpenId4VcVerificationSessionService.issuersOf(presentation)),
      )
    }

    return OpenId4VcVerificationSessionRecordDto.fromOpenId4VcVerificationSessionRecord(
      record,
      sharedAttributes,
      accreditation,
    )
  }

  /**
   * Resolve the disclosed attributes of a verified authorization response, supporting
   * both Presentation Exchange and DCQL presentations across SD-JWT, JWT VC and mdoc.
   */
  private static getSharedAttributes(
    verifiedAuthorizationResponse: OpenId4VpVerifiedAuthorizationResponse,
  ): Record<string, unknown> | undefined {
    if (verifiedAuthorizationResponse.presentationExchange?.presentations?.length) {
      const presentation = verifiedAuthorizationResponse.presentationExchange.presentations[0]
      return OpenId4VcVerificationSessionService.extractAttributesFromPresentation(presentation)
    } else if (verifiedAuthorizationResponse.dcql?.presentations) {
      const presentationEntries = Object.values(verifiedAuthorizationResponse.dcql.presentations)[0]
      if (presentationEntries.length) {
        return OpenId4VcVerificationSessionService.extractAttributesFromPresentation(presentationEntries[0])
      }
      return undefined
    } else {
      throw new InternalServerErrorException('Presentation is missing')
    }
  }

  /**
   * Verify a DC API authorization response submitted by the browser.
   * Used when responseMode is dc_api or dc_api.jwt — the wallet returns
   * the VP token to the browser, which forwards it here for verification.
   */
  public async verifyDcApiResponse(
    tenantAgent: TenantAgent,
    verificationSessionId: string,
    authorizationResponse: Record<string, unknown>,
    origin: string,
  ): Promise<OpenId4VcVerificationSessionRecordDto> {
    const { verificationSession } = await tenantAgent.openid4vc.verifier.verifyAuthorizationResponse({
      verificationSessionId,
      authorizationResponse,
      origin,
    })

    return await this.toDto(tenantAgent, verificationSession)
  }

  /** The issuers of the credentials in a presentation; an issuer that isn't a DID can't be accredited. */
  private static issuersOf(presentation: VerifiablePresentation): string[] {
    if (OpenId4VcVerificationSessionService.isSdJwtPresentation(presentation)) {
      return [typeof presentation.payload.iss === 'string' ? presentation.payload.iss : 'an SD-JWT VC without iss']
    }
    if (OpenId4VcVerificationSessionService.isMdocPresentation(presentation)) {
      return ['an mdoc issuer']
    }
    const w3c = presentation as { presentation?: W3cPresentationLike } & W3cPresentationLike
    const credentials = w3c.presentation?.verifiableCredential ?? w3c.verifiableCredential
    const issuers = (Array.isArray(credentials) ? credentials : credentials ? [credentials] : []).map(
      (credential) => credential.issuerId ?? credential.credential?.issuerId ?? 'an unknown issuer',
    )
    return issuers.length ? issuers : ['an unknown issuer']
  }

  /**
   * Delete an OpenID4VC verification session by id
   */
  public async deleteVerificationSession(tenantAgent: TenantAgent, verificationSessionId: string): Promise<void> {
    const verificationSessionRepository = tenantAgent.dependencyManager.resolve(OpenId4VcVerificationSessionRepository)
    await verificationSessionRepository.deleteById(tenantAgent.context, verificationSessionId)
  }

  private static extractAttributesFromPresentation(
    presentation: VerifiablePresentation,
  ): Record<string, unknown> | undefined {
    if (OpenId4VcVerificationSessionService.isSdJwtPresentation(presentation)) {
      const { vct, cnf, iss, iat, ...attributes } = presentation.prettyClaims
      return attributes
    } else if (OpenId4VcVerificationSessionService.isJwtVcJsonPresentation(presentation)) {
      const credentialSubject =
        presentation.presentation.verifiableCredential instanceof Array
          ? presentation.presentation.verifiableCredential?.[0].credentialSubject
          : presentation.presentation.verifiableCredential.credentialSubject
      return (credentialSubject as W3cCredentialSubject).claims
    } else if (OpenId4VcVerificationSessionService.isMdocPresentation(presentation)) {
      const firstDocClaims = Object.values(presentation.issuerClaims)[0]
      if (firstDocClaims) {
        return Object.values(firstDocClaims).reduce<Record<string, unknown>>((acc, ns) => ({ ...acc, ...ns }), {})
      }
    }
    return undefined
  }

  private static isSdJwtPresentation(presentation: VerifiablePresentation): presentation is SdJwtVc {
    return (presentation as SdJwtVc).claimFormat === ClaimFormat.SdJwtDc
  }

  private static isJwtVcJsonPresentation(
    presentation: VerifiablePresentation,
  ): presentation is W3cJwtVerifiablePresentation {
    return (presentation as W3cJwtVerifiablePresentation).jwt?.header?.typ === 'JWT'
  }

  private static isMdocPresentation(presentation: VerifiablePresentation): presentation is MdocDeviceResponse {
    return (presentation as MdocDeviceResponse).claimFormat === ClaimFormat.MsoMdoc
  }
}

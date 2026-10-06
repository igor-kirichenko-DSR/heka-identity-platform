import { ProtocolType } from '@/entities/Schema/model/types/schema';

import { credentialReducer } from './credentialSlice';
import { offerCredential } from '../services/offerCredential';
import { updateCredentialState } from '../services/updateCredentialState';
import { OpenIdIssuanceState } from '../types/credential';

const initial = () => credentialReducer(undefined, { type: '@@INIT' });

const withOffer = (id: string) =>
  credentialReducer(
    initial(),
    offerCredential.fulfilled(
      { id, state: OpenIdIssuanceState.OfferCreated },
      'req-1',
      {} as never,
    ),
  );

const polled = (id: string) =>
  updateCredentialState.fulfilled(
    { state: OpenIdIssuanceState.Completed },
    'poll-1',
    { id, protocolType: ProtocolType.Oid4vc },
  );

describe('credentialSlice state updates', () => {
  test('applies a poll answer for the current offer', () => {
    const state = credentialReducer(withOffer('offer-B'), polled('offer-B'));

    expect(state.issuanceSession?.state).toBe(OpenIdIssuanceState.Completed);
  });

  test('ignores a late poll answer for a replaced offer', () => {
    // A poll for offer A resolves after the operator has issued offer B
    const state = credentialReducer(withOffer('offer-B'), polled('offer-A'));

    expect(state.issuanceSession).toEqual({
      id: 'offer-B',
      state: OpenIdIssuanceState.OfferCreated,
    });
  });

  test('ignores a poll answer when no offer is active', () => {
    const state = credentialReducer(initial(), polled('offer-A'));

    expect(state.issuanceSession).toBeUndefined();
  });
});

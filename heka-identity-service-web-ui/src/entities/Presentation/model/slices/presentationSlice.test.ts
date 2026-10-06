import { ProtocolType } from '@/entities/Schema/model/types/schema';

import { presentationReducer } from './presentationSlice';
import { requestPresentation } from '../services/requestPresentation';
import { updatePresentationState } from '../services/updatePresentationState';
import { OpenIdPresentationState } from '../types/presentation';

const initial = () => presentationReducer(undefined, { type: '@@INIT' });

const withRequest = (id: string) =>
  presentationReducer(
    initial(),
    requestPresentation.fulfilled(
      { id, state: OpenIdPresentationState.RequestCreated },
      'req-1',
      {} as never,
    ),
  );

const polled = (id: string) =>
  updatePresentationState.fulfilled(
    {
      state: OpenIdPresentationState.ResponseVerified,
      sharedAttributes: [{ name: 'age', value: '42' }],
    },
    'poll-1',
    { id, protocolType: ProtocolType.Oid4vc },
  );

describe('presentationSlice state updates', () => {
  test('applies a poll answer for the current request', () => {
    const state = presentationReducer(withRequest('pres-B'), polled('pres-B'));

    expect(state.presentationSession).toMatchObject({
      id: 'pres-B',
      state: OpenIdPresentationState.ResponseVerified,
      sharedAttributes: [{ name: 'age', value: '42' }],
    });
  });

  test('ignores a late poll answer for a replaced request', () => {
    // A poll for request A resolves after the operator has started request B
    const state = presentationReducer(withRequest('pres-B'), polled('pres-A'));

    expect(state.presentationSession).toEqual({
      id: 'pres-B',
      state: OpenIdPresentationState.RequestCreated,
    });
  });

  test('ignores a poll answer when no request is active', () => {
    const state = presentationReducer(initial(), polled('pres-A'));

    expect(state.presentationSession).toBeUndefined();
  });
});

import { act, renderHook } from '@testing-library/react';
import React, { PropsWithChildren } from 'react';
import { Provider } from 'react-redux';

import { StateSchema } from '@/app/providers/StoreProvider';
import { WizardContext } from '@/app/types/WizardContext';
import { createTestStore } from '@/shared/lib/tests/renderWithProviders';

import { useAppState } from './app-state';
import { useFlow } from './flow';

/** Every resettable slice in a non-initial state. */
const dirtyState = (): Partial<StateSchema> => ({
  connections: {
    isLoading: true,
    error: 'x',
    connections: [],
    isConnectionsLoading: false,
  },
  credentials: {
    isLoading: true,
    error: 'x',
    issuanceSession: { id: 's', state: 'done' },
  } as StateSchema['credentials'],
  presentations: {
    isLoading: true,
    error: 'x',
    presentationSession: { id: 'p', state: 'done' },
  } as StateSchema['presentations'],
  schemas: { isLoading: true, error: 'x', schemas: [] },
  issuanceTemplates: { isLoading: true, isMutating: true, error: 'x' },
  verificationTemplates: { isLoading: true, isMutating: true, error: 'x' },
});

const expectAllReset = (state: StateSchema) => {
  expect(state.credentials.issuanceSession).toBeUndefined();
  expect(state.credentials.error).toBeUndefined();
  expect(state.presentations.presentationSession).toBeUndefined();
  expect(state.schemas).toMatchObject({ isLoading: false, schemas: undefined });
  expect(state.issuanceTemplates).toMatchObject({
    isLoading: false,
    isMutating: false,
    error: undefined,
  });
  expect(state.verificationTemplates).toMatchObject({
    isLoading: false,
    isMutating: false,
    error: undefined,
  });
  expect(state.connections.error).toBeUndefined();
};

const wrapperFor =
  (store: ReturnType<typeof createTestStore>) =>
  // eslint-disable-next-line react/display-name
  ({ children }: PropsWithChildren) => (
    <Provider store={store}>{children}</Provider>
  );

describe('useAppState', () => {
  test('resetApplicationState resets every flow slice', () => {
    const store = createTestStore(dirtyState());
    const { result } = renderHook(() => useAppState(), {
      wrapper: wrapperFor(store),
    });

    act(() => result.current.resetApplicationState());

    expectAllReset(store.getState());
  });
});

interface TestContext extends WizardContext {
  name?: string;
}

const steps = [
  { title: 'Pick', name: 'pick' },
  { title: 'Fill', name: 'fill' },
  { title: 'Done', name: 'done' },
];

describe('useFlow', () => {
  const renderFlow = (
    initialContext?: TestContext,
    store = createTestStore(dirtyState()),
  ) => ({
    store,
    ...renderHook(() => useFlow<TestContext>({ initialContext, steps }), {
      wrapper: wrapperFor(store),
    }),
  });

  test('starts at the first step with the initial context', () => {
    const { result } = renderFlow({ wizardType: 'issue' });

    expect(result.current.step).toBe(steps[0]);
    expect(result.current.stepNumber).toBe(1);
    expect(result.current.flowContext).toEqual({ wizardType: 'issue' });
  });

  test('moves to a named step and ignores unknown ones', () => {
    const { result } = renderFlow();

    act(() => result.current.onChangeStep('done'));
    expect(result.current.step).toBe(steps[2]);
    expect(result.current.stepNumber).toBe(3);

    act(() => result.current.onChangeStep('missing'));
    act(() => result.current.onChangeStep(undefined));
    expect(result.current.step).toBe(steps[2]);
  });

  test('updates one context property at a time', () => {
    const { result } = renderFlow({ wizardType: 'demo' });

    act(() => result.current.onChangeContextProperty('name')('Ada'));

    expect(result.current.flowContext).toEqual({
      wizardType: 'demo',
      name: 'Ada',
    });
  });

  test('resetFlowState returns to the start and resets the slices', () => {
    const { result, store } = renderFlow({ wizardType: 'template' });
    act(() => {
      result.current.onChangeStep('fill');
      result.current.onChangeContextProperty('name')('Ada');
    });

    act(() => result.current.resetFlowState());

    expect(result.current.step).toBe(steps[0]);
    expect(result.current.flowContext).toEqual({ wizardType: 'template' });
    expectAllReset(store.getState());
  });

  test('resets the slices when the flow unmounts', () => {
    const { unmount, store } = renderFlow();

    unmount();

    expectAllReset(store.getState());
  });
});

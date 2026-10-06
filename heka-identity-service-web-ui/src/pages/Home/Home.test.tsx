import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

import { StateSchema } from '@/app/providers/StoreProvider';
import {
  createMockApi,
  renderWithProviders,
} from '@/shared/lib/tests/renderWithProviders';

import Home from './Home';

const userState = (signedIn: boolean): Partial<StateSchema> => ({
  user: {
    isLoading: false,
    isPreparing: false,
    data: {
      name: signedIn ? 'Jane' : null,
      tokens: { accessToken: signedIn ? 'token' : null },
    },
  },
});

const mockApi = (registeredAt?: string) => {
  const api = createMockApi();
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data: url === '/user' ? { name: 'ACME', registeredAt } : undefined,
    }),
  );
  api.post.mockResolvedValue({ data: { did: 'did:key:z6Mk' } });
  return api;
};

const renderHome = (signedIn: boolean, registeredAt?: string) =>
  renderWithProviders(
    <Routes>
      <Route
        path="/"
        element={<Home />}
      />
      <Route
        path="/demo"
        element={<p>demo page</p>}
      />
      <Route
        path="/age-demo"
        element={<p>age demo page</p>}
      />
      <Route
        path="/profile"
        element={<p>profile page</p>}
      />
    </Routes>,
    { initialState: userState(signedIn), api: mockApi(registeredAt) },
  );

describe('Home', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['png'], { type: 'image/png' })),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
  });

  test('prepares the wallet of a registered user and starts the demos', async () => {
    const user = userEvent.setup();
    const { api } = renderHome(true, '2026-01-01T00:00:00Z');

    expect(
      await screen.findByText('Welcome to Self-Sovereign Identity'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/prepare-wallet',
        expect.any(FormData),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Get started' })).toBeEnabled(),
    );

    await user.click(screen.getByRole('button', { name: 'Get started' }));
    expect(screen.getByText('demo page')).toBeInTheDocument();
  });

  test('opens the age verification demo', async () => {
    const user = userEvent.setup();
    renderHome(true, '2026-01-01T00:00:00Z');

    const button = await screen.findByRole('button', {
      name: 'Age verification via mDL',
    });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(screen.getByText('age demo page')).toBeInTheDocument();
  });

  test('sends a first-time user to the profile', async () => {
    renderHome(true);

    expect(await screen.findByText('profile page')).toBeInTheDocument();
  });

  test('shows the demos to signed-out visitors without preparing a wallet', async () => {
    const { api } = renderHome(false);

    expect(
      await screen.findByRole('button', { name: 'Get started' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('profile page')).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});

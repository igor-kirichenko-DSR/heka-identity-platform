import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { Route, Routes } from 'react-router-dom';

import { StateSchema } from '@/app/providers/StoreProvider';
import {
  createMockApi,
  renderWithProviders,
} from '@/shared/lib/tests/renderWithProviders';

import Profile from './Profile';

const userState = (isPreparing = false): Partial<StateSchema> => ({
  user: {
    isLoading: false,
    isPreparing,
    data: { name: 'Jane Doe', tokens: { accessToken: 'token' } },
  },
});

const agencyUser = {
  name: 'ACME',
  backgroundColor: '#123456',
  logo: '/acme.png',
  registeredAt: '2026-01-01T00:00:00Z',
};

const mockApi = (user: Record<string, unknown> = agencyUser) => {
  const api = createMockApi();
  api.get.mockResolvedValue({ data: user });
  api.patch.mockImplementation((_url: string, formData: FormData) =>
    Promise.resolve({
      data: {
        ...user,
        ...Object.fromEntries(
          Array.from(formData.entries()).map(([key, value]) => [
            key,
            value instanceof File ? '/uploaded.png' : value,
          ]),
        ),
      },
    }),
  );
  return api;
};

const renderProfile = (
  options: Parameters<typeof renderWithProviders>[1] = {},
) =>
  renderWithProviders(
    <Routes>
      <Route
        path="/profile"
        element={<Profile />}
      />
      <Route
        path="/sign-in"
        element={<p>sign in page</p>}
      />
    </Routes>,
    {
      route: '/profile',
      initialState: userState(),
      api: mockApi(),
      ...options,
    },
  );

const patchedField = (api: ReturnType<typeof createMockApi>, key: string) =>
  (api.patch.mock.calls[0][1] as FormData).get(key);

describe('Profile', () => {
  const originalCreateObjectURL = URL.createObjectURL;

  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:logo');
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    jest.restoreAllMocks();
  });

  test('shows the user and the issuer settings', async () => {
    const { api } = renderProfile();

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Name/ })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: /Change password/ }),
    ).not.toBeInTheDocument();

    expect(await screen.findByText('ACME')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/user');
    expect(screen.getByRole('img', { name: 'Issuer logo' })).toHaveAttribute(
      'src',
      '/acme.png',
    );
  });

  test('greets a user signing in for the first time', async () => {
    const success = jest.spyOn(toast, 'success');

    renderProfile({ api: mockApi({ name: 'ACME' }) });

    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(
        'You were redirected to this page since you signed in for the first time',
        expect.objectContaining({ duration: 5000 }),
      ),
    );
    expect(success).toHaveBeenCalledTimes(1);
  });

  test('renames the issuer', async () => {
    const user = userEvent.setup();
    const { api } = renderProfile();

    await user.click(
      await screen.findByRole('button', { name: /Issuer.*ACME/ }),
    );
    const input = await screen.findByPlaceholderText('Issuer');
    await user.clear(input);
    await user.type(input, 'Globex');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(api.patch.mock.calls[0][0]).toBe('/user');
    expect(patchedField(api, 'name')).toBe('Globex');
    expect(await screen.findByText('Globex')).toBeInTheDocument();
  });

  test('uploads a new logo', async () => {
    const user = userEvent.setup();
    const { api } = renderProfile();
    await screen.findByText('ACME');

    const file = new File(['png'], 'logo.png', { type: 'image/png' });
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      file,
    );

    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(patchedField(api, 'logo')).toBeInstanceOf(File);
  });

  test('changes the background color', async () => {
    const user = userEvent.setup();
    const { api } = renderProfile();
    await screen.findByText('ACME');

    await user.click(screen.getByRole('button', { name: /Background color/ }));
    fireEvent.change(
      document.querySelector('input[type="color"]') as HTMLInputElement,
      { target: { value: '#00ff00' } },
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(patchedField(api, 'backgroundColor')).toBe('#00ff00');
  });

  test('starts the provider password change', async () => {
    const user = userEvent.setup();
    const changePassword = jest.fn().mockResolvedValue(undefined);
    renderProfile({ session: { changePassword } });
    await screen.findByText('ACME');

    await user.click(screen.getByRole('button', { name: /Change password/ }));

    expect(changePassword).toHaveBeenCalled();
  });

  test('signs out', async () => {
    const user = userEvent.setup();
    localStorage.setItem('userId', 'did:key:1');
    const { store } = renderProfile();
    await screen.findByText('ACME');

    await user.click(screen.getByRole('button', { name: /Sign out/ }));

    expect(await screen.findByText('sign in page')).toBeInTheDocument();
    await waitFor(() => expect(store.getState().user.data).toBeUndefined());
  });

  test('waits for the wallet preparation before loading issuer settings', async () => {
    const { api } = renderProfile({ initialState: userState(true) });

    expect(
      await screen.findByText('Wait for the user to prepare'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Issuer/ }),
    ).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
});

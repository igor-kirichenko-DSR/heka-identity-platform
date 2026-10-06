import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { ProtocolType } from '@/entities/Schema';
import {
  credentialConfig,
  INDY_DID,
  routeAgencyGets,
} from '@/pages/IssueCredential/testUtils';
import {
  createMockApi,
  renderWithProviders,
} from '@/shared/lib/tests/renderWithProviders';

import { SelectNetwork } from './SelectNetwork';

let mockIsMobile = false;
jest.mock('@/components/Screen/Screen', () => ({
  ...jest.requireActual('@/components/Screen/Screen'),
  useMobile: () => mockIsMobile,
}));

const Harness = ({
  withDid = true,
  didOptional,
}: {
  withDid?: boolean;
  didOptional?: boolean;
}) => {
  const [network, setNetwork] = useState<string>();
  const [did, setDid] = useState<string>();
  return (
    <>
      <SelectNetwork
        title="Select network"
        protocolType={ProtocolType.Aries}
        network={network}
        did={did}
        onChangeNetwork={setNetwork}
        onChangeDid={withDid ? setDid : undefined}
        didOptional={didOptional}
        onPrev={jest.fn()}
        onNext={jest.fn()}
      />
      <output data-testid="selection">{`${network}|${did}`}</output>
    </>
  );
};

const renderStep = (props: React.ComponentProps<typeof Harness> = {}) => {
  const api = createMockApi();
  routeAgencyGets(api);
  renderWithProviders(<Harness {...props} />, {
    api,
    initialState: {
      credentials: { isLoading: false, credentialsConfig: credentialConfig },
    },
  });
  return { api, user: userEvent.setup() };
};

describe('SelectNetwork', () => {
  afterEach(() => {
    mockIsMobile = false;
  });

  test('picks the first network and its first DID', async () => {
    const { api } = renderStep();

    await waitFor(() =>
      expect(screen.getByTestId('selection')).toHaveTextContent(
        `indy|${INDY_DID}`,
      ),
    );
    expect(api.get).toHaveBeenCalledWith('/dids', {
      params: { own: true, method: 'indy' },
    });
    expect(screen.getByRole('button', { name: /Next/ })).toBeEnabled();
  });

  test('can continue without a DID when it is optional', async () => {
    renderStep({ withDid: false, didOptional: true });

    await waitFor(() =>
      expect(screen.getByTestId('selection')).toHaveTextContent(
        'indy|undefined',
      ),
    );
    expect(screen.queryByText('Select DID')).toBeNull();
    expect(screen.getByRole('button', { name: /Next/ })).toBeEnabled();
  });

  test('switches the network from a dropdown on mobile', async () => {
    mockIsMobile = true;
    const { api, user } = renderStep();
    await waitFor(() =>
      expect(screen.getByTestId('selection')).toHaveTextContent(
        `indy|${INDY_DID}`,
      ),
    );

    await user.click(screen.getByRole('button', { name: /^indy/ }));
    await user.click(await screen.findByRole('option', { name: 'hedera' }));

    await waitFor(() =>
      expect(screen.getByTestId('selection')).toHaveTextContent(/^hedera\|/),
    );
    expect(api.get).toHaveBeenCalledWith('/dids', {
      params: { own: true, method: 'hedera' },
    });
  });
});

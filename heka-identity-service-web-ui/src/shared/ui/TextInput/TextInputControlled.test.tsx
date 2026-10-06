import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

// Both visibility icons resolve to the same SVG stub module; forward clicks so the toggle works
jest.mock('@/shared/assets/icons/visibility-off.svg', () => ({
  __esModule: true,
  default: (props: { onClick?: () => void }) => (
    <button
      type="button"
      aria-label="toggle visibility"
      onClick={props.onClick}
    />
  ),
}));

import { TextInput } from './TextInput';

interface FormValues {
  secret: string;
}

const Harness = ({
  hideText,
  onChangeValue,
}: {
  hideText?: boolean;
  onChangeValue?: (value: string) => void;
}) => {
  const { control, clearErrors, setError } = useForm<FormValues>({
    defaultValues: { secret: '' },
  });
  return (
    <>
      <TextInput<FormValues>
        name="secret"
        label="Secret"
        control={control}
        clearErrors={clearErrors}
        hideText={hideText}
        onChangeValue={onChangeValue}
      />
      <button
        type="button"
        onClick={() => setError('secret', { message: 'Secret is required' })}
      >
        invalidate
      </button>
    </>
  );
};

describe('TextInput', () => {
  test('reports changes and clears the field error on typing', async () => {
    const user = userEvent.setup();
    const onChangeValue = jest.fn();

    render(<Harness onChangeValue={onChangeValue} />);

    const input = screen.getByPlaceholderText('Secret');
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'invalidate' }));
    expect(await screen.findByText('Secret is required')).toBeInTheDocument();

    await user.type(input, 'abc');

    expect(onChangeValue).toHaveBeenLastCalledWith('abc');
    expect(input).toHaveValue('abc');
    expect(screen.queryByText('Secret is required')).not.toBeInTheDocument();
  });

  test('hides text and toggles its visibility', async () => {
    const user = userEvent.setup();

    render(<Harness hideText />);

    const input = screen.getByPlaceholderText('Secret');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'toggle visibility' }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'toggle visibility' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TextArea } from './TextArea';

describe('TextArea', () => {
  test('shows the initial value and reports typed text', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <TextArea
        label="Notes"
        initValue="Hello"
        onChange={onChange}
      />,
    );

    const textArea = screen.getByPlaceholderText('Notes');
    expect(textArea).toHaveValue('Hello');
    expect(textArea).toHaveAttribute('title', 'Notes');

    await user.type(textArea, '!');

    expect(onChange).toHaveBeenLastCalledWith('Hello!');
    expect(textArea).toHaveValue('Hello!');
  });

  test('follows initValue updates', () => {
    const { rerender } = render(
      <TextArea
        label="Notes"
        initValue="first"
      />,
    );

    rerender(
      <TextArea
        label="Notes"
        initValue="second"
      />,
    );

    expect(screen.getByPlaceholderText('Notes')).toHaveValue('second');
  });

  test('can be disabled', () => {
    render(
      <TextArea
        label="Notes"
        disabled
      />,
    );

    expect(screen.getByPlaceholderText('Notes')).toBeDisabled();
  });
});

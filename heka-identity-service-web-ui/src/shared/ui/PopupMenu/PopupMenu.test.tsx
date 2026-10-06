import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PopupMenu } from './PopupMenu';

describe('PopupMenu', () => {
  test('opens the menu and runs the chosen action', async () => {
    const user = userEvent.setup();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    render(
      <PopupMenu
        buttonHint="Actions"
        popupPlacement="bottom left"
        items={[
          { caption: 'Edit', iconName: 'edit', onAction: onEdit },
          { caption: 'Delete', iconName: 'delete', onAction: onDelete },
        ]}
      />,
    );

    expect(screen.getByTitle('Actions')).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);

    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
  });
});

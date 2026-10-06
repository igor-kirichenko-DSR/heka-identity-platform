import { fireEvent, render, screen } from '@testing-library/react';

import { Draggable, DraggableArea } from './Draggable';
import { DraggableProps } from './types';

const makeSortable = (
  overrides: Partial<DraggableProps['sortable']> = {},
): DraggableProps['sortable'] => ({
  setNodeRef: jest.fn(),
  setActivatorNodeRef: jest.fn(),
  transform: { x: 10, y: 20, scaleX: 1, scaleY: 1 },
  transition: 'transform 200ms',
  listeners: { onPointerDown: jest.fn() },
  isDragging: false,
  ...overrides,
});

describe('Draggable', () => {
  test('applies the sortable transform and registers its node', () => {
    const sortable = makeSortable();

    render(
      <Draggable
        sortable={sortable}
        className="item"
        style={{ width: '10px' }}
      >
        content
      </Draggable>,
    );

    const node = screen.getByText('content');
    expect(node).toHaveClass('item');
    expect(node.style.transform).toBe(
      'translate3d(10px, 20px, 0) scaleX(1) scaleY(1)',
    );
    expect(node.style.transition).toBe('transform 200ms');
    expect(node.style.zIndex).toBe('1');
    expect(node.style.width).toBe('10px');
    expect(sortable.setNodeRef).toHaveBeenCalledWith(node);
  });

  test('raises the item while dragging', () => {
    render(
      <Draggable sortable={makeSortable({ isDragging: true, transform: null })}>
        dragging
      </Draggable>,
    );

    expect(screen.getByText('dragging').style.zIndex).toBe('9999');
  });

  test('DraggableArea attaches the drag listeners to its handle', () => {
    const sortable = makeSortable();

    render(
      <DraggableArea
        sortable={sortable}
        className="handle"
      >
        handle
      </DraggableArea>,
    );

    const handle = screen.getByText('handle');
    expect(sortable.setActivatorNodeRef).toHaveBeenCalledWith(handle);
    expect(handle.style.touchAction).toBe('none');

    fireEvent.pointerDown(handle);
    expect(sortable.listeners!.onPointerDown).toHaveBeenCalled();
  });
});

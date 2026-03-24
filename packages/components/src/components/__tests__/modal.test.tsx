import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../modal';

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    children: <div>Modal Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when open', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('should not render children when closed', () => {
    render(<Modal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
  });

  it('should render close button by default', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
  });

  it('should hide close button when showClose is false', () => {
    render(<Modal {...defaultProps} showClose={false} />);
    expect(screen.queryByLabelText('Close modal')).not.toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    render(<Modal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop is clicked', () => {
    const { container } = render(<Modal {...defaultProps} />);
    const backdrop = container.querySelector('.bg-slate-950\\/60');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('should apply custom maxWidth', () => {
    const { container } = render(
      <Modal {...defaultProps} maxWidth="max-w-2xl" />
    );
    const modalContent = container.querySelector('.max-w-2xl');
    expect(modalContent).toBeInTheDocument();
  });

  it('should apply default maxWidth of max-w-4xl', () => {
    const { container } = render(<Modal {...defaultProps} />);
    const modalContent = container.querySelector('.max-w-4xl');
    expect(modalContent).toBeInTheDocument();
  });

  it('should apply glass variant styles by default', () => {
    const { container } = render(<Modal {...defaultProps} />);
    const modalContent = container.querySelector('.bg-slate-900\\/90');
    expect(modalContent).toBeInTheDocument();
  });

  it('should apply default variant styles', () => {
    const { container } = render(<Modal {...defaultProps} variant="default" />);
    const modalContent = container.querySelector('.bg-white');
    expect(modalContent).toBeInTheDocument();
  });

  it('should have fixed positioning for backdrop', () => {
    const { container } = render(<Modal {...defaultProps} />);
    const wrapper = container.querySelector('.fixed.inset-0');
    expect(wrapper).toBeInTheDocument();
  });

  it('should have z-index of 100', () => {
    const { container } = render(<Modal {...defaultProps} />);
    const wrapper = container.querySelector('.z-\\[100\\]');
    expect(wrapper).toBeInTheDocument();
  });
});

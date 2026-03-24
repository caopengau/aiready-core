import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from '../switch';

describe('Switch', () => {
  it('should render a switch', () => {
    render(<Switch />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('should render with a label', () => {
    render(<Switch label="Toggle me" />);
    expect(screen.getByText('Toggle me')).toBeInTheDocument();
  });

  it('should not render label when not provided', () => {
    const { container } = render(<Switch />);
    expect(container.querySelector('span')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<Switch className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('should handle checked state', () => {
    render(<Switch checked readOnly />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('should handle unchecked state', () => {
    render(<Switch checked={false} readOnly />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('should call onChange when clicked', () => {
    const handleChange = vi.fn();
    render(<Switch onChange={handleChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('should call onCheckedChange when clicked', () => {
    const handleCheckedChange = vi.fn();
    render(<Switch onCheckedChange={handleCheckedChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(handleCheckedChange).toHaveBeenCalledTimes(1);
    expect(handleCheckedChange).toHaveBeenCalledWith(true);
  });

  it('should call onCheckedChange with false when unchecking', () => {
    const handleCheckedChange = vi.fn();
    render(<Switch checked onCheckedChange={handleCheckedChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(handleCheckedChange).toHaveBeenCalledWith(false);
  });

  it('should be disabled when disabled prop is set', () => {
    render(<Switch disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(<Switch ref={ref} />);
    expect(ref.current).not.toBeNull();
  });

  it('should use provided id', () => {
    render(<Switch id="custom-id" label="Test" />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('id', 'custom-id');
  });

  it('should generate unique id when not provided', () => {
    render(<Switch label="Test" />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('id');
  });

  it('should have sr-only class on input', () => {
    render(<Switch />);
    expect(screen.getByRole('checkbox')).toHaveClass('sr-only');
  });
});

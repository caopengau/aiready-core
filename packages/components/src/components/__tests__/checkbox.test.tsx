import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from '../checkbox';

describe('Checkbox', () => {
  it('should render a checkbox input', () => {
    render(<Checkbox />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('should render with a label', () => {
    render(<Checkbox label="Accept terms" />);
    expect(screen.getByLabelText('Accept terms')).toBeInTheDocument();
  });

  it('should not render label when not provided', () => {
    const { container } = render(<Checkbox />);
    expect(container.querySelector('label')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<Checkbox className="custom-class" />);
    expect(container.querySelector('input')).toHaveClass('custom-class');
  });

  it('should handle checked state', () => {
    render(<Checkbox checked readOnly />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('should handle unchecked state', () => {
    render(<Checkbox checked={false} readOnly />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('should call onChange when clicked', () => {
    const handleChange = vi.fn();
    render(<Checkbox onChange={handleChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is set', () => {
    render(<Checkbox disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(<Checkbox ref={ref} />);
    expect(ref.current).not.toBeNull();
  });

  it('should spread additional props', () => {
    const { container } = render(<Checkbox data-testid="checkbox" />);
    expect(container.querySelector('input')).toHaveAttribute(
      'data-testid',
      'checkbox'
    );
  });

  it('should use provided id', () => {
    render(<Checkbox id="custom-id" label="Test" />);
    const checkbox = screen.getByRole('checkbox');
    const label = screen.getByText('Test');
    expect(checkbox).toHaveAttribute('id', 'custom-id');
    expect(label).toHaveAttribute('for', 'custom-id');
  });

  it('should generate unique id when not provided', () => {
    render(<Checkbox label="Test" />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('id');
  });
});

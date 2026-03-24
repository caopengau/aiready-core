import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from '../textarea';

describe('Textarea', () => {
  it('should render a textarea element', () => {
    render(<Textarea />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<Textarea className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should handle placeholder text', () => {
    render(<Textarea placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(<Textarea ref={ref} />);
    expect(ref.current).not.toBeNull();
  });

  it('should be disabled when disabled prop is set', () => {
    render(<Textarea disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('should handle value prop', () => {
    render(<Textarea value="test value" readOnly />);
    expect(screen.getByRole('textbox')).toHaveValue('test value');
  });

  it('should spread additional props', () => {
    const { container } = render(<Textarea data-testid="textarea" />);
    expect(container.firstChild).toHaveAttribute('data-testid', 'textarea');
  });

  it('should call onChange when text is entered', () => {
    const handleChange = vi.fn();
    render(<Textarea onChange={handleChange} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'new text' },
    });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('should have default styling classes', () => {
    const { container } = render(<Textarea />);
    expect(container.firstChild).toHaveClass(
      'flex',
      'min-h-[80px]',
      'w-full',
      'rounded-md'
    );
  });

  it('should render as a textarea element', () => {
    render(<Textarea />);
    expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
  });

  it('should support rows attribute', () => {
    render(<Textarea rows={5} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '5');
  });

  it('should support maxLength attribute', () => {
    render(<Textarea maxLength={100} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', '100');
  });

  it('should have border-input class', () => {
    const { container } = render(<Textarea />);
    expect(container.firstChild).toHaveClass('border-input');
  });

  it('should have focus ring classes', () => {
    const { container } = render(<Textarea />);
    expect(container.firstChild).toHaveClass(
      'focus-visible:ring-2',
      'focus-visible:ring-ring'
    );
  });

  it('should have disabled styling classes', () => {
    const { container } = render(<Textarea disabled />);
    expect(container.firstChild).toHaveClass(
      'disabled:cursor-not-allowed',
      'disabled:opacity-50'
    );
  });
});

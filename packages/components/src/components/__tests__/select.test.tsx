import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from '../select';

describe('Select', () => {
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  const defaultProps = {
    options,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render a select element', () => {
    render(<Select {...defaultProps} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should render all options', () => {
    render(<Select {...defaultProps} />);
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Select {...defaultProps} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render placeholder when provided', () => {
    render(<Select {...defaultProps} placeholder="Select an option" />);
    expect(screen.getByText('Select an option')).toBeInTheDocument();
  });

  it('should call onChange when option is selected', () => {
    render(<Select {...defaultProps} />);
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'option2' },
    });
    expect(defaultProps.onChange).toHaveBeenCalledWith('option2');
  });

  it('should disable specific options', () => {
    const optionsWithDisabled = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2', disabled: true },
    ];
    render(<Select {...defaultProps} options={optionsWithDisabled} />);
    expect(screen.getByText('Option 2')).toBeDisabled();
  });

  it('should be disabled when disabled prop is set', () => {
    render(<Select {...defaultProps} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(<Select {...defaultProps} ref={ref} />);
    expect(ref.current).not.toBeNull();
  });

  it('should spread additional props', () => {
    const { container } = render(
      <Select {...defaultProps} data-testid="select" />
    );
    expect(container.firstChild).toHaveAttribute('data-testid', 'select');
  });

  it('should have default styling classes', () => {
    const { container } = render(<Select {...defaultProps} />);
    expect(container.firstChild).toHaveClass(
      'flex',
      'h-10',
      'w-full',
      'rounded-md'
    );
  });

  it('should handle value prop', () => {
    render(<Select {...defaultProps} value="option2" />);
    expect(screen.getByRole('combobox')).toHaveValue('option2');
  });

  it('should disable placeholder option', () => {
    render(<Select {...defaultProps} placeholder="Select an option" />);
    const placeholderOption = screen.getByText('Select an option');
    expect(placeholderOption).toBeDisabled();
  });
});

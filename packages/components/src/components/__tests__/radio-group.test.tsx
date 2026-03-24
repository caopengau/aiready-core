import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RadioGroup } from '../radio-group';

describe('RadioGroup', () => {
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  const defaultProps = {
    name: 'test-radio',
    options,
    value: 'option1',
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all radio options', () => {
    render(<RadioGroup {...defaultProps} />);
    expect(screen.getByLabelText('Option 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Option 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Option 3')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <RadioGroup {...defaultProps} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should check the correct option', () => {
    render(<RadioGroup {...defaultProps} />);
    expect(screen.getByLabelText('Option 1')).toBeChecked();
    expect(screen.getByLabelText('Option 2')).not.toBeChecked();
  });

  it('should call onChange when option is selected', () => {
    render(<RadioGroup {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Option 2'));
    expect(defaultProps.onChange).toHaveBeenCalledWith('option2');
  });

  it('should render with vertical orientation by default', () => {
    const { container } = render(<RadioGroup {...defaultProps} />);
    expect(container.firstChild).toHaveClass('flex-col', 'gap-2');
  });

  it('should render with horizontal orientation', () => {
    const { container } = render(
      <RadioGroup {...defaultProps} orientation="horizontal" />
    );
    expect(container.firstChild).toHaveClass('flex-row', 'gap-4');
  });

  it('should disable specific options', () => {
    const optionsWithDisabled = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2', disabled: true },
    ];
    render(<RadioGroup {...defaultProps} options={optionsWithDisabled} />);
    expect(screen.getByLabelText('Option 2')).toBeDisabled();
  });

  it('should use the correct name for all radios', () => {
    render(<RadioGroup {...defaultProps} />);
    const radios = screen.getAllByRole('radio');
    radios.forEach((radio) => {
      expect(radio).toHaveAttribute('name', 'test-radio');
    });
  });

  it('should generate unique ids for each option', () => {
    render(<RadioGroup {...defaultProps} />);
    expect(screen.getByLabelText('Option 1')).toHaveAttribute(
      'id',
      'test-radio-option1'
    );
    expect(screen.getByLabelText('Option 2')).toHaveAttribute(
      'id',
      'test-radio-option2'
    );
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(<RadioGroup {...defaultProps} ref={ref} />);
    expect(ref.current).not.toBeNull();
  });

  it('should spread additional props', () => {
    const { container } = render(
      <RadioGroup {...defaultProps} data-testid="radio-group" />
    );
    expect(container.firstChild).toHaveAttribute('data-testid', 'radio-group');
  });

  it('should have flex class', () => {
    const { container } = render(<RadioGroup {...defaultProps} />);
    expect(container.firstChild).toHaveClass('flex');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from '../label';

describe('Label', () => {
  it('should render children content', () => {
    render(<Label>Test Label</Label>);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<Label className="custom-class">Label</Label>);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render with default styles', () => {
    const { container } = render(<Label>Label</Label>);
    expect(container.firstChild).toHaveClass(
      'text-sm',
      'font-medium',
      'leading-none'
    );
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(<Label ref={ref}>Label</Label>);
    expect(ref.current).not.toBeNull();
  });

  it('should spread additional props', () => {
    const { container } = render(<Label data-testid="label">Label</Label>);
    expect(container.firstChild).toHaveAttribute('data-testid', 'label');
  });

  it('should render as a label element', () => {
    render(<Label>Label</Label>);
    expect(screen.getByText('Label').tagName).toBe('LABEL');
  });

  it('should support htmlFor attribute', () => {
    render(<Label htmlFor="input-id">Label</Label>);
    expect(screen.getByText('Label')).toHaveAttribute('for', 'input-id');
  });

  it('should have peer-disabled classes', () => {
    const { container } = render(<Label>Label</Label>);
    expect(container.firstChild).toHaveClass(
      'peer-disabled:cursor-not-allowed',
      'peer-disabled:opacity-70'
    );
  });
});

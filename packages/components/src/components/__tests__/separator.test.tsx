import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Separator } from '../separator';

describe('Separator', () => {
  it('should render a separator', () => {
    const { container } = render(<Separator />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<Separator className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render with horizontal orientation by default', () => {
    const { container } = render(<Separator />);
    expect(container.firstChild).toHaveClass('h-[1px]', 'w-full');
  });

  it('should render with vertical orientation', () => {
    const { container } = render(<Separator orientation="vertical" />);
    expect(container.firstChild).toHaveClass('h-full', 'w-[1px]');
  });

  it('should have role="none" when decorative is true', () => {
    const { container } = render(<Separator decorative />);
    expect(container.firstChild).toHaveAttribute('role', 'none');
  });

  it('should have role="separator" when decorative is false', () => {
    const { container } = render(<Separator decorative={false} />);
    expect(container.firstChild).toHaveAttribute('role', 'separator');
  });

  it('should have aria-orientation attribute', () => {
    const { container } = render(<Separator orientation="horizontal" />);
    expect(container.firstChild).toHaveAttribute(
      'aria-orientation',
      'horizontal'
    );
  });

  it('should have aria-orientation vertical for vertical separator', () => {
    const { container } = render(<Separator orientation="vertical" />);
    expect(container.firstChild).toHaveAttribute(
      'aria-orientation',
      'vertical'
    );
  });

  it('should have shrink-0 class', () => {
    const { container } = render(<Separator />);
    expect(container.firstChild).toHaveClass('shrink-0');
  });

  it('should have bg-border class', () => {
    const { container } = render(<Separator />);
    expect(container.firstChild).toHaveClass('bg-border');
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(<Separator ref={ref} />);
    expect(ref.current).not.toBeNull();
  });

  it('should spread additional props', () => {
    const { container } = render(<Separator data-testid="separator" />);
    expect(container.firstChild).toHaveAttribute('data-testid', 'separator');
  });
});

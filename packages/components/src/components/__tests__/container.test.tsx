import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Container } from '../container';

describe('Container', () => {
  it('should render children content', () => {
    render(<Container>Test Content</Container>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Container className="custom-class">Content</Container>
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render with default lg size', () => {
    const { container } = render(<Container>Content</Container>);
    expect(container.firstChild).toHaveClass('max-w-screen-lg');
  });

  it('should render with sm size', () => {
    const { container } = render(<Container size="sm">Content</Container>);
    expect(container.firstChild).toHaveClass('max-w-screen-sm');
  });

  it('should render with md size', () => {
    const { container } = render(<Container size="md">Content</Container>);
    expect(container.firstChild).toHaveClass('max-w-screen-md');
  });

  it('should render with xl size', () => {
    const { container } = render(<Container size="xl">Content</Container>);
    expect(container.firstChild).toHaveClass('max-w-screen-xl');
  });

  it('should render with full size', () => {
    const { container } = render(<Container size="full">Content</Container>);
    expect(container.firstChild).toHaveClass('max-w-full');
  });

  it('should have responsive padding classes', () => {
    const { container } = render(<Container>Content</Container>);
    expect(container.firstChild).toHaveClass('px-4', 'sm:px-6', 'lg:px-8');
  });

  it('should be centered with mx-auto', () => {
    const { container } = render(<Container>Content</Container>);
    expect(container.firstChild).toHaveClass('mx-auto');
  });

  it('should have full width', () => {
    const { container } = render(<Container>Content</Container>);
    expect(container.firstChild).toHaveClass('w-full');
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(<Container ref={ref}>Content</Container>);
    expect(ref.current).not.toBeNull();
  });

  it('should spread additional props', () => {
    const { container } = render(
      <Container data-testid="container">Content</Container>
    );
    expect(container.firstChild).toHaveAttribute('data-testid', 'container');
  });
});

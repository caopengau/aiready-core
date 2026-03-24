import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stack } from '../stack';

describe('Stack', () => {
  it('should render children content', () => {
    render(
      <Stack>
        <div>Item 1</div>
        <div>Item 2</div>
      </Stack>
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Stack className="custom-class">
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render with vertical direction by default', () => {
    const { container } = render(
      <Stack>
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('flex-col');
  });

  it('should render with horizontal direction', () => {
    const { container } = render(
      <Stack direction="horizontal">
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('flex-row');
  });

  it('should render with default md spacing', () => {
    const { container } = render(
      <Stack>
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('gap-4');
  });

  it('should render with xs spacing', () => {
    const { container } = render(
      <Stack spacing="xs">
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('gap-1');
  });

  it('should render with sm spacing', () => {
    const { container } = render(
      <Stack spacing="sm">
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('gap-2');
  });

  it('should render with lg spacing', () => {
    const { container } = render(
      <Stack spacing="lg">
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('gap-6');
  });

  it('should render with xl spacing', () => {
    const { container } = render(
      <Stack spacing="xl">
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('gap-8');
  });

  it('should render with default stretch alignment', () => {
    const { container } = render(
      <Stack>
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('items-stretch');
  });

  it('should render with start alignment', () => {
    const { container } = render(
      <Stack align="start">
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('items-start');
  });

  it('should render with center alignment', () => {
    const { container } = render(
      <Stack align="center">
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('items-center');
  });

  it('should render with end alignment', () => {
    const { container } = render(
      <Stack align="end">
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('items-end');
  });

  it('should render with default start justify', () => {
    const { container } = render(
      <Stack>
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('justify-start');
  });

  it('should render with center justify', () => {
    const { container } = render(
      <Stack justify="center">
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('justify-center');
  });

  it('should render with end justify', () => {
    const { container } = render(
      <Stack justify="end">
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('justify-end');
  });

  it('should render with between justify', () => {
    const { container } = render(
      <Stack justify="between">
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('justify-between');
  });

  it('should render with around justify', () => {
    const { container } = render(
      <Stack justify="around">
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('justify-around');
  });

  it('should have flex class', () => {
    const { container } = render(
      <Stack>
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveClass('flex');
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(
      <Stack ref={ref}>
        <div>Content</div>
      </Stack>
    );
    expect(ref.current).not.toBeNull();
  });

  it('should spread additional props', () => {
    const { container } = render(
      <Stack data-testid="stack">
        <div>Content</div>
      </Stack>
    );
    expect(container.firstChild).toHaveAttribute('data-testid', 'stack');
  });
});

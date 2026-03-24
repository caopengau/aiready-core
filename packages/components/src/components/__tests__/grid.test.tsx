import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Grid } from '../grid';

describe('Grid', () => {
  it('should render children content', () => {
    render(
      <Grid>
        <div>Item 1</div>
        <div>Item 2</div>
      </Grid>
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Grid className="custom-class">
        <div>Content</div>
      </Grid>
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render with default 3 columns', () => {
    const { container } = render(
      <Grid>
        <div>Content</div>
      </Grid>
    );
    expect(container.firstChild).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-2',
      'lg:grid-cols-3'
    );
  });

  it('should render with 1 column', () => {
    const { container } = render(
      <Grid cols={1}>
        <div>Content</div>
      </Grid>
    );
    expect(container.firstChild).toHaveClass('grid-cols-1');
  });

  it('should render with 2 columns', () => {
    const { container } = render(
      <Grid cols={2}>
        <div>Content</div>
      </Grid>
    );
    expect(container.firstChild).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
  });

  it('should render with 4 columns', () => {
    const { container } = render(
      <Grid cols={4}>
        <div>Content</div>
      </Grid>
    );
    expect(container.firstChild).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-2',
      'lg:grid-cols-4'
    );
  });

  it('should render with 5 columns', () => {
    const { container } = render(
      <Grid cols={5}>
        <div>Content</div>
      </Grid>
    );
    expect(container.firstChild).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-2',
      'lg:grid-cols-5'
    );
  });

  it('should render with 6 columns', () => {
    const { container } = render(
      <Grid cols={6}>
        <div>Content</div>
      </Grid>
    );
    expect(container.firstChild).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-2',
      'lg:grid-cols-6'
    );
  });

  it('should render with 12 columns', () => {
    const { container } = render(
      <Grid cols={12}>
        <div>Content</div>
      </Grid>
    );
    expect(container.firstChild).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-2',
      'lg:grid-cols-12'
    );
  });

  it('should render with default md gap', () => {
    const { container } = render(
      <Grid>
        <div>Content</div>
      </Grid>
    );
    expect(container.firstChild).toHaveClass('gap-4');
  });

  it('should render with sm gap', () => {
    const { container } = render(
      <Grid gap="sm">
        <div>Content</div>
      </Grid>
    );
    expect(container.firstChild).toHaveClass('gap-2');
  });

  it('should render with lg gap', () => {
    const { container } = render(
      <Grid gap="lg">
        <div>Content</div>
      </Grid>
    );
    expect(container.firstChild).toHaveClass('gap-6');
  });

  it('should render with xl gap', () => {
    const { container } = render(
      <Grid gap="xl">
        <div>Content</div>
      </Grid>
    );
    expect(container.firstChild).toHaveClass('gap-8');
  });

  it('should have grid class', () => {
    const { container } = render(
      <Grid>
        <div>Content</div>
      </Grid>
    );
    expect(container.firstChild).toHaveClass('grid');
  });

  it('should forward ref', () => {
    const ref = { current: null };
    render(
      <Grid ref={ref}>
        <div>Content</div>
      </Grid>
    );
    expect(ref.current).not.toBeNull();
  });

  it('should spread additional props', () => {
    const { container } = render(
      <Grid data-testid="grid">
        <div>Content</div>
      </Grid>
    );
    expect(container.firstChild).toHaveAttribute('data-testid', 'grid');
  });
});

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  it('renders no path with fewer than two points', () => {
    const { container } = render(<Sparkline values={[100]} label="报价走势" />);
    expect(container.querySelector('path')).toBeNull();
  });

  it('renders a path with at least two points', () => {
    const { container, getByRole } = render(
      <Sparkline values={[100, 80, 120]} label="报价走势" />,
    );
    expect(container.querySelector('path')).not.toBeNull();
    expect(getByRole('img', { name: '报价走势' })).toBeInTheDocument();
  });
});

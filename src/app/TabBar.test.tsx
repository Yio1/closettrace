import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TabBar } from './AppShell';

describe('TabBar', () => {
  it('renders all five tabs', () => {
    render(
      <MemoryRouter>
        <TabBar />
      </MemoryRouter>,
    );
    for (const label of ['今日', '衣橱', '搭配', '采购', '我的']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

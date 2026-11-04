import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Category, ColorSwatch, Item } from '../../domain/types';
import { ItemCard } from './ItemCard';

const item: Item = {
  id: 'item-1',
  name: '白衬衫',
  categoryId: 'builtin:cat:shirt',
  colorPrimaryId: 'builtin:color:white',
  pattern: 'solid',
  warmth: 2,
  formality: 3,
  seasons: ['all'],
  sceneTags: [],
  styleTags: [],
  status: 'laundry',
  avoidRecommend: false,
  isFavorite: false,
  wearCount: 0,
  totalCostCents: 0,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
};

const category: Category = {
  id: 'builtin:cat:shirt',
  name: '衬衫',
  parentId: 'builtin:cat:top',
  slot: 'top',
  defaultFormality: 3,
  defaultWarmth: 2,
  defaultSeasons: ['all'],
  isBuiltIn: true,
  archived: false,
  order: 2,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const white: ColorSwatch = {
  id: 'builtin:color:white',
  name: '白',
  hex: '#FFFFFF',
  hue: 0,
  family: 'neutral',
  isNeutral: true,
  order: 2,
};

describe('ItemCard', () => {
  it('shows name, category, location, status, and a color fallback', () => {
    render(
      <ItemCard
        item={item}
        category={category}
        color={white}
        locationPath="卧室 / 主衣柜"
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText('白衬衫')).toBeInTheDocument();
    expect(screen.getByText('衬衫')).toBeInTheDocument();
    expect(screen.getByText('卧室 / 主衣柜')).toBeInTheDocument();
    expect(screen.getByText('待洗')).toBeInTheDocument();
    expect(screen.getByTestId('item-color')).toHaveStyle({ backgroundColor: '#FFFFFF' });
  });

  it('shows the photo with the item name as alt text', () => {
    render(<ItemCard item={item} thumbUrl="blob:mock" onClick={vi.fn()} />);
    expect(screen.getByRole('img', { name: '白衬衫' })).toHaveAttribute('src', 'blob:mock');
  });
});

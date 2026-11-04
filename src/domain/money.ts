export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const yuan = Math.floor(abs / 100);
  const fen = abs % 100;
  return fen === 0 ? `${sign}¥${yuan}` : `${sign}¥${yuan}.${String(fen).padStart(2, '0')}`;
}

export function parseYuanToCents(input: string): number | null {
  const text = input.trim();
  if (!/^\d+(\.\d{0,2})?$/.test(text)) return null;
  const [yuan, fraction = ''] = text.split('.');
  return Number(yuan) * 100 + Number(fraction.padEnd(2, '0'));
}

export function landedCents(price: number, shipping: number, discount: number): number {
  return Math.max(0, Math.round(price + shipping - discount));
}

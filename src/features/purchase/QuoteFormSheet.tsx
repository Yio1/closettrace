import { useState } from 'react';
import { todayISO } from '../../domain/date';
import { addQuote } from '../../db/repositories/wishlist';
import { Button } from '../../components/ui/Button';
import { MoneyField } from '../../components/ui/MoneyField';
import { Sheet } from '../../components/ui/Sheet';
import { TextField } from '../../components/ui/TextField';

export function QuoteFormSheet({
  open,
  onClose,
  wishlistId,
}: {
  open: boolean;
  onClose: () => void;
  wishlistId: string;
}) {
  const [channel, setChannel] = useState('');
  const [priceCents, setPriceCents] = useState(0);
  const [shippingCents, setShippingCents] = useState(0);
  const [discountCents, setDiscountCents] = useState(0);
  const [observedAt, setObservedAt] = useState(todayISO());
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!channel.trim()) {
      setError('请填写渠道');
      return;
    }
    if (priceCents <= 0) {
      setError('请填写价格');
      return;
    }
    setSaving(true);
    try {
      await addQuote(wishlistId, {
        channel,
        priceCents,
        shippingCents,
        discountCents,
        observedAt,
        url: url.trim() || undefined,
        note: note.trim() || undefined,
      });
      onClose();
    } catch {
      setError('保存失败，请重试');
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="添加报价">
      <div className="space-y-3">
        <TextField
          label="渠道"
          value={channel}
          onChange={(event) => setChannel(event.target.value)}
          placeholder="例如：淘宝"
        />
        <MoneyField label="价格" valueCents={priceCents} onChange={setPriceCents} />
        <div className="grid grid-cols-2 gap-3">
          <MoneyField label="运费" valueCents={shippingCents} onChange={setShippingCents} />
          <MoneyField label="优惠" valueCents={discountCents} onChange={setDiscountCents} />
        </div>
        <TextField
          label="日期"
          type="date"
          value={observedAt}
          onChange={(event) => setObservedAt(event.target.value)}
        />
        <TextField
          label="链接"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://"
        />
        <TextField label="备注" value={note} onChange={(event) => setNote(event.target.value)} />

        {error ? <p className="text-sm text-danger-text">{error}</p> : null}

        <div className="flex gap-2">
          <Button onClick={() => void handleSave()} disabled={saving}>
            保存
          </Button>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ColorSwatch, StyleTag } from '../../domain/types';
import { DEFAULT_STYLE_PROFILE, type Sizes, type StyleProfile, type TempSensitivity } from '../../domain/profile';
import { listColors, listStyleTags } from '../../db/repositories/dictionaries';
import { getSetting, setSetting } from '../../db/repositories/settings';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TextField } from '../../components/ui/TextField';

const SENSITIVITY_OPTIONS: Array<{ value: TempSensitivity; label: string }> = [
  { value: 'cold', label: '怕冷' },
  { value: 'normal', label: '正常' },
  { value: 'hot', label: '怕热' },
];

const SIZE_FIELDS: Array<{ key: keyof Sizes; label: string }> = [
  { key: 'top', label: '上装尺码' },
  { key: 'bottom', label: '下装尺码' },
  { key: 'shoes', label: '鞋码' },
  { key: 'dress', label: '连衣裙尺码' },
];

export function StyleProfilePage() {
  const initial = useLiveQuery(async () => {
    const [profile, sizes] = await Promise.all([
      getSetting<StyleProfile>('styleProfile', DEFAULT_STYLE_PROFILE),
      getSetting<Sizes>('sizes', {}),
    ]);
    return { profile, sizes };
  }, []);

  if (!initial) return null;
  return <StyleProfileContent initialProfile={initial.profile} initialSizes={initial.sizes} />;
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
}

function StyleProfileContent({
  initialProfile,
  initialSizes,
}: {
  initialProfile: StyleProfile;
  initialSizes: Sizes;
}) {
  const styleTags = useLiveQuery(() => listStyleTags(), []);
  const colors = useLiveQuery(() => listColors(), []);
  const [profile, setProfile] = useState(initialProfile);
  const [sizes, setSizes] = useState<Sizes>(initialSizes);
  const [status, setStatus] = useState('');

  if (!styleTags || !colors) return null;

  function updateProfile(patch: Partial<StyleProfile>) {
    setProfile((current) => ({ ...current, ...patch }));
    setStatus('');
  }

  function updateSize(key: keyof Sizes, value: string) {
    setSizes((current) => ({ ...current, [key]: value }));
    setStatus('');
  }

  async function save() {
    const cleaned: Sizes = {};
    for (const field of SIZE_FIELDS) {
      const value = sizes[field.key]?.trim();
      if (value) cleaned[field.key] = value;
    }
    await Promise.all([
      setSetting('styleProfile', profile),
      setSetting('sizes', cleaned),
    ]);
    setSizes(cleaned);
    setStatus('已保存');
  }

  return (
    <div className="space-y-5">
      <PageHeader title="风格与尺码" subtitle="用于搭配推荐，全部可留空" />

      <ChipSection
        title="喜欢的风格"
        entries={styleTags.map((tag: StyleTag) => ({ id: tag.id, name: tag.name }))}
        selected={profile.styleTags}
        onToggle={(id) => updateProfile({ styleTags: toggle(profile.styleTags, id) })}
      />

      <ColorSection
        colors={colors}
        selected={profile.favoriteColorIds}
        onToggle={(id) => updateProfile({ favoriteColorIds: toggle(profile.favoriteColorIds, id) })}
      />

      <section>
        <h2 className="mb-2 text-sm font-medium">体感偏好</h2>
        <SegmentedControl
          ariaLabel="体感偏好"
          options={SENSITIVITY_OPTIONS}
          value={profile.tempSensitivity}
          onChange={(value) => updateProfile({ tempSensitivity: value })}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">尺码</h2>
        {SIZE_FIELDS.map((field) => (
          <TextField
            key={field.key}
            label={field.label}
            value={sizes[field.key] ?? ''}
            onChange={(event) => updateSize(field.key, event.target.value)}
          />
        ))}
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={() => void save()}>保存</Button>
        {status ? <span className="text-sm text-muted">{status}</span> : null}
      </div>
    </div>
  );
}

function ChipSection({
  title,
  entries,
  selected,
  onToggle,
}: {
  title: string;
  entries: Array<{ id: string; name: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {entries.map((entry) => {
          const active = selected.includes(entry.id);
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(entry.id)}
              className={`min-h-9 rounded-full border px-3 text-sm ${
                active
                  ? 'border-accent bg-accent/10 text-accent-text'
                  : 'border-line bg-surface text-muted'
              }`}
            >
              {entry.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ColorSection({
  colors,
  selected,
  onToggle,
}: {
  colors: ColorSwatch[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">喜欢的颜色</h2>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => {
          const active = selected.includes(color.id);
          return (
            <button
              key={color.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(color.id)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm ${
                active
                  ? 'border-accent bg-accent/10 text-accent-text'
                  : 'border-line bg-surface text-muted'
              }`}
            >
              <span
                aria-hidden
                className="h-3.5 w-3.5 rounded-full border border-line"
                style={{ backgroundColor: color.hex }}
              />
              {color.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

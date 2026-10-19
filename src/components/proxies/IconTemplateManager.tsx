import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Edit3, Trash2, X } from '~/components/shared/FeatherIcons';
import type { IconTemplateState } from '~/modules/proxies/iconTemplates';

import s from './IconTemplateManager.module.scss';

type Props = {
  state: IconTemplateState;
  onCreate: (name: string) => Promise<void>;
  onSelect: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function IconTemplateManager({ state, onCreate, onSelect, onRename, onDelete }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = React.useState<'create' | 'rename' | null>(null);
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const active = state.templates.find((item) => item.id === state.activeId);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (mode) inputRef.current?.focus();
  }, [mode]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      console.error('Cannot update icon template', cause);
      setError(cause instanceof Error ? cause.message : t('icon_template_failed'));
    } finally {
      setBusy(false);
    }
  };

  const open = (nextMode: 'create' | 'rename') => {
    setMode(nextMode);
    setName(nextMode === 'rename' ? active?.name || '' : '');
    setError('');
  };

  return (
    <section className={s.manager} aria-label={t('icon_templates')}>
      <div className={s.toolbar}>
        <label className={s.label} htmlFor="yacd-icon-template">
          {t('icon_templates')}
        </label>
        <select
          id="yacd-icon-template"
          className={s.select}
          value={state.activeId}
          onChange={(event) => {
            setMode(null);
            void run(() => onSelect(event.target.value));
          }}
          disabled={busy}
        >
          {state.templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <div className={s.actions}>
          <button
            type="button"
            className={s.createButton}
            disabled={busy}
            onClick={() => open('create')}
          >
            {t('icon_template_create')}
          </button>
          <span className={s.divider} aria-hidden />
          <button
            type="button"
            className={s.iconButton}
            disabled={busy || !active}
            onClick={() => open('rename')}
            title={t('icon_template_rename')}
            aria-label={t('icon_template_rename')}
          >
            <Edit3 size={15} aria-hidden />
          </button>
          <button
            type="button"
            className={s.iconButton}
            disabled={busy || state.templates.length <= 1 || !active}
            onClick={() => {
              if (
                active &&
                window.confirm(t('icon_template_delete_confirm', { name: active.name }))
              ) {
                void run(() => onDelete(active.id));
              }
            }}
            title={t('icon_template_delete')}
            aria-label={t('icon_template_delete')}
          >
            <Trash2 size={15} aria-hidden />
          </button>
        </div>
      </div>
      {mode ? (
        <form
          className={s.editRow}
          onSubmit={(event) => {
            event.preventDefault();
            const value = name.trim();
            if (!value || (mode === 'rename' && !active)) return;
            void run(async () => {
              if (mode === 'create') await onCreate(value);
              else if (active) await onRename(active.id, value);
              setMode(null);
              setName('');
            });
          }}
        >
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={mode === 'create' ? t('icon_template_name') : t('icon_template_rename')}
            aria-label={mode === 'create' ? t('icon_template_name') : t('icon_template_rename')}
            maxLength={80}
          />
          <button type="submit" className={s.saveButton} disabled={busy || !name.trim()}>
            {mode === 'create' ? t('icon_template_create') : t('icon_template_save')}
          </button>
          <button
            type="button"
            className={s.cancelButton}
            disabled={busy}
            onClick={() => setMode(null)}
            title={t('icon_template_cancel')}
            aria-label={t('icon_template_cancel')}
          >
            <X size={16} aria-hidden />
          </button>
        </form>
      ) : null}
      {error ? (
        <p className={s.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

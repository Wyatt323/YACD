import * as React from 'react';
import { useTranslation } from 'react-i18next';

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
  const [name, setName] = React.useState('');
  const [rename, setRename] = React.useState(false);
  const [renameName, setRenameName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const active = state.templates.find((item) => item.id === state.activeId);

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

  return (
    <section className={s.manager} aria-label={t('icon_templates')}>
      <label className={s.label} htmlFor="yacd-icon-template">{t('icon_templates')}</label>
      <select
        id="yacd-icon-template"
        value={state.activeId}
        onChange={(event) => void run(() => onSelect(event.target.value))}
        disabled={busy}
      >
        {state.templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        void run(async () => { await onCreate(name.trim()); setName(''); });
      }}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('icon_template_name')}
          aria-label={t('icon_template_name')}
          maxLength={80}
        />
        <button type="submit" disabled={busy || !name.trim()}>{t('icon_template_create')}</button>
      </form>
      {rename ? (
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!active || !renameName.trim()) return;
          void run(async () => { await onRename(active.id, renameName.trim()); setRename(false); });
        }}>
          <input
            value={renameName}
            onChange={(event) => setRenameName(event.target.value)}
            aria-label={t('icon_template_rename')}
            maxLength={80}
          />
          <button type="submit" disabled={busy || !renameName.trim()}>{t('icon_template_save')}</button>
          <button type="button" onClick={() => setRename(false)}>{t('icon_template_cancel')}</button>
        </form>
      ) : (
        <button type="button" disabled={busy || !active} onClick={() => {
          setRenameName(active?.name || '');
          setRename(true);
        }}>{t('icon_template_rename')}</button>
      )}
      <button
        type="button"
        disabled={busy || state.templates.length <= 1 || !active}
        onClick={() => {
          if (active && window.confirm(t('icon_template_delete_confirm', { name: active.name }))) {
            void run(() => onDelete(active.id));
          }
        }}
      >{t('icon_template_delete')}</button>
      {error ? <p className={s.error} role="alert">{error}</p> : null}
    </section>
  );
}

import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { CheckCircle, ChevronDown, Edit3, Trash2, X } from '~/components/shared/FeatherIcons';
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
  const [menuOpen, setMenuOpen] = React.useState(false);
  const active = state.templates.find((item) => item.id === state.activeId);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const selectorRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (mode) inputRef.current?.focus();
  }, [mode]);

  React.useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [menuOpen]);

  const focusOption = (index: number) => {
    const options = selectorRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
    if (options?.length) options[(index + options.length) % options.length].focus();
  };

  const openMenu = () => {
    if (busy) return;
    setMenuOpen(true);
    window.requestAnimationFrame(() => {
      focusOption(
        Math.max(
          0,
          state.templates.findIndex((item) => item.id === state.activeId),
        ),
      );
    });
  };

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

  const selectTemplate = (id: string) => {
    setMenuOpen(false);
    triggerRef.current?.focus();
    if (id === state.activeId) return;
    setMode(null);
    void run(() => onSelect(id));
  };

  const open = (nextMode: 'create' | 'rename') => {
    setMenuOpen(false);
    setMode(nextMode);
    setName(nextMode === 'rename' ? active?.name || '' : '');
    setError('');
  };

  return (
    <section className={s.manager} aria-label={t('icon_templates')}>
      <div className={s.toolbar}>
        <span className={s.label}>{t('icon_templates')}</span>
        <div className={s.selector} ref={selectorRef}>
          <button
            ref={triggerRef}
            type="button"
            className={s.selectTrigger}
            aria-label={`${t('icon_templates')}: ${active?.name || ''}`}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            aria-controls="yacd-icon-template-options"
            disabled={busy}
            onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
            onKeyDown={(event) => {
              if (!menuOpen && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
                event.preventDefault();
                openMenu();
              }
            }}
          >
            <span className={s.selectedName}>{active?.name}</span>
            <ChevronDown size={16} className={menuOpen ? s.chevronOpen : undefined} aria-hidden />
          </button>
          {menuOpen ? (
            <div
              id="yacd-icon-template-options"
              className={s.menu}
              role="listbox"
              tabIndex={-1}
              aria-label={t('icon_templates')}
              onKeyDown={(event) => {
                const options = [
                  ...(selectorRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ||
                    []),
                ];
                const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setMenuOpen(false);
                  triggerRef.current?.focus();
                } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  focusOption(currentIndex + (event.key === 'ArrowDown' ? 1 : -1));
                } else if (event.key === 'Home' || event.key === 'End') {
                  event.preventDefault();
                  focusOption(event.key === 'Home' ? 0 : options.length - 1);
                } else if (event.key === 'Tab') {
                  setMenuOpen(false);
                }
              }}
            >
              {state.templates.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === state.activeId ? s.optionSelected : s.option}
                  role="option"
                  aria-selected={item.id === state.activeId}
                  onClick={() => selectTemplate(item.id)}
                >
                  <span>{item.name}</span>
                  {item.id === state.activeId ? <CheckCircle size={15} aria-hidden /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
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

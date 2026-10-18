import * as React from 'react';
import { useTranslation } from 'react-i18next';

import Modal from '~/components/shared/Modal';
import { isWebImageUrl } from '~/modules/proxies/groupIcons';
import catalog from '~/oasisic-icons.json';

import s from './GroupIconPicker.module.scss';

const categories = [...new Set(catalog.icons.map((icon) => icon.category))].sort();

type Props = {
  isOpen: boolean;
  groupName: string;
  selectedUrl?: string;
  onSelect: (url: string | undefined) => Promise<void> | void;
  onClose: () => void;
};

export function GroupIconPicker({ isOpen, groupName, selectedUrl, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [customUrl, setCustomUrl] = React.useState('');
  const [invalidUrl, setInvalidUrl] = React.useState(false);
  const [saveError, setSaveError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSearch('');
      setCategory('');
      setCustomUrl('');
      setInvalidUrl(false);
      setSaveError(false);
    }
  }, [isOpen]);

  const visibleIcons = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return catalog.icons.filter(
      (icon) =>
        (!category || icon.category === category) &&
        (!query || `${icon.name} ${icon.category}`.toLocaleLowerCase().includes(query)),
    );
  }, [category, search]);

  const choose = async (url: string | undefined) => {
    if (saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      await onSelect(url);
      onClose();
    } catch (error) {
      console.error('Cannot save group icon', error);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const chooseCustom = (event: React.FormEvent) => {
    event.preventDefault();
    const url = customUrl.trim();
    if (!isWebImageUrl(url)) {
      setInvalidUrl(true);
      return;
    }
    void choose(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      title={t('group_icon_library')}
      className={s.dialog}
    >
      <div className={s.heading}>
        <div>
          <h2>{t('group_icon_library')}</h2>
          <p>{t('group_icon_for', { name: groupName })}</p>
        </div>
        <button type="button" className={s.close} onClick={onClose} aria-label={t('close')}>
          ×
        </button>
      </div>

      <div className={s.filters}>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('search_icons')}
          aria-label={t('search_icons')}
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label={t('icon_category')}
        >
          <option value="">{t('all_categories')}</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className={s.count}>{t('icons_found', { count: visibleIcons.length })}</div>
      <div className={s.grid}>
        {visibleIcons.map((icon) => (
          <button
            type="button"
            key={icon.url}
            className={`${s.iconButton} ${selectedUrl === icon.url ? s.selected : ''}`}
            onClick={() => void choose(icon.url)}
            title={`${icon.name} · ${icon.category}`}
            aria-label={`${icon.name} · ${icon.category}`}
            aria-pressed={selectedUrl === icon.url}
            disabled={saving}
          >
            <img src={icon.url} alt="" loading="lazy" referrerPolicy="no-referrer" />
            <span>{icon.name}</span>
          </button>
        ))}
        {visibleIcons.length === 0 ? <p className={s.empty}>{t('no_icons_found')}</p> : null}
      </div>

      <form className={s.custom} onSubmit={chooseCustom}>
        <label htmlFor="group-icon-url">{t('custom_icon_url')}</label>
        <div className={s.customRow}>
          <input
            id="group-icon-url"
            type="url"
            value={customUrl}
            onChange={(event) => {
              setCustomUrl(event.target.value);
              setInvalidUrl(false);
            }}
            placeholder="https://example.com/icon.png"
          />
          <button type="submit" disabled={saving}>{t('use_icon_url')}</button>
        </div>
        {invalidUrl ? <p className={s.error}>{t('invalid_icon_url')}</p> : null}
        {saveError ? <p className={s.error} role="alert">{t('group_icon_save_failed')}</p> : null}
      </form>

      <div className={s.footer}>
        <a href="https://github.com/Hawaiine/Oasisic-Icons" target="_blank" rel="noreferrer">
          Oasisic-Icons
        </a>
        <button type="button" onClick={() => void choose(undefined)} disabled={saving}>
          {t('reset_group_icon')}
        </button>
      </div>
    </Modal>
  );
}

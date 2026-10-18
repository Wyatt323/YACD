import * as React from 'react';
import { useTranslation } from 'react-i18next';

import Modal from '~/components/shared/Modal';
import { isWebImageUrl } from '~/modules/proxies/groupIcons';
import {
  deleteIconLibrary,
  getIconLibraries,
  IconLibrary,
  loadLibraryFromURL,
  saveIconLibrary,
} from '~/modules/proxies/iconLibraries';
import catalog from '~/oasisic-icons.json';

import s from './GroupIconPicker.module.scss';

type Props = {
  isOpen: boolean;
  groupName: string;
  selectedUrl?: string;
  configIcon?: string;
  storageMode: 'loading' | 'local' | 'server' | 'error';
  onSelect: (url: string | undefined) => Promise<void> | void;
  onClose: () => void;
};

export function GroupIconPicker({
  isOpen,
  groupName,
  selectedUrl,
  configIcon,
  storageMode,
  onSelect,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [customUrl, setCustomUrl] = React.useState('');
  const [invalidUrl, setInvalidUrl] = React.useState(false);
  const [saveError, setSaveError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [libraries, setLibraries] = React.useState<IconLibrary[]>([]);
  const [libraryId, setLibraryId] = React.useState('all');
  const [libraryURL, setLibraryURL] = React.useState('');
  const [libraryBusy, setLibraryBusy] = React.useState(false);
  const [libraryError, setLibraryError] = React.useState('');

  React.useEffect(() => {
    if (isOpen) {
      setSearch('');
      setCategory('');
      setCustomUrl('');
      setInvalidUrl(false);
      setSaveError(false);
      setLibraryError('');
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen || !['server', 'local'].includes(storageMode)) return;
    let active = true;
    getIconLibraries(storageMode === 'server')
      .then((items) => {
        if (active) setLibraries(items);
      })
      .catch((error) => {
        console.error('Cannot load icon libraries', error);
        if (active) setLibraryError(t('icon_library_load_failed'));
      });
    return () => {
      active = false;
    };
  }, [isOpen, storageMode, t]);

  const selectedLibrary = libraries.find((item) => item.id === libraryId);
  const allIcons = React.useMemo(
    () => [
      ...catalog.icons.map((icon) => ({ ...icon, libraryId: 'builtin' })),
      ...libraries.flatMap((library) =>
        library.icons.map((icon) => ({ ...icon, libraryId: library.id })),
      ),
    ],
    [libraries],
  );
  const libraryIcons =
    libraryId === 'all' ? allIcons : allIcons.filter((icon) => icon.libraryId === libraryId);
  const categories = [...new Set(libraryIcons.map((icon) => icon.category))].sort();

  const visibleIcons = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return libraryIcons.filter(
      (icon) =>
        (!category || icon.category === category) &&
        (!query || `${icon.name} ${icon.category}`.toLocaleLowerCase().includes(query)),
    );
  }, [category, search, libraryIcons]);

  const addLibrary = async (event: React.FormEvent) => {
    event.preventDefault();
    if (libraryBusy || !['server', 'local'].includes(storageMode)) return;
    setLibraryBusy(true);
    setLibraryError('');
    try {
      const library = await loadLibraryFromURL(libraryURL);
      const saved = await saveIconLibrary(library, storageMode === 'server');
      setLibraries(saved);
      setLibraryId(saved.find((item) => item.source === library.source)?.id || 'all');
      setCategory('');
      setLibraryURL('');
    } catch (error) {
      console.error('Cannot add icon library', error);
      setLibraryError(error instanceof Error ? error.message : t('icon_library_add_failed'));
    } finally {
      setLibraryBusy(false);
    }
  };

  const removeLibrary = async () => {
    if (!selectedLibrary || libraryBusy) return;
    setLibraryBusy(true);
    setLibraryError('');
    try {
      setLibraries(await deleteIconLibrary(selectedLibrary.id, storageMode === 'server'));
      setLibraryId('all');
      setCategory('');
    } catch (error) {
      console.error('Cannot remove icon library', error);
      setLibraryError(t('icon_library_remove_failed'));
    } finally {
      setLibraryBusy(false);
    }
  };

  const refreshLibrary = async () => {
    if (!selectedLibrary || libraryBusy) return;
    setLibraryBusy(true);
    setLibraryError('');
    try {
      const library = await loadLibraryFromURL(selectedLibrary.source);
      setLibraries(await saveIconLibrary(library, storageMode === 'server'));
    } catch (error) {
      console.error('Cannot refresh icon library', error);
      setLibraryError(t('icon_library_refresh_failed'));
    } finally {
      setLibraryBusy(false);
    }
  };

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

      {configIcon && isWebImageUrl(configIcon) ? (
        <button
          type="button"
          className={`${s.configIcon} ${!selectedUrl ? s.configIconSelected : ''}`}
          onClick={() => void choose(undefined)}
          disabled={saving}
        >
          <img src={configIcon} alt="" referrerPolicy="no-referrer" />
          <span>{t('use_config_icon_default')}</span>
        </button>
      ) : null}

      <div className={s.libraryRow}>
        <select
          value={libraryId}
          onChange={(event) => {
            setLibraryId(event.target.value);
            setCategory('');
          }}
          aria-label={t('select_icon_library')}
        >
          <option value="all">{t('all_icon_libraries')}</option>
          <option value="builtin">Oasisic-Icons</option>
          {libraries.map((library) => (
            <option key={library.id} value={library.id}>
              {library.name}
            </option>
          ))}
        </select>
        {selectedLibrary ? (
          <>
            <button type="button" onClick={() => void refreshLibrary()} disabled={libraryBusy}>
              {t('refresh_icon_library')}
            </button>
            <button type="button" onClick={() => void removeLibrary()} disabled={libraryBusy}>
              {t('remove_icon_library')}
            </button>
          </>
        ) : null}
      </div>
      <form className={s.libraryRow} onSubmit={(event) => void addLibrary(event)}>
        <input
          type="url"
          value={libraryURL}
          onChange={(event) => setLibraryURL(event.target.value)}
          placeholder={t('icon_library_url_placeholder')}
          aria-label={t('icon_library_url')}
          required
        />
        <button
          type="submit"
          disabled={libraryBusy || storageMode === 'error' || storageMode === 'loading'}
        >
          {libraryBusy ? t('icon_library_adding') : t('add_icon_library')}
        </button>
      </form>
      {libraryError ? (
        <p className={s.error} role="alert">
          {libraryError}
        </p>
      ) : null}

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
            key={`${icon.libraryId}:${icon.url}`}
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
          <button type="submit" disabled={saving}>
            {t('use_icon_url')}
          </button>
        </div>
        {invalidUrl ? <p className={s.error}>{t('invalid_icon_url')}</p> : null}
        {saveError ? (
          <p className={s.error} role="alert">
            {t('group_icon_save_failed')}
          </p>
        ) : null}
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

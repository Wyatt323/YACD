import cx from 'clsx';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { GroupIconPicker } from '~/components/proxies/GroupIconPicker';
import { IconTemplateManager } from '~/components/proxies/IconTemplateManager';
import { ProxiesHeader } from '~/components/proxies/ProxiesHeader';
import { ProxyGroup } from '~/components/proxies/ProxyGroup';
import { ProxyProvider } from '~/components/proxies/ProxyProvider';
import {
  browserIconsNeedMigration,
  fetchServerIcons,
  importBrowserIcons,
  markBrowserIconsMigrated,
  readGroupIconAssignments,
  saveGroupIconAssignments,
  saveServerIcon,
  ServerIconSet,
} from '~/modules/proxies/groupIcons';
import {
  createIconTemplate,
  deleteIconTemplate,
  fetchIconTemplates,
  IconTemplateState,
  renameIconTemplate,
  selectIconTemplate,
} from '~/modules/proxies/iconTemplates';
import {
  useCollapseAll,
  useDelayMapping,
  useProxiesPage,
  useProxiesQuery,
  useTestAllLatency,
  useUpdateProviderItems,
  useVisibleGroupNames,
  useVisibleProviders,
} from '~/modules/proxies/hooks';
import { ProxiesAppConfig } from '~/modules/proxies/utils';
import { ClashAPIConfig } from '~/types';

import s0 from './Proxies.module.scss';

type Props = {
  collapsibleIsOpen: Record<string, boolean>;
  apiConfig: ClashAPIConfig;
  appConfig: ProxiesAppConfig;
};

export default function Proxies({ collapsibleIsOpen, apiConfig, appConfig }: Props) {
  const { t } = useTranslation();
  const [iconAssignments, setIconAssignments] = React.useState(readGroupIconAssignments);
  const [serverIconSet, setServerIconSet] = React.useState<ServerIconSet | null>(null);
  const [templateState, setTemplateState] = React.useState<IconTemplateState | null>(null);
  const [iconStorage, setIconStorage] = React.useState<'loading' | 'local' | 'server' | 'error'>(
    'loading',
  );
  const iconWriteGeneration = React.useRef(0);
  const [editingGroupName, setEditingGroupName] = React.useState<string | null>(null);
  const backendKey = apiConfig.baseURL || 'default';

  React.useEffect(() => {
    let active = true;
    async function refresh() {
      const generation = iconWriteGeneration.current;
      try {
        let saved = await fetchServerIcons();
        if (!active || generation !== iconWriteGeneration.current) return;
        if (!saved) {
          setTemplateState(null);
          setIconStorage('local');
          return;
        }
        let templates = await fetchIconTemplates();
        if (saved.profile.id !== templates.activeId) {
          saved = await fetchServerIcons();
          templates = await fetchIconTemplates();
          if (!saved || saved.profile.id !== templates.activeId) return;
        }
        if (!active || generation !== iconWriteGeneration.current) return;
        const oldIcons = browserIconsNeedMigration(backendKey)
          ? readGroupIconAssignments()[backendKey] || {}
          : {};
        if (!saved.initialized) saved = await importBrowserIcons(oldIcons);
        if (!active || generation !== iconWriteGeneration.current) return;
        markBrowserIconsMigrated(backendKey);
        setServerIconSet(saved);
        setTemplateState(templates);
        setIconStorage('server');
      } catch (error) {
        console.error('Cannot load shared group icons', error);
        if (active && generation === iconWriteGeneration.current) setIconStorage('error');
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [backendKey]);

  React.useEffect(() => {
    saveGroupIconAssignments(iconAssignments);
  }, [iconAssignments]);

  const setGroupIcon = React.useCallback(
    async (groupName: string, url: string | undefined) => {
      if (iconStorage === 'server') {
        iconWriteGeneration.current += 1;
        if (!serverIconSet) throw new Error('Icon template is unavailable');
        const saved = await saveServerIcon(groupName, url, serverIconSet.profile.id);
        setServerIconSet(saved);
        return;
      }
      if (iconStorage !== 'local') throw new Error('Icon storage is unavailable');
      setIconAssignments((previous) => {
        const backendIcons = { ...(previous[backendKey] || {}) };
        if (url) backendIcons[groupName] = url;
        else delete backendIcons[groupName];
        return { ...previous, [backendKey]: backendIcons };
      });
    },
    [backendKey, iconStorage, serverIconSet],
  );

  const activeIcons = iconStorage === 'server' ? serverIconSet?.icons : iconAssignments[backendKey];

  const changeTemplate = async (action: () => Promise<IconTemplateState>) => {
    iconWriteGeneration.current += 1;
    let templates = await action();
    let icons = await fetchServerIcons();
    if (icons?.profile.id !== templates.activeId) {
      templates = await fetchIconTemplates();
      icons = await fetchServerIcons();
    }
    if (!icons || icons.profile.id !== templates.activeId) {
      throw new Error('Icon template changed; please retry');
    }
    setTemplateState(templates);
    setServerIconSet(icons);
    setEditingGroupName(null);
  };

  // the panel's configured test URL only feeds the latency-color threshold here;
  // the actual URL used per request is resolved in the mutation hooks
  const httpsLatencyTest = appConfig.latencyTestUrl.startsWith('https://');

  const { data, dataUpdatedAt } = useProxiesQuery(apiConfig);
  const { proxies, groupNames, proxyProviders } = data;
  const delay = useDelayMapping(proxies, dataUpdatedAt);

  // 搜索同时作用于代理组/提供商本身和它们旗下的节点
  const visibleGroupNames = useVisibleGroupNames(groupNames, proxies);
  const visibleProviders = useVisibleProviders(proxyProviders);

  const {
    isSettingsOpen,
    toggleSettings,
    closeSettings,
    activeTab,
    setActiveTab,
    proxyGroups,
    providers,
  } = useProxiesPage({
    groupNames: visibleGroupNames,
    proxyProviders: visibleProviders,
    proxiesLayout: appConfig.proxiesLayout,
  });

  const providerNames = React.useMemo(
    () => proxyProviders.map((item) => item.name),
    [proxyProviders],
  );
  const visibleProviderNames = React.useMemo(
    () => visibleProviders.map((item) => item.name),
    [visibleProviders],
  );

  // 折叠是视图操作，只作用于搜索后可见的卡片
  const [toggleCollapseAll, allCollapsed] = useCollapseAll({
    prefix: activeTab === 'proxies' ? 'proxyGroup' : 'proxyProvider',
    names: activeTab === 'proxies' ? visibleGroupNames : visibleProviderNames,
    collapsibleIsOpen,
  });

  const [testAll, isTestingLatency] = useTestAllLatency(apiConfig, appConfig);
  const [updateAllProviders, isUpdatingProviders] = useUpdateProviderItems(
    apiConfig,
    providerNames,
  );

  const containerClassName = cx(s0.groupsContainer, {
    [s0.doubleColumn]: appConfig.proxiesLayout === 'double',
  });

  const content =
    activeTab === 'proxies' ? (
      <div className={containerClassName}>
        {proxyGroups.map((column, i) => (
          <div key={i} className={s0.column}>
            {column.map(({ name, i: originalIndex }) => (
              <div className={s0.group} key={name} style={{ order: originalIndex }}>
                <ProxyGroup
                  name={name}
                  iconOverrides={activeIcons || {}}
                  onEditIcon={() => setEditingGroupName(name)}
                  delay={delay}
                  apiConfig={apiConfig}
                  appConfig={appConfig}
                  proxies={proxies}
                  isOpen={Boolean(collapsibleIsOpen[`proxyGroup:${name}`])}
                  httpsLatencyTest={httpsLatencyTest}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    ) : (
      <div className={containerClassName}>
        {providers.map((column, i) => (
          <div key={i} className={s0.column}>
            {column.map(({ item, i: originalIndex }) => (
              <div className={s0.group} key={item.name} style={{ order: originalIndex }}>
                <ProxyProvider
                  name={item.name}
                  proxies={item.proxies}
                  type={item.type}
                  vehicleType={item.vehicleType}
                  updatedAt={item.updatedAt}
                  subscriptionInfo={item.subscriptionInfo}
                  proxyMapping={proxies}
                  httpsLatencyTest={httpsLatencyTest}
                  delay={delay}
                  isOpen={Boolean(collapsibleIsOpen[`proxyProvider:${item.name}`])}
                  apiConfig={apiConfig}
                  appConfig={appConfig}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    );

  return (
    <div className={s0.page}>
      <ProxiesHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        groupCount={visibleGroupNames.length}
        providerCount={proxyProviders.length}
        visibleProviderCount={visibleProviders.length}
        appConfig={appConfig}
        isSettingsOpen={isSettingsOpen}
        toggleSettings={toggleSettings}
        closeSettings={closeSettings}
        onToggleCollapseAll={toggleCollapseAll}
        allCollapsed={allCollapsed}
        onTestAll={testAll}
        isTestingLatency={isTestingLatency}
        onUpdateAllProviders={updateAllProviders}
        isUpdatingProviders={isUpdatingProviders}
      />
      {iconStorage === 'server' && templateState ? (
        <IconTemplateManager
          state={templateState}
          onCreate={(name) => changeTemplate(() => createIconTemplate(name))}
          onSelect={(id) => changeTemplate(() => selectIconTemplate(id))}
          onRename={(id, name) => changeTemplate(() => renameIconTemplate(id, name))}
          onDelete={(id) => changeTemplate(() => deleteIconTemplate(id))}
        />
      ) : null}
      {iconStorage === 'error' ? <p role="alert">{t('group_icons_server_error')}</p> : null}
      {content}
      <GroupIconPicker
        isOpen={editingGroupName !== null}
        groupName={editingGroupName || ''}
        selectedUrl={editingGroupName ? activeIcons?.[editingGroupName] : undefined}
        configIcon={editingGroupName ? proxies[editingGroupName]?.icon : undefined}
        storageMode={iconStorage}
        onSelect={(url) => {
          if (editingGroupName) setGroupIcon(editingGroupName, url);
        }}
        onClose={() => setEditingGroupName(null)}
      />
    </div>
  );
}

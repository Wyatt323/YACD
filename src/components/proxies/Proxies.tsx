import cx from 'clsx';
import * as React from 'react';

import { GroupIconPicker } from '~/components/proxies/GroupIconPicker';
import { ProxiesHeader } from '~/components/proxies/ProxiesHeader';
import { ProxyGroup } from '~/components/proxies/ProxyGroup';
import { ProxyProvider } from '~/components/proxies/ProxyProvider';
import { readGroupIconAssignments, saveGroupIconAssignments } from '~/modules/proxies/groupIcons';
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
  const [iconAssignments, setIconAssignments] = React.useState(readGroupIconAssignments);
  const [editingGroupName, setEditingGroupName] = React.useState<string | null>(null);
  const backendKey = apiConfig.baseURL || 'default';

  React.useEffect(() => {
    saveGroupIconAssignments(iconAssignments);
  }, [iconAssignments]);

  const setGroupIcon = React.useCallback(
    (groupName: string, url: string | undefined) => {
      setIconAssignments((previous) => {
        const backendIcons = { ...(previous[backendKey] || {}) };
        if (url) backendIcons[groupName] = url;
        else delete backendIcons[groupName];
        return { ...previous, [backendKey]: backendIcons };
      });
    },
    [backendKey],
  );

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
                  iconOverride={iconAssignments[backendKey]?.[name]}
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
      {content}
      <GroupIconPicker
        isOpen={editingGroupName !== null}
        groupName={editingGroupName || ''}
        selectedUrl={editingGroupName ? iconAssignments[backendKey]?.[editingGroupName] : undefined}
        onSelect={(url) => {
          if (editingGroupName) setGroupIcon(editingGroupName, url);
        }}
        onClose={() => setEditingGroupName(null)}
      />
    </div>
  );
}

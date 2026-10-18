import * as React from 'react';

import s from './ConnectionChainIcon.module.scss';

type Props = {
  name: string;
  icons: Record<string, string>;
};

export function ConnectionChainIcon({ name, icons }: Props) {
  const url = icons[name];
  const [failedUrl, setFailedUrl] = React.useState('');
  if (!url || failedUrl === url) return null;

  return (
    <img
      className={s.icon}
      src={url}
      alt=""
      aria-hidden
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(url)}
    />
  );
}

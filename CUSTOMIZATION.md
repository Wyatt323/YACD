# Yacd-meta with Oasisic icon library

This branch keeps the upstream Yacd-meta history and adds a browser-side Oasisic icon picker on the Proxies page. Logo choices are stored in the browser, per backend URL and group name. They do not change Mihomo's configuration.

## Upstream updates

`.github/workflows/sync-upstream.yml` checks `MetaCubeX/Yacd-meta` every 15 minutes. It merges `upstream/master` into this branch, then runs lint, typecheck, and build. Only a successful merge and build are pushed. The same run publishes the built UI to the `gh-pages` branch and saves it as an Actions artifact.

GitHub scheduled workflows can be delayed. If an upstream merge conflicts or the build fails, the workflow stops and the last working branch and published UI remain in place. Review the failed Actions run and resolve the conflict manually.

The original upstream deployment and release workflows were removed because they target the upstream project's own domain and release process. This repository's UI is published without a custom domain.

## Using the published UI

The `gh-pages` branch contains the latest verified UI build. Mihomo can download it through `external-ui-url`:

```yaml
external-ui: ui
external-ui-url: https://github.com/Wyatt323/YACD/archive/refs/heads/gh-pages.zip
```

Mihomo's `POST /upgrade/ui` endpoint downloads the configured UI package. Updating the GitHub repository alone does not replace a locally installed UI; arrange a trusted local scheduler or use the panel's UI update control to call this endpoint.

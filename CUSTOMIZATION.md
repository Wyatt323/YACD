# Yacd-meta with Oasisic icon library

This branch keeps the upstream Yacd-meta history and adds an Oasisic icon picker on the Proxies page. Logo choices do not change Mihomo's configuration. In the Docker deployment below, choices are shared through a persistent server file and keyed by the resolved configuration file path. A static `gh-pages` or `external-ui` deployment still uses browser storage because Mihomo does not provide a custom icon storage API.

## Shared icons with Docker

Copy `docker-compose.icons.yml`, replace the example configuration directory mount and Mihomo API address, then run `docker compose -f docker-compose.icons.yml up -d --build`. Open the panel at `http://YOUR_SERVER_IP:9080`. The panel's `/_yacd/icons` endpoint stores assignments in `/data/group-icons.json`; keep `/data` on a persistent volume. The configuration directory is mounted read-only at `/config` and is never edited by the icon service.

The service identifies the active icon set by the configuration file's resolved path. Reloading or updating the same file keeps the icons. To use a different icon set, point `YACD_CONFIG_FILE` at another file path and restart the container. A symlink can be used to switch files without changing the environment variable; refresh the panel after switching. Existing browser choices are imported once for a new server profile when the old and new panels use the same browser origin and backend URL.

The Docker panel and the Mihomo controller are on different origins, so allow the panel origin in Mihomo's `external-controller-cors` setting. Set `YACD_DEFAULT_BACKEND` to an API address reachable from users' devices. Keep the panel on a trusted network or protect it with an authenticating reverse proxy: anyone who can access the panel can change shared icons. The static UI ZIP from `gh-pages` cannot provide shared server storage on its own.

## Icon libraries and configuration defaults

The picker includes Oasisic and accepts additional GitHub repository URLs or JSON catalog URLs. A GitHub repository import reads image files from its default branch using GitHub's public API. A JSON catalog may be an array of `{ "name", "category", "url" }` entries or an object with `name` and `icons`; icon URLs may be relative to the JSON URL. Use a URL that allows browser cross-origin access. Refresh an added library to import upstream changes. Added catalogs are shared by all devices in the Docker deployment and stored in `/data/group-icons.json`; static deployments store them in the browser.

For each proxy group, Mihomo's `icon` field (including one generated from a subconverter INI `!!icon=` setting) is the default. An icon picked in the panel overrides it. Use “Use configuration icon” in the picker to remove the override and show the current configuration icon again.

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

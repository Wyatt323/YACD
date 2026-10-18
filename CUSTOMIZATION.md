# Yacd-meta with Oasisic icon library

This branch keeps the upstream Yacd-meta history and adds an Oasisic icon picker on the Proxies page. Logo choices do not change Mihomo's configuration. In the Docker deployment below, choices and the selected template are shared through a persistent server file. A static `gh-pages` or `external-ui` deployment still uses browser storage because Mihomo does not provide a custom icon storage API.

## Shared icons with Docker

Copy `docker-compose.icons.yml`, replace the example configuration directory mount and Mihomo API address, then run `docker compose -f docker-compose.icons.yml up -d --build`. Open the panel at `http://YOUR_SERVER_IP:9080`. The panel's `/_yacd/icons` endpoint stores assignments in `/data/group-icons.json`; keep `/data` on a persistent volume. The configuration directory is mounted read-only at `/config` and is never edited by the icon service.

Create and select icon templates on the Proxies page. Reloading or updating a Mihomo configuration keeps the selected template's icons. When changing to another configuration, select its matching template in the panel. Older installations using `YACD_CONFIG_FILE` or `YACD_PROFILE_KEY` migrate their saved icons into templates when the service first starts. Existing browser choices are imported once into an uninitialized server template when the old and new panels use the same browser origin and backend URL.

The Docker panel and the Mihomo controller are on different origins, so allow the panel origin in Mihomo's `external-controller-cors` setting. Set `YACD_DEFAULT_BACKEND` to an API address reachable from users' devices. Keep the panel on a trusted network or protect it with an authenticating reverse proxy: anyone who can access the panel can change shared icons. The static UI ZIP from `gh-pages` cannot provide shared server storage on its own.

### Existing nginx container

For a deployment that mounts `./conf.d` and `./html` into a stock `nginx` image, use `docker-compose.nginx-sidecar.yml` as a starting point. Keep the built UI in `./html`. The separate `yacd-icon-store` service writes to the host directory `./yacd-data`, which is mounted only into that service and must not be placed under `./html`. The Proxies page can create, rename, delete, and select shared icon templates; no OpenWrt filesystem mount or manual profile key is needed.

Add all three exact locations below to the existing nginx `server { ... }` in `./conf.d`:

```nginx
client_max_body_size 2m;
location = /_yacd/icons {
    proxy_pass http://yacd-icon-store:3001;
}
location = /_yacd/libraries {
    proxy_pass http://yacd-icon-store:3001;
}
location = /_yacd/templates {
    proxy_pass http://yacd-icon-store:3001;
}
```

The icon service has no published host port. If you keep your own Compose file, add the `yacd-icon-store` service and the three nginx locations there. On the host, back up `./yacd-data/group-icons.json`. Each template keeps its icons when the OpenWrt configuration is updated. When switching the configuration on OpenWrt, select its matching icon template in the Proxies page. The Docker host cannot detect that remote switch automatically without an additional integration. The older local-file and manual profile-key settings are used only to name an existing saved icon set during migration to templates.

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

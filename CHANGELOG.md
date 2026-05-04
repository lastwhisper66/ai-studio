# Changelog

## [1.1.0](https://github.com/lastwhisper66/ai-studio/compare/v1.0.5...v1.1.0) (2026-05-04)


### Features

* **backup:** add .aibackup file codec ([a4fa0d1](https://github.com/lastwhisper66/ai-studio/commit/a4fa0d120b0ad5cd211ba7bd1c6e78bbb0bd1a68))
* **backup:** add backup error codes and i18n strings ([32cee7e](https://github.com/lastwhisper66/ai-studio/commit/32cee7e13484b11a0c8b948bd5eb98cfe8f40bb5))
* **backup:** add backup IPC channel constants ([53c7e49](https://github.com/lastwhisper66/ai-studio/commit/53c7e4908a482c9500c2cdebf56f0804088b075d))
* **backup:** add backup shared types ([a880acc](https://github.com/lastwhisper66/ai-studio/commit/a880acccdb19b11d519a68c137d4850e4b9e1a40))
* **backup:** add PBKDF2 + AES-256-GCM crypto module ([33aa280](https://github.com/lastwhisper66/ai-studio/commit/33aa280b3dafd7e2ea05bcd1eb35e14a49f71a17))
* **backup:** allow webdav and s3 remotes to be used together ([a2461c4](https://github.com/lastwhisper66/ai-studio/commit/a2461c470e1aec4a2ccc5a62276f1fd5043fb285))
* **backup:** applySnapshot() with transaction + atomic avatars swap ([db5eccd](https://github.com/lastwhisper66/ai-studio/commit/db5eccddbafcee2fd3291736182f37b3f48857c9))
* **backup:** BackupRemote interface ([5c53581](https://github.com/lastwhisper66/ai-studio/commit/5c53581d3b3b70e8ba7c6d40d9f386858cda7e38))
* **backup:** BackupSyncService with manifest + LWW + retention ([a984c7d](https://github.com/lastwhisper66/ai-studio/commit/a984c7d39f6a2b24e426811c6eabd83e8f898a15))
* **backup:** browse and restore from local rollback copies ([13805dc](https://github.com/lastwhisper66/ai-studio/commit/13805dcfdb6bc0ac81ef0920a63b1eb836e4c6bf))
* **backup:** clarify sync passphrase wording for cross-device recovery ([65e39d1](https://github.com/lastwhisper66/ai-studio/commit/65e39d1fc6c0b5b1d02a2faad572711252d94473))
* **backup:** cloud remote configuration UI + WebDAV/S3 wiring ([3be862d](https://github.com/lastwhisper66/ai-studio/commit/3be862da592ecb19afa1cda4287f21190e7265ba))
* **backup:** cloud sync UI — sync now, intervals, history dialog ([4ff163b](https://github.com/lastwhisper66/ai-studio/commit/4ff163bc53df91c907967b12e9c6f1c4db20bc9c))
* **backup:** collectSnapshot() reads all config tables ([0ef1615](https://github.com/lastwhisper66/ai-studio/commit/0ef1615fff9fec08440c3f54f36b41e2484350b0))
* **backup:** dirty-tracker for lastLocalChangeAt ([493e983](https://github.com/lastwhisper66/ai-studio/commit/493e983db5ad20f872f77bf559584a1894f6199f))
* **backup:** export/import facade ([f3bde7b](https://github.com/lastwhisper66/ai-studio/commit/f3bde7b3e7681b88678b0e119bd994edab460557))
* **backup:** expose window.api.backup.* surface ([dd7f671](https://github.com/lastwhisper66/ai-studio/commit/dd7f671997783f05cd3b6abb7ca091e8f4c8c215))
* **backup:** in-flight progress indicator + i18n polish ([1019c7d](https://github.com/lastwhisper66/ai-studio/commit/1019c7da04e02eb7305dc42d97e59393a4e90ca3))
* **backup:** local export/import end-to-end UI ([3829a3c](https://github.com/lastwhisper66/ai-studio/commit/3829a3c5fede8475de7af674cc193f39a09bcdfa))
* **backup:** password input dialog ([3ce612c](https://github.com/lastwhisper66/ai-studio/commit/3ce612cd182fd1d0fed7c00d9ffee2ce32e22185))
* **backup:** register local export/import IPC handlers ([5dd47ab](https://github.com/lastwhisper66/ai-studio/commit/5dd47ab97579d035763c9068ce77f6440646535d))
* **backup:** renderer backup store ([eb9af6f](https://github.com/lastwhisper66/ai-studio/commit/eb9af6f9618d4c7030d68dec24fece08a67f310f))
* **backup:** replace WebDAV PROPFIND regex parser with fast-xml-parser ([bd8957d](https://github.com/lastwhisper66/ai-studio/commit/bd8957d703ffb4c9ffb3f9af97d95234a33003e5))
* **backup:** S3-compatible remote via @aws-sdk/client-s3 ([2f93075](https://github.com/lastwhisper66/ai-studio/commit/2f93075eb18030d045c255544bce7f2e186317d5))
* **backup:** sync IPC handlers (sync-now/cancel/list-remote/restore-from-remote) ([ffc1107](https://github.com/lastwhisper66/ai-studio/commit/ffc11077aa2e025fa2f65d1e6af7f4008dce4378))
* **backup:** WebDAV remote implementation ([a6c3d1f](https://github.com/lastwhisper66/ai-studio/commit/a6c3d1fe969f6d60061a7bb78f41db9b9d31a43d))
* data backup and cloud sync ([fc99c61](https://github.com/lastwhisper66/ai-studio/commit/fc99c614e9b7e86d65cbb7c84bbdd43bc964d0d4))


### Bug Fixes

* **backup:** harden crypto, restore atomicity, and sync correctness ([fffed77](https://github.com/lastwhisper66/ai-studio/commit/fffed777a8be6a196a4c3550dc58f63c3f69d858))
* **backup:** repair cloud overview UI and add boot-time catch-up sync ([d61fca0](https://github.com/lastwhisper66/ai-studio/commit/d61fca05a196a505ffdd21e9a770eb702164130d))
* **backup:** stub get-status / get-remote-config to silence boot errors ([7b1585c](https://github.com/lastwhisper66/ai-studio/commit/7b1585ce46623191d64cbc741ca34f39ba0630ff))
* **backup:** unstick post-sync UI and persist passphrase value ([06150e8](https://github.com/lastwhisper66/ai-studio/commit/06150e8a68c494437109a840114a8710bb10b3bb))
* **backup:** unstick post-sync UI and persist passphrase value ([c334ee9](https://github.com/lastwhisper66/ai-studio/commit/c334ee9c40385c71b1103b2ec7bd623bfd7bfa84))
* **backup:** WebDAV MKCOL the configured subPath, not just file's parent ([577f655](https://github.com/lastwhisper66/ai-studio/commit/577f655119ef773721ce828fdc939a96ed646077))

## [1.0.5](https://github.com/lastwhisper66/ai-studio/compare/v1.0.4...v1.0.5) (2026-05-02)

### Bug Fixes

- prevent update checks from getting stuck ([9486f36](https://github.com/lastwhisper66/ai-studio/commit/9486f3626b1f6cdfb5f446a5e2333de402e30826))

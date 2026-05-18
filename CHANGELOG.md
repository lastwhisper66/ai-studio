# Changelog

## [1.7.1](https://github.com/lastwhisper66/ai-studio/compare/v1.7.0...v1.7.1) (2026-05-18)


### Code Refactoring

* **user-profile:** replace blur autosave with explicit save button ([95d4b01](https://github.com/lastwhisper66/ai-studio/commit/95d4b0142132d69e6ee91da90f7666a75bea2a67))

## [1.7.0](https://github.com/lastwhisper66/ai-studio/compare/v1.6.2...v1.7.0) (2026-05-17)


### Features

* **db:** seed assistant templates in seedDatabaseDefaults ([77af984](https://github.com/lastwhisper66/ai-studio/commit/77af984d8e583b2776cc2ce9da4ed2ae591c154f))
* **migrate:** promote model_definitions.group_name into model_groups ([61650df](https://github.com/lastwhisper66/ai-studio/commit/61650dfd190bedd18d80a66c5e5b11fcd6036dd9))
* **modelGroupStore:** add reorder() and resolveRule() ([303887c](https://github.com/lastwhisper66/ai-studio/commit/303887c112a7c118157aa412b4d62d1280178a45))
* **remote-model-dialog:** order groups by model_groups.sort_order ([cb4cf43](https://github.com/lastwhisper66/ai-studio/commit/cb4cf430a6776173fb5605dbefdcf55b26de642c))
* **settings:** add BatchToolbar for model definitions ([c2bed09](https://github.com/lastwhisper66/ai-studio/commit/c2bed098f40b0baffb1b61e704e34135d17a771c))
* **settings:** add GroupRulesPanel with drag-sort and pseudo-nodes ([b8517da](https://github.com/lastwhisper66/ai-studio/commit/b8517da0939552fcc91510f3552b514673f2e242))
* **settings:** add MatchPreviewBar component ([41f10c7](https://github.com/lastwhisper66/ai-studio/commit/41f10c704db32f67252ca9b1e2677d0ac5d6a459))
* **settings:** add ModelDefinitionsPanel with batch selection ([201c7e9](https://github.com/lastwhisper66/ai-studio/commit/201c7e9fb6b5417f8f966e4393e1cb9fdbd4426f))
* **settings:** add ModelManagementSection (two-column merged page) ([114f62f](https://github.com/lastwhisper66/ai-studio/commit/114f62f02f06a8276d026c69bafd8fa1b67e5516))
* **settings:** extract ModelDefinitionDialog (no group field) ([2c471ce](https://github.com/lastwhisper66/ai-studio/commit/2c471cebffdf72e4e480e5586396ca2b43ccae7a))
* **settings:** extract ModelGroupDialog into its own file ([f320b40](https://github.com/lastwhisper66/ai-studio/commit/f320b4009fe6967c267cf27a74d41b645dcae098))
* **settings:** improve BatchToolbar UX and drop unused capabilities ([dfb9e9c](https://github.com/lastwhisper66/ai-studio/commit/dfb9e9c5d4900e5ebd18d724d08115c703840e0a))
* **settings:** switch SettingsSidebar entry to model-management ([bf54fc3](https://github.com/lastwhisper66/ai-studio/commit/bf54fc31d1016676995e345d788b2dba4437b5b9))
* **theme:** default to system theme on first launch ([e14f1f6](https://github.com/lastwhisper66/ai-studio/commit/e14f1f6c69232a0db81292f5a12afe1a8af0369c))
* **window:** prompt for close behavior on first close ([a00d79f](https://github.com/lastwhisper66/ai-studio/commit/a00d79f76dc3de0534207dac0cfd5dbe7814239f))


### Bug Fixes

* **capability-config:** distinct icons for free/embedding/reranking ([da3dfe5](https://github.com/lastwhisper66/ai-studio/commit/da3dfe5f3aeb123497a3eb15f5ec570cde5f6000))
* **translate:** store native language labels in translation history ([b575b6a](https://github.com/lastwhisper66/ai-studio/commit/b575b6ab0cac3832be65ab78aae972915b30e5d9))


### Code Refactoring

* **builtins:** shorten quick action names, drop selection Polish ([c1e06bc](https://github.com/lastwhisper66/ai-studio/commit/c1e06bc4e6c4ce1cbe27a85cfe40d84392eba6e6))
* **migrate:** switch to PRAGMA user_version-based scheduler ([6c09fc1](https://github.com/lastwhisper66/ai-studio/commit/6c09fc1c2562088807f7caef85da899133fcd67f))
* **model-catalog:** coalesce model groups by vendor ([25a5c8c](https://github.com/lastwhisper66/ai-studio/commit/25a5c8c303550bc5918e75d1f2908b28fb7d2dd8))
* **model-definitions:** drop unused provider_types field ([de849f0](https://github.com/lastwhisper66/ai-studio/commit/de849f04e22b05d4e06fba6a17dd9078833ac77b))
* **translate:** drop result/history banner headers, float buttons ([5fa86ef](https://github.com/lastwhisper66/ai-studio/commit/5fa86eff552ef625f108c6d8bab7dbaf89e1a2de))
* **types:** mark ModelDefinition.group as deprecated ([7992149](https://github.com/lastwhisper66/ai-studio/commit/79921499602cf37ddaf5423dcdf7c495f44a3878))
* **window:** simplify close-behavior dialog to two-button footer ([8bae1a5](https://github.com/lastwhisper66/ai-studio/commit/8bae1a5c4297260527637da44c2a9c286d5a62b3))

## [1.6.2](https://github.com/lastwhisper66/ai-studio/compare/v1.6.1...v1.6.2) (2026-05-16)


### Bug Fixes

* **tray:** tear down tray before closeDatabase() to fix quit-time crash ([bb685d9](https://github.com/lastwhisper66/ai-studio/commit/bb685d9eccc241bdbf7a481cda53158fdbb5f5c2))
* **tray:** tear down tray before closeDatabase() to fix quit-time crash ([ed073a5](https://github.com/lastwhisper66/ai-studio/commit/ed073a50b3e696a2918efa7335bf17a455dc4260))

## [1.6.1](https://github.com/lastwhisper66/ai-studio/compare/v1.6.0...v1.6.1) (2026-05-16)


### Bug Fixes

* **updater:** use releases.atom to avoid GitHub API rate limit, surface 403 reason ([67f13fe](https://github.com/lastwhisper66/ai-studio/commit/67f13fe91baadbc721c9b5f0c8326516542739f4))

## [1.6.0](https://github.com/lastwhisper66/ai-studio/compare/v1.5.0...v1.6.0) (2026-05-16)


### Features

* extend tray context menu with new-conversation and settings entries ([13491c2](https://github.com/lastwhisper66/ai-studio/commit/13491c2077039261d5badaf20c84c7a9d2d5635c))
* **main:** wire tray module and refresh hooks ([e690af2](https://github.com/lastwhisper66/ai-studio/commit/e690af274a611537f0b0ec936ca544bcd6972112))
* **tray:** extract tray module with extended context menu ([6c0b1e9](https://github.com/lastwhisper66/ai-studio/commit/6c0b1e9949235a04e465a5dd9413edb427eac5d7))


### Code Refactoring

* extract settings side effects into dedicated module ([b15f6e8](https://github.com/lastwhisper66/ai-studio/commit/b15f6e8d8e053478c1b09ed863f83fbd43d502e7))
* introduce settings-bus for main-process setting writes ([7866fd1](https://github.com/lastwhisper66/ai-studio/commit/7866fd117ade92f344020601c186bef51ad33f3a))

## [1.5.0](https://github.com/lastwhisper66/ai-studio/compare/v1.4.0...v1.5.0) (2026-05-15)

### Features

- trigger release for builtin updates feature ([a1a6c61](https://github.com/lastwhisper66/ai-studio/commit/a1a6c61ba2c6d793d324cab6d296e8567bd05ec8))

## [1.4.0](https://github.com/lastwhisper66/ai-studio/compare/v1.3.0...v1.4.0) (2026-05-10)

### Features

- **library:** Cherry Studio-style Assistant Library + restart prompt after backup restore ([8debe5a](https://github.com/lastwhisper66/ai-studio/commit/8debe5aae18cedf0ad040a70bbcdcc210ff5100e))

## [1.3.0](https://github.com/lastwhisper66/ai-studio/compare/v1.2.0...v1.3.0) (2026-05-09)

### Features

- **data:** split destructive cleanup into chats, settings and full reset ([d28f011](https://github.com/lastwhisper66/ai-studio/commit/d28f0114addc3911b7084101d1f3610bb5477122))
- **data:** split destructive cleanup into chats, settings and full reset ([d50819b](https://github.com/lastwhisper66/ai-studio/commit/d50819b370d348c08a8e3084a1f173b324f5658b))

## [1.2.0](https://github.com/lastwhisper66/ai-studio/compare/v1.1.0...v1.2.0) (2026-05-05)

### Features

- **backup:** add BACKUP_SET_REMOTE_ENABLED IPC channel ([41f1b7d](https://github.com/lastwhisper66/ai-studio/commit/41f1b7dac54620e38d60b834b13403d8021c5b5a))
- **backup:** add settings migration to per-remote keys ([f50e425](https://github.com/lastwhisper66/ai-studio/commit/f50e42520f4f3a3dcb6babfc198bbacc3f541de3))
- **backup:** allow per-remote passphrase encryption + add deleteSetting ([3c5795b](https://github.com/lastwhisper66/ai-studio/commit/3c5795be29afddf819a81972410c5e94450fc6e6))
- **backup:** codec supports plaintext (encryption.algo='none') mode ([de98db0](https://github.com/lastwhisper66/ai-studio/commit/de98db0fb28a731df7e1f3f7b171f27877e590f9))
- **backup:** decouple configured/enabled; add loadRemoteConfig + loadEnabledRemote ([317bd93](https://github.com/lastwhisper66/ai-studio/commit/317bd9380bbe16394689ccea3e699787b9974167))
- **backup:** default WebDAV subPath / S3 prefix to 'ai-studio' for new configs ([eab8a63](https://github.com/lastwhisper66/ai-studio/commit/eab8a634e755eeda490484408b16db872fff82b1))
- **backup:** introduce per-remote BackupStatus types ([f9660ac](https://github.com/lastwhisper66/ai-studio/commit/f9660ac59f573c95999391adbeb12e5b5c091691))
- **backup:** IPC + preload + store accept nullable password for plaintext ([484798c](https://github.com/lastwhisper66/ai-studio/commit/484798c7b520e607678ff7f82c228d02bcf025a4))
- **backup:** no-encryption checkbox in export password dialog ([4a60b0d](https://github.com/lastwhisper66/ai-studio/commit/4a60b0d98f5ca7ade29a00772531c39118074926))
- **backup:** per-remote independence + remove encryption ([fb1d768](https://github.com/lastwhisper66/ai-studio/commit/fb1d768af1827e405947930ff433b64683f9abd0))
- **backup:** per-remote independent sync with optional plaintext mode ([78e1b4b](https://github.com/lastwhisper66/ai-studio/commit/78e1b4b7025956f5db8f31934d1e7e305766b677))
- **backup:** per-remote IPC + setRemoteEnabled API ([141ba5e](https://github.com/lastwhisper66/ai-studio/commit/141ba5ea33d3eeeff7e4a39a390d37cf8ee92616))
- **backup:** plumbing for plaintext password=null + triggeredBy param ([8ae1e75](https://github.com/lastwhisper66/ai-studio/commit/8ae1e75bd5884f377b900e34d39960500ce3eb3c))
- **backup:** record + read triggeredBy via rollback sidecar JSON ([0e82736](https://github.com/lastwhisper66/ai-studio/commit/0e8273638910ebd181c961bda046b6fb4066cde1))
- **backup:** renderer store uses BackupStatus + per-remote actions ([2ff2763](https://github.com/lastwhisper66/ai-studio/commit/2ff276394fa79fff7eb1857320412e0c07e522f3))
- **backup:** rollback dialog shows triggeredBy ([2e21039](https://github.com/lastwhisper66/ai-studio/commit/2e21039ac1a939be3276f6e902a60c8fff217c74))
- **backup:** sync engine uses applyBackupBytes + nullable passphrase ([1822095](https://github.com/lastwhisper66/ai-studio/commit/182209547658e75bb47faf2d32fb773bdb18d8ab))
- **backup:** UI refactor for per-remote independence ([ee3c922](https://github.com/lastwhisper66/ai-studio/commit/ee3c92237b68ac8934e062b3f3f8418e8fd4dfde))
- **migrate:** central src/main/migrate/ + run on boot ([c167d9c](https://github.com/lastwhisper66/ai-studio/commit/c167d9c57e6a4b98bf4dfc6478a734bbd425a10b))

### Bug Fixes

- **backup:** re-broadcast BackupStatus when per-remote settings change ([168e158](https://github.com/lastwhisper66/ai-studio/commit/168e158a9027739249c7f417121f847ed3fc7095))
- **updater:** skip update checks in dev and unpackaged builds ([1258d0f](https://github.com/lastwhisper66/ai-studio/commit/1258d0f797b294ae611dad0a425ffb062e597c5e))

### Code Refactoring

- **backup:** drop BackupPasswordDialog and rewire consumers ([4ac3d75](https://github.com/lastwhisper66/ai-studio/commit/4ac3d7565f699eabe26b2dad922d78fed2a3d34f))
- **backup:** drop encrypted codec branch and crypto module ([6ea7422](https://github.com/lastwhisper66/ai-studio/commit/6ea7422758bf74d87acb08508ce4838826f382ab))
- **backup:** drop encryption fields from shared types/errors ([42c398a](https://github.com/lastwhisper66/ai-studio/commit/42c398a98c39f718276a309a3b243aa8e05835fb))
- **backup:** drop passphrase UI from per-remote panels ([2162f74](https://github.com/lastwhisper66/ai-studio/commit/2162f74fc983f963ec5b84679634ac4fddb2b3d7))
- **backup:** drop password from preload and renderer store ([4edf049](https://github.com/lastwhisper66/ai-studio/commit/4edf04953cca3ce1ad8d94cf50a4166d17fbaf09))
- **backup:** drop password params from main-process pipeline ([5aa6f9a](https://github.com/lastwhisper66/ai-studio/commit/5aa6f9af2124b4339bc664c33d5403dd37ea5dd7))
- **backup:** per-remote sync engine with independent state ([2711e41](https://github.com/lastwhisper66/ai-studio/commit/2711e41e519f7777d01e169e4161cfba66beb350))

## [1.1.0](https://github.com/lastwhisper66/ai-studio/compare/v1.0.5...v1.1.0) (2026-05-04)

### Features

- **backup:** add .aibackup file codec ([a4fa0d1](https://github.com/lastwhisper66/ai-studio/commit/a4fa0d120b0ad5cd211ba7bd1c6e78bbb0bd1a68))
- **backup:** add backup error codes and i18n strings ([32cee7e](https://github.com/lastwhisper66/ai-studio/commit/32cee7e13484b11a0c8b948bd5eb98cfe8f40bb5))
- **backup:** add backup IPC channel constants ([53c7e49](https://github.com/lastwhisper66/ai-studio/commit/53c7e4908a482c9500c2cdebf56f0804088b075d))
- **backup:** add backup shared types ([a880acc](https://github.com/lastwhisper66/ai-studio/commit/a880acccdb19b11d519a68c137d4850e4b9e1a40))
- **backup:** add PBKDF2 + AES-256-GCM crypto module ([33aa280](https://github.com/lastwhisper66/ai-studio/commit/33aa280b3dafd7e2ea05bcd1eb35e14a49f71a17))
- **backup:** allow webdav and s3 remotes to be used together ([a2461c4](https://github.com/lastwhisper66/ai-studio/commit/a2461c470e1aec4a2ccc5a62276f1fd5043fb285))
- **backup:** applySnapshot() with transaction + atomic avatars swap ([db5eccd](https://github.com/lastwhisper66/ai-studio/commit/db5eccddbafcee2fd3291736182f37b3f48857c9))
- **backup:** BackupRemote interface ([5c53581](https://github.com/lastwhisper66/ai-studio/commit/5c53581d3b3b70e8ba7c6d40d9f386858cda7e38))
- **backup:** BackupSyncService with manifest + LWW + retention ([a984c7d](https://github.com/lastwhisper66/ai-studio/commit/a984c7d39f6a2b24e426811c6eabd83e8f898a15))
- **backup:** browse and restore from local rollback copies ([13805dc](https://github.com/lastwhisper66/ai-studio/commit/13805dcfdb6bc0ac81ef0920a63b1eb836e4c6bf))
- **backup:** clarify sync passphrase wording for cross-device recovery ([65e39d1](https://github.com/lastwhisper66/ai-studio/commit/65e39d1fc6c0b5b1d02a2faad572711252d94473))
- **backup:** cloud remote configuration UI + WebDAV/S3 wiring ([3be862d](https://github.com/lastwhisper66/ai-studio/commit/3be862da592ecb19afa1cda4287f21190e7265ba))
- **backup:** cloud sync UI — sync now, intervals, history dialog ([4ff163b](https://github.com/lastwhisper66/ai-studio/commit/4ff163bc53df91c907967b12e9c6f1c4db20bc9c))
- **backup:** collectSnapshot() reads all config tables ([0ef1615](https://github.com/lastwhisper66/ai-studio/commit/0ef1615fff9fec08440c3f54f36b41e2484350b0))
- **backup:** dirty-tracker for lastLocalChangeAt ([493e983](https://github.com/lastwhisper66/ai-studio/commit/493e983db5ad20f872f77bf559584a1894f6199f))
- **backup:** export/import facade ([f3bde7b](https://github.com/lastwhisper66/ai-studio/commit/f3bde7b3e7681b88678b0e119bd994edab460557))
- **backup:** expose window.api.backup.\* surface ([dd7f671](https://github.com/lastwhisper66/ai-studio/commit/dd7f671997783f05cd3b6abb7ca091e8f4c8c215))
- **backup:** in-flight progress indicator + i18n polish ([1019c7d](https://github.com/lastwhisper66/ai-studio/commit/1019c7da04e02eb7305dc42d97e59393a4e90ca3))
- **backup:** local export/import end-to-end UI ([3829a3c](https://github.com/lastwhisper66/ai-studio/commit/3829a3c5fede8475de7af674cc193f39a09bcdfa))
- **backup:** password input dialog ([3ce612c](https://github.com/lastwhisper66/ai-studio/commit/3ce612cd182fd1d0fed7c00d9ffee2ce32e22185))
- **backup:** register local export/import IPC handlers ([5dd47ab](https://github.com/lastwhisper66/ai-studio/commit/5dd47ab97579d035763c9068ce77f6440646535d))
- **backup:** renderer backup store ([eb9af6f](https://github.com/lastwhisper66/ai-studio/commit/eb9af6f9618d4c7030d68dec24fece08a67f310f))
- **backup:** replace WebDAV PROPFIND regex parser with fast-xml-parser ([bd8957d](https://github.com/lastwhisper66/ai-studio/commit/bd8957d703ffb4c9ffb3f9af97d95234a33003e5))
- **backup:** S3-compatible remote via @aws-sdk/client-s3 ([2f93075](https://github.com/lastwhisper66/ai-studio/commit/2f93075eb18030d045c255544bce7f2e186317d5))
- **backup:** sync IPC handlers (sync-now/cancel/list-remote/restore-from-remote) ([ffc1107](https://github.com/lastwhisper66/ai-studio/commit/ffc11077aa2e025fa2f65d1e6af7f4008dce4378))
- **backup:** WebDAV remote implementation ([a6c3d1f](https://github.com/lastwhisper66/ai-studio/commit/a6c3d1fe969f6d60061a7bb78f41db9b9d31a43d))
- data backup and cloud sync ([fc99c61](https://github.com/lastwhisper66/ai-studio/commit/fc99c614e9b7e86d65cbb7c84bbdd43bc964d0d4))

### Bug Fixes

- **backup:** harden crypto, restore atomicity, and sync correctness ([fffed77](https://github.com/lastwhisper66/ai-studio/commit/fffed777a8be6a196a4c3550dc58f63c3f69d858))
- **backup:** repair cloud overview UI and add boot-time catch-up sync ([d61fca0](https://github.com/lastwhisper66/ai-studio/commit/d61fca05a196a505ffdd21e9a770eb702164130d))
- **backup:** stub get-status / get-remote-config to silence boot errors ([7b1585c](https://github.com/lastwhisper66/ai-studio/commit/7b1585ce46623191d64cbc741ca34f39ba0630ff))
- **backup:** unstick post-sync UI and persist passphrase value ([06150e8](https://github.com/lastwhisper66/ai-studio/commit/06150e8a68c494437109a840114a8710bb10b3bb))
- **backup:** unstick post-sync UI and persist passphrase value ([c334ee9](https://github.com/lastwhisper66/ai-studio/commit/c334ee9c40385c71b1103b2ec7bd623bfd7bfa84))
- **backup:** WebDAV MKCOL the configured subPath, not just file's parent ([577f655](https://github.com/lastwhisper66/ai-studio/commit/577f655119ef773721ce828fdc939a96ed646077))

## [1.0.5](https://github.com/lastwhisper66/ai-studio/compare/v1.0.4...v1.0.5) (2026-05-02)

### Bug Fixes

- prevent update checks from getting stuck ([9486f36](https://github.com/lastwhisper66/ai-studio/commit/9486f3626b1f6cdfb5f446a5e2333de402e30826))

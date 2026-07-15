# R2 Sync

[English](#english) | [中文](#中文)

---

<a name="english"></a>

## English

An Obsidian plugin for multi-device synchronization using Cloudflare R2.

### Features

- 📤 **Upload Files** - Upload local Markdown files to R2 bucket
- 📥 **Download Files** - Download files from R2 bucket to local
- 🔄 **Bidirectional Sync** - Automatically detect local and remote differences for two-way sync, now with mtime-based change detection
- 🗑️ **Delete Sync** - Track file deletions and sync them across devices
- 🔍 **Sync Analysis** - Analyze differences between local and remote files before syncing, with selective upload/download/delete
- ⏰ **Auto Sync** - Support for setting automatic sync intervals with mutex protection to prevent concurrent syncs
- 💾 **Sync on Save** - Automatically sync when file is saved (with loop prevention)
- 📁 **Folder Sync** - Option to sync specific folders or the entire vault
- 🖼️ **Image Sync** - Support for syncing image files (png, jpg, gif, webp, svg, etc.)
- 🌐 **Multi-language** - Support for English and Chinese interface
- 📊 **Sync Strategies** - Multiple sync strategies to choose from, with correct conflict resolution for local-first and remote-first
- 📄 **Right-click Upload** - Upload individual files via the file explorer context menu
- ⌨️ **Upload Current File** - Command palette command to quickly upload the active file
- 📦 **Pagination Support** - Handles buckets with more than 1000 files

### Installation

#### Manual Installation

1. Download the latest version from [Releases](https://github.com/sandrone-muou/obsidian-r2-sync/releases)
2. Extract to `.obsidian/plugins/r2-sync/` directory
3. Enable the plugin in Obsidian Settings

### Configuration

#### 1. Get Cloudflare R2 Credentials

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to R2 Object Storage
3. Create a bucket or use an existing one
4. Create an API token in "Manage R2 API Tokens"
5. Note the following information:
   - Access Key ID
   - Secret Access Key
   - Bucket Name
   - API Endpoint (format: `https://<account_id>.r2.cloudflarestorage.com`)

#### 2. Configure Plugin

1. Open Obsidian Settings → R2 Sync Settings
2. Fill in the following:
   - **Language**: Interface language (English/Chinese)
   - **Bucket Name**: R2 bucket name
   - **API Endpoint**: `https://<account_id>.r2.cloudflarestorage.com`
   - **Access Key ID**: API access key ID
   - **Secret Access Key**: API secret access key
   - **Sync Folder** (optional): Leave empty to sync entire vault
   - **Auto Sync**: Enable/disable automatic sync
   - **Sync Interval**: Auto sync interval (minutes)
   - **Sync on Save**: Automatically sync when file is saved
   - **Sync Strategy**: Choose sync behavior (see below)
   - **Sync Images**: Also sync image files

### Sync Strategies

| Strategy | Description |
|----------|-------------|
| **Bidirectional** | Sync both ways, track deletions (default) |
| **Upload only** | Only upload local files to R2 |
| **Download only** | Only download R2 files to local |
| **Local first** | Local files take priority on conflict |
| **Remote first** | Remote files take priority on conflict |

### Usage

#### Test Connection

Click "Test Connection" button to verify configuration.

#### Manual Sync

- **Upload All Files**: Upload all local files to R2
- **Download All Files**: Download all files from R2 to local
- **Bidirectional Sync**: Smart sync, only upload/download files with differences
- **Analyze**: View differences between local and remote files

#### Command Palette

Use `Ctrl+P` to open command palette, available commands:
- `Upload all files to R2`
- `Download all files from R2`
- `Bidirectional sync`
- `Analyze sync differences`
- `Upload current file to R2`

#### Ribbon Icon

Click the cloud icon in the left ribbon for quick bidirectional sync.

### Supported File Types

- Markdown files (`.md`)
- Image files (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico`) - requires "Sync Images" option

### Notes

1. Backup your notes before first use
2. File deletions are tracked and synced across devices
3. Keep your API keys secure and do not share them
4. Image sync needs to be enabled in settings

### License

MIT License

---

<a name="中文"></a>

## 中文

通过 Cloudflare R2 实现 Obsidian 多端同步的插件。

### 功能特性

- 📤 **上传文件** - 将本地 Markdown 文件上传到 R2 存储桶
- 📥 **下载文件** - 从 R2 存储桶下载文件到本地
- 🔄 **双向同步** - 自动检测本地和远程差异进行双向同步，支持基于修改时间的变更检测
- 🗑️ **删除同步** - 跟踪文件删除并在设备间同步删除操作
- 🔍 **同步分析** - 在同步前分析本地和远程文件的差异，支持选择性上传/下载/删除
- ⏰ **自动同步** - 支持设置自动同步间隔，带互斥锁防止并发同步
- 💾 **保存时同步** - 文件保存时自动同步（带循环触发防护）
- 📁 **文件夹同步** - 可选择同步特定文件夹或整个仓库
- 🖼️ **图片同步** - 支持同步图片文件（png、jpg、gif、webp、svg 等）
- 🌐 **多语言** - 支持中英文界面
- 📊 **同步策略** - 多种同步策略可选，本地优先/远程优先策略正确处理冲突
- 📄 **右键上传** - 通过文件管理器右键菜单上传单个文件
- ⌨️ **上传当前文件** - 命令面板命令快速上传当前活动文件
- 📦 **分页支持** - 支持存储桶中超过 1000 个文件的场景

### 安装

#### 手动安装

1. 从 [Releases](https://github.com/sandrone-muou/obsidian-r2-sync/releases) 下载最新版本
2. 解压到 `.obsidian/plugins/r2-sync/` 目录
3. 在 Obsidian 设置中启用插件

### 配置

#### 1. 获取 Cloudflare R2 凭证

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 R2 对象存储
3. 创建存储桶或使用现有存储桶
4. 在「管理 R2 API 令牌」中创建 API 令牌
5. 记录以下信息：
   - Access Key ID
   - Secret Access Key
   - 存储桶名称
   - API 端点（格式：`https://<account_id>.r2.cloudflarestorage.com`）

#### 2. 配置插件

1. 打开 Obsidian 设置 → R2 同步设置
2. 填写以下信息：
   - **语言**：界面语言（英文/中文）
   - **存储桶名称**：R2 存储桶名称
   - **API 端点**：`https://<account_id>.r2.cloudflarestorage.com`
   - **Access Key ID**：API 访问密钥 ID
   - **Secret Access Key**：API 访问密钥
   - **同步文件夹**（可选）：留空则同步整个仓库
   - **自动同步**：是否启用自动同步
   - **同步间隔**：自动同步间隔（分钟）
   - **保存时同步**：文件保存时自动同步
   - **同步策略**：选择同步行为（见下文）
   - **同步图片**：同时同步图片文件

### 同步策略

| 策略 | 说明 |
|------|------|
| **双向同步** | 双向同步，跟踪删除操作（默认） |
| **仅上传** | 仅上传本地文件到 R2 |
| **仅下载** | 仅下载 R2 文件到本地 |
| **本地优先** | 冲突时本地文件优先 |
| **远程优先** | 冲突时远程文件优先 |

### 使用方法

#### 测试连接

点击「测试连接」按钮验证配置是否正确。

#### 手动同步

- **上传所有文件**：将本地所有文件上传到 R2
- **下载所有文件**：从 R2 下载所有文件到本地
- **双向同步**：智能同步，只上传/下载有差异的文件
- **分析**：查看本地和远程文件的差异

#### 命令面板

使用 `Ctrl+P` 打开命令面板，可使用以下命令：
- `上传所有文件到 R2`
- `从 R2 下载所有文件`
- `双向同步`
- `分析同步差异`
- `上传当前文件到 R2`

#### 功能区图标

点击左侧功能区云图标可快速执行双向同步。

### 支持的文件类型

- Markdown 文件（`.md`）
- 图片文件（`.png`、`.jpg`、`.jpeg`、`.gif`、`.webp`、`.svg`、`.bmp`、`.ico`）- 需开启「同步图片」选项

### 注意事项

1. 首次使用建议先备份笔记
2. 文件删除会被跟踪并在设备间同步
3. 请妥善保管 API 密钥，不要泄露
4. 图片同步需要在设置中启用

### 许可证

MIT License

---

## Changelog

### v1.3.0

#### New Features
- **Upload Current File**: New command palette command to quickly upload the active file
- **Right-click Upload**: Upload individual files via the file explorer context menu
- **Sync Analysis with Actions**: Enhanced analysis modal with selectable files and batch upload/download/delete actions
- **Pagination Support**: `listR2Files()` now handles buckets with more than 1000 files via S3 pagination

#### Bug Fixes
- **Sync Mutex**: Added `isSyncing` flag to prevent concurrent sync operations (auto sync, manual sync, save-on-sync could previously run simultaneously)
- **Save-on-Save Loop Fix**: Fixed infinite sync loop where downloading a file would trigger `modify` event → `syncFile()` → re-upload. Now tracks recently-downloaded files and skips them for 5 seconds
- **Bidirectional Sync Change Detection**: Files that exist on both sides are now checked via `mtime`. Local modifications are properly uploaded to R2 instead of being silently ignored
- **Sync Mark Logic**: Files are no longer added to `syncedFiles` if their upload/download failed
- **Conflict Strategy Fix**: `local-first` now correctly uploads all local files (overwriting remote), and `remote-first` correctly downloads all remote files (overwriting local)
- **Analyze Diff "Deleted" Category**: Fixed incorrect logic where "deleted" files were actually "remote-only". Now properly separates newly-added remote files from previously-synced then-deleted files

#### Improvements
- Migrated `syncedFileMtimes` tracking for more accurate change detection
- Improved folder boundary checks in `isSyncableFile()` and `syncFile()`
- Code now fully synchronized between `src/main.ts` source and `main.js` build output
- Passes ESLint with zero errors and zero warnings

### v1.2.0

#### New Features
- **Sync Analysis**: Analyze differences between local and remote files before syncing
  - View files that exist only locally (need upload)
  - View files that exist only remotely (need download)
  - View deleted files that will be removed from remote
  - View files that exist on both sides (already synced)
  - Summary with file counts and sync actions needed

#### Improvements
- Added "Analyze" button in settings for quick access
- Added "Analyze sync differences" command to command palette
- New modal dialog for displaying analysis results with color-coded categories

### v1.1.0

#### New Features
- **Delete Sync**: Track file deletions and sync them across devices
- **Sync on Save**: Automatically sync when file is saved
- **Sync Images**: Support for syncing image files (png, jpg, gif, webp, svg, bmp, ico)
- **Sync Strategies**: Added 5 sync strategies (Bidirectional, Upload only, Download only, Local first, Remote first)
- **Sync Progress**: Visual feedback during sync operations
- **Language Setting**: Added language setting to switch between English and Chinese

#### Improvements
- Improved error handling and error messages
- Better UI with sentence case
- Code quality improvements with ESLint

### v1.0.0

- Initial release
- Basic upload, download, and bidirectional sync
- Auto sync with configurable interval
- Folder sync support
- Connection test

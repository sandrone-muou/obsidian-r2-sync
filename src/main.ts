import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder, requestUrl, Modal } from 'obsidian';

type Language = 'en' | 'zh';
type SyncStrategy = 'bidirectional' | 'upload-only' | 'download-only' | 'local-first' | 'remote-first';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];

interface R2SyncSettings {
    bucketName: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    syncFolder: string;
    autoSync: boolean;
    syncInterval: number;
    language: Language;
    syncedFiles: string[];
    syncOnSave: boolean;
    syncStrategy: SyncStrategy;
    syncImages: boolean;
    syncedFileMtimes: Record<string, number>;
}

const DEFAULT_SETTINGS: R2SyncSettings = {
    bucketName: '',
    endpoint: '',
    accessKeyId: '',
    secretAccessKey: '',
    syncFolder: '',
    autoSync: false,
    syncInterval: 5,
    language: 'en',
    syncedFiles: [],
    syncOnSave: false,
    syncStrategy: 'bidirectional',
    syncImages: false,
    syncedFileMtimes: {}
}

const en = {
    ribbonTitle: 'R2 sync',
    cmdUpload: 'Upload all files to R2',
    cmdDownload: 'Download all files from R2',
    cmdSync: 'Bidirectional sync',
    cmdAnalyze: 'Analyze sync differences',
    cmdUploadCurrent: 'Upload current file to R2',
    cmdUploadSelected: 'Upload selected file to R2',
    configFirst: 'Please configure R2 storage settings first',
    syncFolderNotExist: 'Sync folder does not exist',
    connSuccess: (count: number) => `Connection successful! ${count} .md files in bucket`,
    connFailed: (msg: string) => `Connection failed: ${msg}`,
    uploading: 'Uploading files to R2...',
    uploadingFile: (name: string) => `Uploading ${name}...`,
    downloading: 'Downloading files from R2...',
    syncing: 'Syncing files...',
    analyzing: 'Analyzing file differences...',
    syncInProgress: 'Sync already in progress',
    uploadComplete: (ok: number, fail: number) => `Upload complete: ${ok} succeeded, ${fail} failed`,
    uploadFileSuccess: (name: string) => `Successfully uploaded: ${name}`,
    uploadFileFailed: (name: string, msg: string) => `Failed to upload ${name}: ${msg}`,
    downloadComplete: (ok: number, fail: number) => `Download complete: ${ok} succeeded, ${fail} failed`,
    syncComplete: (up: number, down: number, del: number, fail: number) => `Sync complete: ${up} uploaded, ${down} downloaded, ${del} deleted, ${fail} failed`,
    syncFailed: (msg: string) => `Sync failed: ${msg}`,
    downloadFailed: (msg: string) => `Download failed: ${msg}`,
    uploadFailed: (msg: string) => `Upload failed: ${msg}`,
    listFailed: (msg: string) => `List files failed: ${msg}`,
    deleteFailed: (msg: string) => `Delete failed: ${msg}`,
    noActiveFile: 'No active file to upload',
    fileNotInSyncFolder: 'File is not in sync folder',
    errorDetails: 'Error details',
    moreErrors: (count: number) => `...and ${count} more errors`,
    analyzeTitle: 'Sync Analysis',
    analyzeLocalOnly: 'Local only (need upload)',
    analyzeRemoteOnly: 'Remote only (need download)',
    analyzeBoth: 'Both sides (synced)',
    analyzeDeleted: 'Deleted (will be removed)',
    analyzeNoDiff: 'No differences found. All files are in sync.',
    analyzeSummary: (local: number, remote: number, upload: number, download: number, deleted: number) =>
        `Local: ${local} files | Remote: ${remote} files | To upload: ${upload} | To download: ${download} | To delete: ${deleted}`,
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    uploadSelected: 'Upload selected',
    downloadSelected: 'Download selected',
    deleteSelected: 'Delete selected',
    noSelection: 'Please select at least one file',
    uploadSuccess: (count: number) => `Successfully uploaded ${count} file(s)`,
    downloadSuccess: (count: number) => `Successfully downloaded ${count} file(s)`,
    deleteSuccess: (count: number) => `Successfully deleted ${count} file(s)`,
    operationFailed: (msg: string) => `Operation failed: ${msg}`,
    close: 'Close',
    settingsTitle: 'R2 sync',
    bucketName: 'Bucket name',
    bucketNameDesc: 'Cloudflare R2 bucket name',
    apiEndpoint: 'API endpoint',
    apiEndpointDesc: 'Format: https://<account_id>.r2.cloudflarestorage.com',
    accessKeyId: 'Access key ID',
    accessKeyIdDesc: 'R2 API access key ID',
    secretKey: 'Secret access key',
    secretKeyDesc: 'R2 API secret access key',
    syncFolder: 'Sync folder',
    syncFolderDesc: 'Leave empty to sync entire vault',
    autoSync: 'Auto sync',
    autoSyncDesc: 'Enable automatic sync',
    syncInterval: 'Sync interval',
    syncIntervalDesc: 'Auto sync interval in minutes',
    syncOnSave: 'Sync on save',
    syncOnSaveDesc: 'Automatically sync when file is saved',
    syncStrategy: 'Sync strategy',
    syncStrategyDesc: 'Choose how to handle sync conflicts',
    strategyBidirectional: 'Bidirectional',
    strategyBidirectionalDesc: 'Sync both ways, track deletions',
    strategyUploadOnly: 'Upload only',
    strategyUploadOnlyDesc: 'Only upload local files to R2',
    strategyDownloadOnly: 'Download only',
    strategyDownloadOnlyDesc: 'Only download R2 files to local',
    strategyLocalFirst: 'Local first',
    strategyLocalFirstDesc: 'Local files take priority on conflict',
    strategyRemoteFirst: 'Remote first',
    strategyRemoteFirstDesc: 'Remote files take priority on conflict',
    syncImages: 'Sync images',
    syncImagesDesc: 'Also sync image files (png, jpg, gif, webp, svg, etc.)',
    testConn: 'Test connection',
    testConnDesc: 'Test R2 connection',
    testConnBtn: 'Test connection',
    manualSync: 'Manual sync',
    manualSyncDesc: 'Manually trigger sync operations',
    uploadAllBtn: 'Upload all',
    downloadAllBtn: 'Download all',
    syncBtn: 'Sync',
    analyzeBtn: 'Analyze',
    language: 'Language',
    languageDesc: 'Interface language',
    languageEn: 'English',
    languageZh: 'Chinese'
};

const zh = {
    ribbonTitle: 'R2 同步',
    cmdUpload: '上传所有文件到 R2',
    cmdDownload: '从 R2 下载所有文件',
    cmdSync: '双向同步',
    cmdAnalyze: '分析同步差异',
    cmdUploadCurrent: '上传当前文件到 R2',
    cmdUploadSelected: '上传选中文件到 R2',
    configFirst: '请先配置 R2 存储信息',
    syncFolderNotExist: '同步文件夹不存在',
    connSuccess: (count: number) => `连接成功！存储桶中有 ${count} 个 .md 文件`,
    connFailed: (msg: string) => `连接失败: ${msg}`,
    uploading: '正在上传文件到 R2...',
    uploadingFile: (name: string) => `正在上传 ${name}...`,
    downloading: '正在从 R2 下载文件...',
    syncing: '正在同步文件...',
    analyzing: '正在分析文件差异...',
    syncInProgress: '同步正在进行中',
    uploadComplete: (ok: number, fail: number) => `上传完成: ${ok} 个成功, ${fail} 个失败`,
    uploadFileSuccess: (name: string) => `上传成功: ${name}`,
    uploadFileFailed: (name: string, msg: string) => `上传失败 ${name}: ${msg}`,
    downloadComplete: (ok: number, fail: number) => `下载完成: ${ok} 个成功, ${fail} 个失败`,
    syncComplete: (up: number, down: number, del: number, fail: number) => `同步完成: 上传 ${up} 个, 下载 ${down} 个, 删除 ${del} 个, ${fail} 个失败`,
    syncFailed: (msg: string) => `同步失败: ${msg}`,
    downloadFailed: (msg: string) => `下载失败: ${msg}`,
    uploadFailed: (msg: string) => `上传失败: ${msg}`,
    listFailed: (msg: string) => `列出文件失败: ${msg}`,
    deleteFailed: (msg: string) => `删除失败: ${msg}`,
    noActiveFile: '没有活动文件可上传',
    fileNotInSyncFolder: '文件不在同步文件夹中',
    errorDetails: '错误详情',
    moreErrors: (count: number) => `...还有 ${count} 个错误`,
    analyzeTitle: '同步分析',
    analyzeLocalOnly: '仅本地（需上传）',
    analyzeRemoteOnly: '仅远程（需下载）',
    analyzeBoth: '双方都有（已同步）',
    analyzeDeleted: '已删除（将被移除）',
    analyzeNoDiff: '未发现差异，所有文件已同步。',
    analyzeSummary: (local: number, remote: number, upload: number, download: number, deleted: number) =>
        `本地: ${local} 个文件 | 远程: ${remote} 个文件 | 待上传: ${upload} | 待下载: ${download} | 待删除: ${deleted}`,
    selectAll: '全选',
    deselectAll: '取消全选',
    uploadSelected: '上传选中',
    downloadSelected: '下载选中',
    deleteSelected: '删除选中',
    noSelection: '请至少选择一个文件',
    uploadSuccess: (count: number) => `成功上传 ${count} 个文件`,
    downloadSuccess: (count: number) => `成功下载 ${count} 个文件`,
    deleteSuccess: (count: number) => `成功删除 ${count} 个文件`,
    operationFailed: (msg: string) => `操作失败: ${msg}`,
    close: '关闭',
    settingsTitle: 'R2 同步',
    bucketName: '存储桶名称',
    bucketNameDesc: 'Cloudflare R2 存储桶名称',
    apiEndpoint: 'API 端点',
    apiEndpointDesc: '格式: https://<account_id>.r2.cloudflarestorage.com',
    accessKeyId: '访问密钥 ID',
    accessKeyIdDesc: 'R2 API 访问密钥 ID',
    secretKey: '访问密钥',
    secretKeyDesc: 'R2 API 访问密钥',
    syncFolder: '同步文件夹',
    syncFolderDesc: '留空则同步整个仓库',
    autoSync: '自动同步',
    autoSyncDesc: '启用自动同步',
    syncInterval: '同步间隔',
    syncIntervalDesc: '自动同步间隔（分钟）',
    syncOnSave: '保存时同步',
    syncOnSaveDesc: '文件保存时自动同步',
    syncStrategy: '同步策略',
    syncStrategyDesc: '选择如何处理同步冲突',
    strategyBidirectional: '双向同步',
    strategyBidirectionalDesc: '双向同步，跟踪删除操作',
    strategyUploadOnly: '仅上传',
    strategyUploadOnlyDesc: '仅上传本地文件到 R2',
    strategyDownloadOnly: '仅下载',
    strategyDownloadOnlyDesc: '仅下载 R2 文件到本地',
    strategyLocalFirst: '本地优先',
    strategyLocalFirstDesc: '冲突时本地文件优先',
    strategyRemoteFirst: '远程优先',
    strategyRemoteFirstDesc: '冲突时远程文件优先',
    syncImages: '同步图片',
    syncImagesDesc: '同时同步图片文件（png、jpg、gif、webp、svg 等）',
    testConn: '测试连接',
    testConnDesc: '测试 R2 连接',
    testConnBtn: '测试连接',
    manualSync: '手动同步',
    manualSyncDesc: '手动触发同步操作',
    uploadAllBtn: '上传全部',
    downloadAllBtn: '下载全部',
    syncBtn: '同步',
    analyzeBtn: '分析',
    language: '语言',
    languageDesc: '界面语言',
    languageEn: '英文',
    languageZh: '中文'
};

const translations = { en, zh };

function t(lang: Language) {
    return translations[lang];
}

export default class R2SyncPlugin extends Plugin {
    settings: R2SyncSettings;
    syncIntervalId: number | null = null;
    private isSyncing = false;
    private recentlyDownloaded = new Set<string>();
    private downloadClearTimeout: number | null = null;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new R2SyncSettingTab(this.app, this));
        this.addCommands();

        // Register file menu for right-click upload
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                if (file instanceof TFile && this.isSyncableFile(file)) {
                    const i18n = t(this.settings.language);
                    menu.addItem((item) => {
                        item.setTitle(i18n.cmdUploadSelected)
                            .setIcon('upload-cloud')
                            .onClick(() => {
                                void this.uploadSingleFile(file);
                            });
                    });
                }
            })
        );

        if (this.settings.autoSync) {
            this.startAutoSync();
        }

        this.addRibbonIcon('cloud', t(this.settings.language).ribbonTitle, () => {
            void this.sync();
        });

        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file instanceof TFile && this.settings.syncOnSave && this.shouldSyncFile(file)) {
                    const relativePath = this.getRelativePath(file.path);
                    if (this.recentlyDownloaded.has(relativePath)) {
                        return;
                    }
                    void this.syncFile(file);
                }
            })
        );
    }

    onunload() {
        this.stopAutoSync();
        if (this.downloadClearTimeout) {
            window.clearTimeout(this.downloadClearTimeout);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<R2SyncSettings>);
        // Backward compatibility: ensure syncedFileMtimes exists
        if (!this.settings.syncedFileMtimes) {
            this.settings.syncedFileMtimes = {};
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    addCommands() {
        const i18n = t(this.settings.language);
        this.addCommand({
            id: 'upload',
            name: i18n.cmdUpload,
            callback: () => {
                void this.uploadAll();
            }
        });

        this.addCommand({
            id: 'download',
            name: i18n.cmdDownload,
            callback: () => {
                void this.downloadAll();
            }
        });

        this.addCommand({
            id: 'sync',
            name: i18n.cmdSync,
            callback: () => {
                void this.sync();
            }
        });

        this.addCommand({
            id: 'analyze',
            name: i18n.cmdAnalyze,
            callback: () => {
                void this.analyzeDiff();
            }
        });

        this.addCommand({
            id: 'upload-current-file',
            name: i18n.cmdUploadCurrent,
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    if (!checking) {
                        void this.uploadSingleFile(file);
                    }
                    return true;
                }
                return false;
            }
        });
    }

    startAutoSync() {
        this.stopAutoSync();
        const intervalMs = this.settings.syncInterval * 60 * 1000;
        this.syncIntervalId = window.setInterval(() => {
            void this.sync();
        }, intervalMs);
    }

    stopAutoSync() {
        if (this.syncIntervalId) {
            window.clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
        }
    }

    isConfigured(): boolean {
        return !!(this.settings.bucketName && this.settings.endpoint &&
                  this.settings.accessKeyId && this.settings.secretAccessKey);
    }

    cleanEndpoint(): string {
        let endpoint = this.settings.endpoint || '';
        endpoint = endpoint.trim();
        endpoint = endpoint.replace(/[\r\n\t]/g, '');
        endpoint = endpoint.replace(/\/+$/, '');
        return endpoint;
    }

    getEndpointHost(): string {
        let host = this.cleanEndpoint();
        host = host.replace(/^https?:\/\//, '');
        host = host.replace(/\/.*$/, '');
        return host;
    }

    getBaseUrl(): string {
        let url = this.cleanEndpoint();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        return url;
    }

    async testConnection(): Promise<void> {
        const i18n = t(this.settings.language);
        if (!this.isConfigured()) {
            new Notice(i18n.configFirst);
            return;
        }

        try {
            const files = await this.listR2Files();
            new Notice(i18n.connSuccess(files.length), 5000);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            new Notice(i18n.connFailed(errorMsg), 10000);
        }
    }

    async uploadAll() {
        const i18n = t(this.settings.language);

        if (this.isSyncing) {
            new Notice(i18n.syncInProgress);
            return;
        }

        if (!this.isConfigured()) {
            new Notice(i18n.configFirst);
            return;
        }

        const folder = this.getSyncFolder();
        if (!folder) {
            new Notice(i18n.syncFolderNotExist);
            return;
        }

        this.isSyncing = true;
        const syncingNotice = new Notice(i18n.uploading, 0);

        try {
            const files = this.getAllSyncFiles(folder);
            let uploaded = 0;
            const errors: string[] = [];

            for (const file of files) {
                try {
                    const relativePath = this.getRelativePath(file.path);
                    await this.uploadFileToR2(file, relativePath);
                    uploaded++;
                    this.markFileSynced(file, relativePath);
                } catch (e) {
                    const errorMsg = e instanceof Error ? e.message : String(e);
                    errors.push(`${file.path}: ${errorMsg}`);
                }
            }

            await this.saveSettings();

            const failed = errors.length;
            let message = i18n.uploadComplete(uploaded, failed);
            if (errors.length > 0) {
                message += `\n\n${i18n.errorDetails}:\n${errors.slice(0, 5).join('\n')}`;
                if (errors.length > 5) {
                    message += `\n${i18n.moreErrors(errors.length - 5)}`;
                }
            }
            new Notice(message, 10000);
        } finally {
            syncingNotice.hide();
            this.isSyncing = false;
        }
    }

    async downloadAll() {
        const i18n = t(this.settings.language);

        if (this.isSyncing) {
            new Notice(i18n.syncInProgress);
            return;
        }

        if (!this.isConfigured()) {
            new Notice(i18n.configFirst);
            return;
        }

        this.isSyncing = true;
        const syncingNotice = new Notice(i18n.downloading, 0);

        try {
            const files = await this.listR2Files();
            let downloaded = 0;
            const errors: string[] = [];

            for (const key of files) {
                try {
                    await this.downloadFileFromR2(key);
                    downloaded++;
                } catch (e) {
                    const errorMsg = e instanceof Error ? e.message : String(e);
                    errors.push(`${key}: ${errorMsg}`);
                }
            }

            await this.saveSettings();

            const failed = errors.length;
            let message = i18n.downloadComplete(downloaded, failed);
            if (errors.length > 0) {
                message += `\n\n${i18n.errorDetails}:\n${errors.slice(0, 5).join('\n')}`;
                if (errors.length > 5) {
                    message += `\n${i18n.moreErrors(errors.length - 5)}`;
                }
            }
            new Notice(message, 10000);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            new Notice(i18n.downloadFailed(errorMsg), 10000);
        } finally {
            syncingNotice.hide();
            this.isSyncing = false;
        }
    }

    async sync() {
        const i18n = t(this.settings.language);

        if (this.isSyncing) {
            new Notice(i18n.syncInProgress);
            return;
        }

        if (!this.isConfigured()) {
            new Notice(i18n.configFirst);
            return;
        }

        this.isSyncing = true;
        const syncingNotice = new Notice(i18n.syncing, 0);

        try {
            const folder = this.getSyncFolder();
            if (!folder) {
                syncingNotice.hide();
                new Notice(i18n.syncFolderNotExist);
                return;
            }

            const localFiles = this.getAllSyncFiles(folder);
            const remoteFiles = await this.listR2Files();

            const localPaths = new Set(localFiles.map(f => this.getRelativePath(f.path)));
            const remotePaths = new Set(remoteFiles);
            const previouslySynced = new Set(this.settings.syncedFiles);

            let uploaded = 0;
            let downloaded = 0;
            let deleted = 0;
            const errors: string[] = [];
            const newSyncedFiles: string[] = [];

            switch (this.settings.syncStrategy) {
                case 'upload-only':
                    for (const file of localFiles) {
                        const relativePath = this.getRelativePath(file.path);
                        try {
                            await this.uploadFileToR2(file, relativePath);
                            uploaded++;
                            newSyncedFiles.push(relativePath);
                            this.markFileSynced(file, relativePath);
                        } catch (e) {
                            const errorMsg = e instanceof Error ? e.message : String(e);
                            errors.push(`Upload ${relativePath}: ${errorMsg}`);
                        }
                    }
                    break;

                case 'download-only':
                    for (const key of remoteFiles) {
                        try {
                            await this.downloadFileFromR2(key);
                            downloaded++;
                            newSyncedFiles.push(key);
                        } catch (e) {
                            const errorMsg = e instanceof Error ? e.message : String(e);
                            errors.push(`Download ${key}: ${errorMsg}`);
                        }
                    }
                    break;

                case 'local-first':
                    for (const file of localFiles) {
                        const relativePath = this.getRelativePath(file.path);
                        try {
                            await this.uploadFileToR2(file, relativePath);
                            uploaded++;
                            newSyncedFiles.push(relativePath);
                            this.markFileSynced(file, relativePath);
                        } catch (e) {
                            const errorMsg = e instanceof Error ? e.message : String(e);
                            errors.push(`Upload ${relativePath}: ${errorMsg}`);
                        }
                    }
                    for (const key of remoteFiles) {
                        if (!localPaths.has(key)) {
                            try {
                                await this.downloadFileFromR2(key);
                                downloaded++;
                                newSyncedFiles.push(key);
                            } catch (e) {
                                const errorMsg = e instanceof Error ? e.message : String(e);
                                errors.push(`Download ${key}: ${errorMsg}`);
                            }
                        }
                    }
                    break;

                case 'remote-first':
                    for (const key of remoteFiles) {
                        try {
                            await this.downloadFileFromR2(key);
                            downloaded++;
                            newSyncedFiles.push(key);
                        } catch (e) {
                            const errorMsg = e instanceof Error ? e.message : String(e);
                            errors.push(`Download ${key}: ${errorMsg}`);
                        }
                    }
                    for (const file of localFiles) {
                        const relativePath = this.getRelativePath(file.path);
                        if (!remotePaths.has(relativePath)) {
                            try {
                                await this.uploadFileToR2(file, relativePath);
                                uploaded++;
                                newSyncedFiles.push(relativePath);
                                this.markFileSynced(file, relativePath);
                            } catch (e) {
                                const errorMsg = e instanceof Error ? e.message : String(e);
                                errors.push(`Upload ${relativePath}: ${errorMsg}`);
                            }
                        }
                    }
                    break;

                case 'bidirectional':
                default:
                    // Process local files
                    for (const file of localFiles) {
                        const relativePath = this.getRelativePath(file.path);
                        newSyncedFiles.push(relativePath);

                        if (!remotePaths.has(relativePath)) {
                            // Local only → upload
                            try {
                                await this.uploadFileToR2(file, relativePath);
                                uploaded++;
                                this.markFileSynced(file, relativePath);
                            } catch (e) {
                                const errorMsg = e instanceof Error ? e.message : String(e);
                                errors.push(`Upload ${relativePath}: ${errorMsg}`);
                            }
                        } else {
                            // Both sides exist → check mtime for changes
                            const lastMtime = this.settings.syncedFileMtimes[relativePath];
                            if (lastMtime === undefined) {
                                // First time tracking this file, record mtime without uploading
                                this.markFileSynced(file, relativePath);
                            } else if (file.stat.mtime !== lastMtime) {
                                // Local file has been modified, upload
                                try {
                                    await this.uploadFileToR2(file, relativePath);
                                    uploaded++;
                                    this.markFileSynced(file, relativePath);
                                } catch (e) {
                                    const errorMsg = e instanceof Error ? e.message : String(e);
                                    errors.push(`Upload ${relativePath}: ${errorMsg}`);
                                }
                            }
                        }
                    }

                    // Process remote-only files
                    for (const key of remoteFiles) {
                        if (!localPaths.has(key)) {
                            if (previouslySynced.has(key)) {
                                // Was synced before, now deleted locally → delete from remote
                                try {
                                    await this.deleteFromR2(key);
                                    deleted++;
                                    this.removeFileSynced(key);
                                } catch (e) {
                                    const errorMsg = e instanceof Error ? e.message : String(e);
                                    errors.push(`Delete remote ${key}: ${errorMsg}`);
                                    newSyncedFiles.push(key);
                                }
                            } else {
                                // New remote file → download
                                try {
                                    await this.downloadFileFromR2(key);
                                    downloaded++;
                                    newSyncedFiles.push(key);
                                } catch (e) {
                                    const errorMsg = e instanceof Error ? e.message : String(e);
                                    errors.push(`Download ${key}: ${errorMsg}`);
                                }
                            }
                        }
                    }

                    // Clean up files that no longer exist on either side
                    for (const prevFile of previouslySynced) {
                        if (!remotePaths.has(prevFile) && !localPaths.has(prevFile)) {
                            this.removeFileSynced(prevFile);
                        }
                    }
                    break;
            }

            this.settings.syncedFiles = newSyncedFiles;
            await this.saveSettings();

            syncingNotice.hide();

            let message = i18n.syncComplete(uploaded, downloaded, deleted, errors.length);
            if (errors.length > 0) {
                message += `\n\n${i18n.errorDetails}:\n${errors.slice(0, 5).join('\n')}`;
                if (errors.length > 5) {
                    message += `\n${i18n.moreErrors(errors.length - 5)}`;
                }
            }
            new Notice(message, 10000);
        } catch (e) {
            syncingNotice.hide();
            const errorMsg = e instanceof Error ? e.message : String(e);
            new Notice(i18n.syncFailed(errorMsg), 10000);
        } finally {
            this.isSyncing = false;
        }
    }

    async analyzeDiff() {
        const i18n = t(this.settings.language);
        if (!this.isConfigured()) {
            new Notice(i18n.configFirst);
            return;
        }

        const analyzingNotice = new Notice(i18n.analyzing, 0);

        try {
            const folder = this.getSyncFolder();
            if (!folder) {
                analyzingNotice.hide();
                new Notice(i18n.syncFolderNotExist);
                return;
            }

            const localFiles = this.getAllSyncFiles(folder);
            const remoteFiles = await this.listR2Files();

            const localPaths = new Set(localFiles.map(f => this.getRelativePath(f.path)));
            const remotePaths = new Set(remoteFiles);
            const previouslySynced = new Set(this.settings.syncedFiles);

            const localOnly: string[] = [];
            const remoteOnly: string[] = [];
            const both: string[] = [];
            const deleted: string[] = [];

            for (const path of localPaths) {
                if (remotePaths.has(path)) {
                    both.push(path);
                } else {
                    localOnly.push(path);
                }
            }

            for (const path of remotePaths) {
                if (!localPaths.has(path) && !previouslySynced.has(path)) {
                    remoteOnly.push(path);
                }
            }

            for (const path of previouslySynced) {
                if (!localPaths.has(path) && remotePaths.has(path)) {
                    deleted.push(path);
                }
            }

            analyzingNotice.hide();

            new AnalyzeModal(
                this.app,
                i18n,
                {
                    localOnly,
                    remoteOnly,
                    both,
                    deleted,
                    localCount: localPaths.size,
                    remoteCount: remotePaths.size
                },
                this
            ).open();
        } catch (e) {
            analyzingNotice.hide();
            const errorMsg = e instanceof Error ? e.message : String(e);
            new Notice(i18n.syncFailed(errorMsg), 10000);
        }
    }

    async syncFile(file: TFile): Promise<void> {
        if (!this.isConfigured()) {
            return;
        }

        const syncFolder = this.settings.syncFolder || '';
        const syncFolderPrefix = syncFolder + '/';
        if (syncFolder && file.path !== syncFolder && !file.path.startsWith(syncFolderPrefix)) {
            return;
        }

        try {
            const relativePath = this.getRelativePath(file.path);
            await this.uploadFileToR2(file, relativePath);

            if (!this.settings.syncedFiles.includes(relativePath)) {
                this.settings.syncedFiles.push(relativePath);
            }
            this.markFileSynced(file, relativePath);
            await this.saveSettings();
        } catch (e) {
            const i18n = t(this.settings.language);
            const errorMsg = e instanceof Error ? e.message : String(e);
            new Notice(i18n.uploadFailed(`${file.path}: ${errorMsg}`), 5000);
        }
    }

    isSyncableFile(file: TFile): boolean {
        if (!this.shouldSyncFile(file)) return false;
        const syncFolder = this.settings.syncFolder || '';
        if (!syncFolder) return true;
        const syncFolderPrefix = syncFolder + '/';
        return file.path === syncFolder || file.path.startsWith(syncFolderPrefix);
    }

    async uploadSingleFile(file: TFile): Promise<void> {
        const i18n = t(this.settings.language);
        if (!this.isConfigured()) {
            new Notice(i18n.configFirst);
            return;
        }
        if (!this.isSyncableFile(file)) {
            new Notice(i18n.fileNotInSyncFolder);
            return;
        }

        const relativePath = this.getRelativePath(file.path);
        const uploadingNotice = new Notice(i18n.uploadingFile(file.name), 0);

        try {
            await this.uploadFileToR2(file, relativePath);
            if (!this.settings.syncedFiles.includes(relativePath)) {
                this.settings.syncedFiles.push(relativePath);
            }
            this.markFileSynced(file, relativePath);
            await this.saveSettings();
            uploadingNotice.hide();
            new Notice(i18n.uploadFileSuccess(file.name), 5000);
        } catch (e) {
            uploadingNotice.hide();
            const errorMsg = e instanceof Error ? e.message : String(e);
            new Notice(i18n.uploadFileFailed(file.name, errorMsg), 10000);
        }
    }

    getSyncFolder(): TFolder | null {
        if (!this.settings.syncFolder) {
            return this.app.vault.getRoot();
        }
        const folder = this.app.vault.getAbstractFileByPath(this.settings.syncFolder);
        return folder instanceof TFolder ? folder : null;
    }

    isImageFile(file: TFile): boolean {
        return IMAGE_EXTENSIONS.includes(file.extension.toLowerCase());
    }

    shouldSyncFile(file: TFile): boolean {
        if (file.extension === 'md') return true;
        if (this.settings.syncImages && this.isImageFile(file)) return true;
        return false;
    }

    getAllSyncFiles(folder: TFolder): TFile[] {
        const files: TFile[] = [];
        for (const child of folder.children) {
            if (child instanceof TFile && this.shouldSyncFile(child)) {
                files.push(child);
            } else if (child instanceof TFolder) {
                files.push(...this.getAllSyncFiles(child));
            }
        }
        return files;
    }

    getAllMdFiles(folder: TFolder): TFile[] {
        const files: TFile[] = [];
        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === 'md') {
                files.push(child);
            } else if (child instanceof TFolder) {
                files.push(...this.getAllMdFiles(child));
            }
        }
        return files;
    }

    getRelativePath(absolutePath: string): string {
        const syncFolder = this.settings.syncFolder || '';
        if (syncFolder && absolutePath.startsWith(syncFolder + '/')) {
            return absolutePath.slice(syncFolder.length + 1);
        }
        return absolutePath;
    }

    getLocalPath(relativePath: string): string {
        const syncFolder = this.settings.syncFolder || '';
        return syncFolder ? `${syncFolder}/${relativePath}` : relativePath;
    }

    async saveFile(path: string, content: string): Promise<TFile> {
        const dir = path.substring(0, path.lastIndexOf('/'));
        if (dir) {
            await this.app.vault.createFolder(dir).catch(() => {});
        }

        const existing = this.app.vault.getAbstractFileByPath(path);
        if (existing instanceof TFile) {
            await this.app.vault.modify(existing, content);
            return existing;
        } else {
            return await this.app.vault.create(path, content);
        }
    }

    async sha256(message: string): Promise<string> {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        return this.arrayBufferToHex(hashBuffer);
    }

    async hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
        const msgData = new TextEncoder().encode(message);
        const cryptoKey = await crypto.subtle.importKey(
            'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
        return new Uint8Array(signature);
    }

    arrayBufferToHex(buffer: ArrayBuffer): string {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    getAmzDate(date: Date): string {
        return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    }

    uriEncode(str: string, encodeSlash: boolean = true): string {
        if (encodeSlash) {
            return encodeURIComponent(str);
        }
        return encodeURIComponent(str).replace(/%2F/g, '/');
    }

    markFileSynced(file: TFile, relativePath: string): void {
        this.settings.syncedFileMtimes[relativePath] = file.stat.mtime;
    }

    removeFileSynced(relativePath: string): void {
        delete this.settings.syncedFileMtimes[relativePath];
    }

    scheduleClearRecentlyDownloaded(): void {
        if (this.downloadClearTimeout) {
            window.clearTimeout(this.downloadClearTimeout);
        }
        this.downloadClearTimeout = window.setTimeout(() => {
            this.recentlyDownloaded.clear();
        }, 5000);
    }

    async createSignature(method: string, objectKey: string, body: string): Promise<{ headers: Record<string, string>; url: string }> {
        const region = 'us-east-1';
        const service = 's3';
        const host = this.getEndpointHost();
        const bucket = this.settings.bucketName;

        const now = new Date();
        const amzDate = this.getAmzDate(now);
        const dateStamp = amzDate.substring(0, 8);

        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

        const bodyHash = await this.sha256(body);

        const encodedKey = this.uriEncode(objectKey, false);
        const canonicalUri = `/${bucket}/${encodedKey}`;
        const canonicalQueryString = '';
        const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${bodyHash}\nx-amz-date:${amzDate}\n`;
        const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

        const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${bodyHash}`;
        const canonicalRequestHash = await this.sha256(canonicalRequest);

        const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

        const kSecret = new TextEncoder().encode(`AWS4${this.settings.secretAccessKey}`);
        const kDate = await this.hmacSha256(kSecret, dateStamp);
        const kRegion = await this.hmacSha256(kDate, region);
        const kService = await this.hmacSha256(kRegion, service);
        const kSigning = await this.hmacSha256(kService, 'aws4_request');
        const signature = this.arrayBufferToHex((await this.hmacSha256(kSigning, stringToSign)).buffer);

        const credential = `${this.settings.accessKeyId}/${credentialScope}`;
        const authorization = `${algorithm} Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const url = `${this.getBaseUrl()}/${bucket}/${encodedKey}`;

        return {
            url,
            headers: {
                'x-amz-date': amzDate,
                'x-amz-content-sha256': bodyHash,
                'authorization': authorization
            }
        };
    }

    async uploadToR2(key: string, content: string): Promise<void> {
        const i18n = t(this.settings.language);
        const { url, headers } = await this.createSignature('PUT', key, content);

        try {
            const response = await requestUrl({
                url,
                method: 'PUT',
                headers: {
                    ...headers,
                    'content-type': 'text/markdown; charset=utf-8'
                },
                body: content
            });

            if (response.status < 200 || response.status >= 300) {
                throw new Error(i18n.uploadFailed(`${response.status} - ${response.text}`));
            }
        } catch (e) {
            if (e instanceof Error) throw e;
            throw new Error(i18n.uploadFailed(String(e)));
        }
    }

    async uploadFileToR2(file: TFile, relativePath: string): Promise<void> {
        const i18n = t(this.settings.language);
        const isImage = this.isImageFile(file);

        if (isImage) {
            const arrayBuffer = await this.app.vault.readBinary(file);
            const { url, headers } = await this.createSignatureForBinary('PUT', relativePath, arrayBuffer.byteLength);

            const contentType = this.getContentType(file.extension);

            try {
                const response = await requestUrl({
                    url,
                    method: 'PUT',
                    headers: {
                        ...headers,
                        'content-type': contentType
                    },
                    body: arrayBuffer
                });

                if (response.status < 200 || response.status >= 300) {
                    throw new Error(i18n.uploadFailed(`${response.status} - ${response.text}`));
                }
            } catch (e) {
                if (e instanceof Error) throw e;
                throw new Error(i18n.uploadFailed(String(e)));
            }
        } else {
            const content = await this.app.vault.read(file);
            await this.uploadToR2(relativePath, content);
        }
    }

    async downloadFileFromR2(key: string): Promise<void> {
        const i18n = t(this.settings.language);
        const isImage = IMAGE_EXTENSIONS.some(ext => key.toLowerCase().endsWith(`.${ext}`));
        const localPath = this.getLocalPath(key);

        const { url, headers } = await this.createSignature('GET', key, '');

        try {
            const response = await requestUrl({
                url,
                method: 'GET',
                headers,
                arrayBuffer: isImage
            });

            if (response.status < 200 || response.status >= 300) {
                throw new Error(i18n.downloadFailed(`${response.status} - ${response.text}`));
            }

            let savedFile: TFile;
            if (isImage) {
                savedFile = await this.saveBinaryFile(localPath, response.arrayBuffer);
            } else {
                savedFile = await this.saveFile(localPath, response.text);
            }

            // Mark as recently downloaded to prevent syncOnSave loop
            this.recentlyDownloaded.add(key);
            this.scheduleClearRecentlyDownloaded();

            // Record sync time
            this.markFileSynced(savedFile, key);
        } catch (e) {
            if (e instanceof Error) throw e;
            throw new Error(i18n.downloadFailed(String(e)));
        }
    }

    getContentType(extension: string): string {
        const contentTypes: Record<string, string> = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'bmp': 'image/bmp',
            'ico': 'image/x-icon'
        };
        return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
    }

    async saveBinaryFile(path: string, data: ArrayBuffer): Promise<TFile> {
        const dir = path.substring(0, path.lastIndexOf('/'));
        if (dir) {
            await this.app.vault.createFolder(dir).catch(() => {});
        }

        const existing = this.app.vault.getAbstractFileByPath(path);
        if (existing instanceof TFile) {
            await this.app.vault.modifyBinary(existing, data);
            return existing;
        } else {
            return await this.app.vault.createBinary(path, data);
        }
    }

    async createSignatureForBinary(method: string, objectKey: string, contentLength: number): Promise<{ headers: Record<string, string>; url: string }> {
        const region = 'us-east-1';
        const service = 's3';
        const host = this.getEndpointHost();
        const bucket = this.settings.bucketName;

        const now = new Date();
        const amzDate = this.getAmzDate(now);
        const dateStamp = amzDate.substring(0, 8);

        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

        const bodyHash = 'UNSIGNED-PAYLOAD';

        const encodedKey = this.uriEncode(objectKey, false);
        const canonicalUri = `/${bucket}/${encodedKey}`;
        const canonicalQueryString = '';
        const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${bodyHash}\nx-amz-date:${amzDate}\n`;
        const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

        const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${bodyHash}`;
        const canonicalRequestHash = await this.sha256(canonicalRequest);

        const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

        const kSecret = new TextEncoder().encode(`AWS4${this.settings.secretAccessKey}`);
        const kDate = await this.hmacSha256(kSecret, dateStamp);
        const kRegion = await this.hmacSha256(kDate, region);
        const kService = await this.hmacSha256(kRegion, service);
        const kSigning = await this.hmacSha256(kService, 'aws4_request');
        const signature = this.arrayBufferToHex((await this.hmacSha256(kSigning, stringToSign)).buffer);

        const credential = `${this.settings.accessKeyId}/${credentialScope}`;
        const authorization = `${algorithm} Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const url = `${this.getBaseUrl()}/${bucket}/${encodedKey}`;

        return {
            url,
            headers: {
                'x-amz-date': amzDate,
                'x-amz-content-sha256': bodyHash,
                'authorization': authorization
            }
        };
    }

    async downloadFromR2(key: string): Promise<string> {
        const i18n = t(this.settings.language);
        const { url, headers } = await this.createSignature('GET', key, '');

        try {
            const response = await requestUrl({
                url,
                method: 'GET',
                headers
            });

            if (response.status < 200 || response.status >= 300) {
                throw new Error(i18n.downloadFailed(`${response.status} - ${response.text}`));
            }

            return response.text;
        } catch (e) {
            if (e instanceof Error) throw e;
            throw new Error(i18n.downloadFailed(String(e)));
        }
    }

    async deleteFromR2(key: string): Promise<void> {
        const i18n = t(this.settings.language);
        const { url, headers } = await this.createSignature('DELETE', key, '');

        try {
            const response = await requestUrl({
                url,
                method: 'DELETE',
                headers
            });

            if (response.status < 200 || response.status >= 300) {
                throw new Error(i18n.deleteFailed(`${response.status} - ${response.text}`));
            }
        } catch (e) {
            if (e instanceof Error) throw e;
            throw new Error(i18n.deleteFailed(String(e)));
        }
    }

    async listR2Files(): Promise<string[]> {
        const allFiles: string[] = [];
        let continuationToken: string | undefined;
        let pageCount = 0;
        const MAX_PAGES = 100;

        do {
            pageCount++;
            if (pageCount > MAX_PAGES) {
                // eslint-disable-next-line no-undef
                console.warn('R2Sync: Reached max pages limit in listR2Files');
                break;
            }

            const { files, nextToken } = await this.listR2FilesPage(continuationToken);
            allFiles.push(...files);
            continuationToken = nextToken;
        } while (continuationToken);

        return allFiles;
    }

    private async listR2FilesPage(continuationToken?: string): Promise<{ files: string[]; nextToken?: string }> {
        const i18n = t(this.settings.language);
        const host = this.getEndpointHost();
        const bucket = this.settings.bucketName;
        const baseUrl = this.getBaseUrl();

        const region = 'us-east-1';
        const service = 's3';

        const now = new Date();
        const amzDate = this.getAmzDate(now);
        const dateStamp = amzDate.substring(0, 8);

        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

        const bodyHash = await this.sha256('');

        const canonicalUri = `/${bucket}/`;

        // Build query string parameters, sorted by key for signing
        const params: Record<string, string> = { 'list-type': '2' };
        if (continuationToken) {
            params['continuation-token'] = continuationToken;
        }
        const canonicalQueryString = Object.keys(params)
            .sort()
            .map(k => `${this.uriEncode(k, true)}=${this.uriEncode(params[k], true)}`)
            .join('&');

        const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${bodyHash}\nx-amz-date:${amzDate}\n`;
        const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

        const canonicalRequest = `GET\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${bodyHash}`;
        const canonicalRequestHash = await this.sha256(canonicalRequest);

        const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

        const kSecret = new TextEncoder().encode(`AWS4${this.settings.secretAccessKey}`);
        const kDate = await this.hmacSha256(kSecret, dateStamp);
        const kRegion = await this.hmacSha256(kDate, region);
        const kService = await this.hmacSha256(kRegion, service);
        const kSigning = await this.hmacSha256(kService, 'aws4_request');
        const signature = this.arrayBufferToHex((await this.hmacSha256(kSigning, stringToSign)).buffer);

        const credential = `${this.settings.accessKeyId}/${credentialScope}`;
        const authorization = `${algorithm} Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const url = `${baseUrl}/${bucket}/?${canonicalQueryString}`;

        try {
            const response = await requestUrl({
                url: url,
                method: 'GET',
                headers: {
                    'x-amz-date': amzDate,
                    'x-amz-content-sha256': bodyHash,
                    'authorization': authorization
                }
            });

            if (response.status < 200 || response.status >= 300) {
                throw new Error(i18n.listFailed(`${response.status} - ${response.text}`));
            }

            const xml = response.text;
            const keys: string[] = [];

            // Parse <Contents> blocks to extract Key and LastModified
            const contentsRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
            let contentsMatch;
            while ((contentsMatch = contentsRegex.exec(xml)) !== null) {
                const block = contentsMatch[1];
                const keyMatch = block.match(/<Key>([^<]+)<\/Key>/);
                if (keyMatch) {
                    const key = keyMatch[1];
                    if (key.endsWith('.md')) {
                        keys.push(key);
                    } else if (this.settings.syncImages && IMAGE_EXTENSIONS.some(ext => key.toLowerCase().endsWith(`.${ext}`))) {
                        keys.push(key);
                    }
                }
            }

            // Check for pagination
            const isTruncated = xml.includes('<IsTruncated>true</IsTruncated>');
            let nextToken: string | undefined;
            if (isTruncated) {
                const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
                if (tokenMatch) {
                    nextToken = tokenMatch[1];
                }
            }

            return { files: keys, nextToken };
        } catch (e) {
            if (e instanceof Error) throw e;
            throw new Error(i18n.listFailed(String(e)));
        }
    }
}

class R2SyncSettingTab extends PluginSettingTab {
    plugin: R2SyncPlugin;

    constructor(app: App, plugin: R2SyncPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        const i18n = t(this.plugin.settings.language);

        new Setting(containerEl)
            .setName(i18n.settingsTitle)
            .setHeading();

        new Setting(containerEl)
            .setName(i18n.language)
            .setDesc(i18n.languageDesc)
            .addDropdown(dropdown => dropdown
                .addOption('en', i18n.languageEn)
                .addOption('zh', i18n.languageZh)
                .setValue(this.plugin.settings.language)
                .onChange(async (value: Language) => {
                    this.plugin.settings.language = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        new Setting(containerEl)
            .setName(i18n.bucketName)
            .setDesc(i18n.bucketNameDesc)
            .addText(text => text
                .setPlaceholder('My bucket')
                .setValue(this.plugin.settings.bucketName)
                .onChange(async (value) => {
                    this.plugin.settings.bucketName = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.apiEndpoint)
            .setDesc(i18n.apiEndpointDesc)
            .addText(text => text
                .setPlaceholder('https://xxx.r2.cloudflarestorage.com')
                .setValue(this.plugin.settings.endpoint)
                .onChange(async (value) => {
                    this.plugin.settings.endpoint = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.accessKeyId)
            .setDesc(i18n.accessKeyIdDesc)
            .addText(text => text
                .setValue(this.plugin.settings.accessKeyId)
                .onChange(async (value) => {
                    this.plugin.settings.accessKeyId = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.secretKey)
            .setDesc(i18n.secretKeyDesc)
            .addText(text => text
                .setValue(this.plugin.settings.secretAccessKey)
                .onChange(async (value) => {
                    this.plugin.settings.secretAccessKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.syncFolder)
            .setDesc(i18n.syncFolderDesc)
            .addText(text => text
                .setPlaceholder('Notes')
                .setValue(this.plugin.settings.syncFolder)
                .onChange(async (value) => {
                    this.plugin.settings.syncFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.autoSync)
            .setDesc(i18n.autoSyncDesc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSync)
                .onChange(async (value) => {
                    this.plugin.settings.autoSync = value;
                    await this.plugin.saveSettings();
                    if (value) {
                        this.plugin.startAutoSync();
                    } else {
                        this.plugin.stopAutoSync();
                    }
                }));

        new Setting(containerEl)
            .setName(i18n.syncInterval)
            .setDesc(i18n.syncIntervalDesc)
            .addText(text => text
                .setValue(String(this.plugin.settings.syncInterval))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.syncInterval = num;
                        await this.plugin.saveSettings();
                        if (this.plugin.settings.autoSync) {
                            this.plugin.startAutoSync();
                        }
                    }
                }));

        new Setting(containerEl)
            .setName(i18n.syncOnSave)
            .setDesc(i18n.syncOnSaveDesc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.syncOnSave)
                .onChange(async (value) => {
                    this.plugin.settings.syncOnSave = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.syncStrategy)
            .setDesc(i18n.syncStrategyDesc)
            .addDropdown(dropdown => dropdown
                .addOption('bidirectional', i18n.strategyBidirectional)
                .addOption('upload-only', i18n.strategyUploadOnly)
                .addOption('download-only', i18n.strategyDownloadOnly)
                .addOption('local-first', i18n.strategyLocalFirst)
                .addOption('remote-first', i18n.strategyRemoteFirst)
                .setValue(this.plugin.settings.syncStrategy)
                .onChange(async (value: SyncStrategy) => {
                    this.plugin.settings.syncStrategy = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.syncImages)
            .setDesc(i18n.syncImagesDesc)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.syncImages)
                .onChange(async (value) => {
                    this.plugin.settings.syncImages = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(i18n.testConn)
            .setDesc(i18n.testConnDesc)
            .addButton(btn => btn
                .setButtonText(i18n.testConnBtn)
                .onClick(() => {
                    void this.plugin.testConnection();
                }));

        new Setting(containerEl)
            .setName(i18n.manualSync)
            .setDesc(i18n.manualSyncDesc)
            .addButton(btn => btn
                .setButtonText(i18n.uploadAllBtn)
                .onClick(() => {
                    void this.plugin.uploadAll();
                }))
            .addButton(btn => btn
                .setButtonText(i18n.downloadAllBtn)
                .onClick(() => {
                    void this.plugin.downloadAll();
                }))
            .addButton(btn => btn
                .setButtonText(i18n.syncBtn)
                .onClick(() => {
                    void this.plugin.sync();
                }))
            .addButton(btn => btn
                .setButtonText(i18n.analyzeBtn)
                .onClick(() => {
                    void this.plugin.analyzeDiff();
                }));
    }
}

interface AnalyzeResult {
    localOnly: string[];
    remoteOnly: string[];
    both: string[];
    deleted: string[];
    localCount: number;
    remoteCount: number;
}

class AnalyzeModal extends Modal {
    private i18n: typeof en;
    private result: AnalyzeResult;
    private plugin: R2SyncPlugin;
    private selectedFiles: Set<string> = new Set();
    private checkboxes: Map<string, HTMLInputElement> = new Map();

    constructor(app: App, i18n: typeof en, result: AnalyzeResult, plugin: R2SyncPlugin) {
        super(app);
        this.i18n = i18n;
        this.result = result;
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('r2-sync-analyze-modal');

        contentEl.createEl('h2', { text: this.i18n.analyzeTitle });

        const summary = contentEl.createDiv({ cls: 'r2-sync-summary' });
        summary.createEl('p', {
            text: this.i18n.analyzeSummary(
                this.result.localCount,
                this.result.remoteCount,
                this.result.localOnly.length,
                this.result.remoteOnly.length,
                this.result.deleted.length
            )
        });

        const hasDiff = this.result.localOnly.length > 0 ||
                        this.result.remoteOnly.length > 0 ||
                        this.result.deleted.length > 0;

        if (!hasDiff) {
            contentEl.createEl('p', {
                text: this.i18n.analyzeNoDiff,
                cls: 'r2-sync-no-diff'
            });
        } else {
            if (this.result.localOnly.length > 0) {
                this.createSection(contentEl, this.i18n.analyzeLocalOnly, this.result.localOnly, 'local-only', 'upload');
            }

            if (this.result.remoteOnly.length > 0) {
                this.createSection(contentEl, this.i18n.analyzeRemoteOnly, this.result.remoteOnly, 'remote-only', 'download');
            }

            if (this.result.deleted.length > 0) {
                this.createSection(contentEl, this.i18n.analyzeDeleted, this.result.deleted, 'deleted', 'delete');
            }
        }

        if (this.result.both.length > 0) {
            this.createSection(contentEl, this.i18n.analyzeBoth, this.result.both, 'both', 'none');
        }

        if (hasDiff) {
            const actionBar = contentEl.createDiv({ cls: 'r2-sync-action-bar' });
            actionBar.createEl('button', {
                text: this.i18n.selectAll,
                cls: 'r2-sync-btn-select-all'
            }).addEventListener('click', () => {
                this.selectAll();
            });
            actionBar.createEl('button', {
                text: this.i18n.deselectAll,
                cls: 'r2-sync-btn-deselect-all'
            }).addEventListener('click', () => {
                this.deselectAll();
            });
        }

        const buttonContainer = contentEl.createDiv({ cls: 'r2-sync-modal-buttons' });

        if (this.result.localOnly.length > 0) {
            buttonContainer.createEl('button', {
                text: this.i18n.uploadSelected,
                cls: 'mod-cta r2-sync-btn-upload'
            }).addEventListener('click', () => {
                void this.uploadSelected();
            });
        }

        if (this.result.remoteOnly.length > 0) {
            buttonContainer.createEl('button', {
                text: this.i18n.downloadSelected,
                cls: 'mod-cta r2-sync-btn-download'
            }).addEventListener('click', () => {
                void this.downloadSelected();
            });
        }

        if (this.result.deleted.length > 0) {
            buttonContainer.createEl('button', {
                text: this.i18n.deleteSelected,
                cls: 'mod-warning r2-sync-btn-delete'
            }).addEventListener('click', () => {
                void this.deleteSelected();
            });
        }

        buttonContainer.createEl('button', {
            text: this.i18n.close
        }).addEventListener('click', () => {
            this.close();
        });
    }

    createSection(container: HTMLElement, title: string, items: string[], cls: string, actionType: string) {
        const section = container.createDiv({ cls: `r2-sync-section r2-sync-${cls}` });
        section.createEl('h3', { text: `${title} (${items.length})` });

        const list = section.createEl('ul', { cls: 'r2-sync-file-list' });
        for (const item of items) {
            const li = list.createEl('li', { cls: 'r2-sync-file-item' });

            if (actionType !== 'none') {
                const checkbox = li.createEl('input', { type: 'checkbox', cls: 'r2-sync-checkbox' });
                checkbox.dataset.path = item;
                checkbox.dataset.action = actionType;
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        this.selectedFiles.add(item);
                    } else {
                        this.selectedFiles.delete(item);
                    }
                });
                this.checkboxes.set(item, checkbox);
            }

            li.createEl('span', { text: item, cls: 'r2-sync-file-name' });
        }
    }

    selectAll() {
        for (const [path, checkbox] of this.checkboxes) {
            checkbox.checked = true;
            this.selectedFiles.add(path);
        }
    }

    deselectAll() {
        for (const checkbox of this.checkboxes.values()) {
            checkbox.checked = false;
        }
        this.selectedFiles.clear();
    }

    getSelectedByAction(action: string): string[] {
        const result: string[] = [];
        for (const [path, checkbox] of this.checkboxes) {
            if (checkbox.checked && checkbox.dataset.action === action) {
                result.push(path);
            }
        }
        return result;
    }

    async uploadSelected() {
        const files = this.getSelectedByAction('upload');
        if (files.length === 0) {
            new Notice(this.i18n.noSelection);
            return;
        }

        const notice = new Notice(this.i18n.uploading, 0);
        let success = 0;
        const errors: string[] = [];

        try {
            for (const path of files) {
                try {
                    const fullPath = this.plugin.getLocalPath(path);
                    const file = this.app.vault.getAbstractFileByPath(fullPath);
                    if (file instanceof TFile) {
                        await this.plugin.uploadFileToR2(file, path);
                        success++;
                    }
                } catch (e) {
                    const errorMsg = e instanceof Error ? e.message : String(e);
                    errors.push(`${path}: ${errorMsg}`);
                }
            }

            await this.plugin.saveSettings();
            notice.hide();

            if (errors.length === 0) {
                new Notice(this.i18n.uploadSuccess(success), 5000);
                this.close();
                void this.plugin.analyzeDiff();
            } else {
                let message = this.i18n.uploadSuccess(success);
                message += `\n\n${this.i18n.errorDetails}:\n${errors.slice(0, 3).join('\n')}`;
                if (errors.length > 3) {
                    message += `\n${this.i18n.moreErrors(errors.length - 3)}`;
                }
                new Notice(message, 10000);
            }
        } catch (e) {
            notice.hide();
            const errorMsg = e instanceof Error ? e.message : String(e);
            new Notice(this.i18n.operationFailed(errorMsg), 10000);
        }
    }

    async downloadSelected() {
        const files = this.getSelectedByAction('download');
        if (files.length === 0) {
            new Notice(this.i18n.noSelection);
            return;
        }

        const notice = new Notice(this.i18n.downloading, 0);
        let success = 0;
        const errors: string[] = [];

        try {
            for (const path of files) {
                try {
                    await this.plugin.downloadFileFromR2(path);
                    success++;
                } catch (e) {
                    const errorMsg = e instanceof Error ? e.message : String(e);
                    errors.push(`${path}: ${errorMsg}`);
                }
            }

            await this.plugin.saveSettings();
            notice.hide();

            if (errors.length === 0) {
                new Notice(this.i18n.downloadSuccess(success), 5000);
                this.close();
                void this.plugin.analyzeDiff();
            } else {
                let message = this.i18n.downloadSuccess(success);
                message += `\n\n${this.i18n.errorDetails}:\n${errors.slice(0, 3).join('\n')}`;
                if (errors.length > 3) {
                    message += `\n${this.i18n.moreErrors(errors.length - 3)}`;
                }
                new Notice(message, 10000);
            }
        } catch (e) {
            notice.hide();
            const errorMsg = e instanceof Error ? e.message : String(e);
            new Notice(this.i18n.operationFailed(errorMsg), 10000);
        }
    }

    async deleteSelected() {
        const files = this.getSelectedByAction('delete');
        if (files.length === 0) {
            new Notice(this.i18n.noSelection);
            return;
        }

        const notice = new Notice(this.i18n.syncing, 0);
        let success = 0;
        const errors: string[] = [];

        try {
            for (const path of files) {
                try {
                    await this.plugin.deleteFromR2(path);
                    success++;
                } catch (e) {
                    const errorMsg = e instanceof Error ? e.message : String(e);
                    errors.push(`${path}: ${errorMsg}`);
                }
            }

            notice.hide();

            if (errors.length === 0) {
                new Notice(this.i18n.deleteSuccess(success), 5000);
                this.close();
                void this.plugin.analyzeDiff();
            } else {
                let message = this.i18n.deleteSuccess(success);
                message += `\n\n${this.i18n.errorDetails}:\n${errors.slice(0, 3).join('\n')}`;
                if (errors.length > 3) {
                    message += `\n${this.i18n.moreErrors(errors.length - 3)}`;
                }
                new Notice(message, 10000);
            }
        } catch (e) {
            notice.hide();
            const errorMsg = e instanceof Error ? e.message : String(e);
            new Notice(this.i18n.operationFailed(errorMsg), 10000);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

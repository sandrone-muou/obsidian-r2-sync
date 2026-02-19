import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder, requestUrl } from 'obsidian';

type Language = 'en' | 'zh';

interface R2SyncSettings {
    bucketName: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    syncFolder: string;
    autoSync: boolean;
    syncInterval: number;
    language: Language;
}

const DEFAULT_SETTINGS: R2SyncSettings = {
    bucketName: '',
    endpoint: '',
    accessKeyId: '',
    secretAccessKey: '',
    syncFolder: '',
    autoSync: false,
    syncInterval: 5,
    language: 'en'
}

const en = {
    ribbonTitle: 'R2 sync',
    cmdUpload: 'Upload all files to R2',
    cmdDownload: 'Download all files from R2',
    cmdSync: 'Bidirectional sync',
    configFirst: 'Please configure R2 storage settings first',
    syncFolderNotExist: 'Sync folder does not exist',
    connSuccess: (count: number) => `Connection successful! ${count} .md files in bucket`,
    connFailed: (msg: string) => `Connection failed: ${msg}`,
    uploadComplete: (ok: number, fail: number) => `Upload complete: ${ok} succeeded, ${fail} failed`,
    downloadComplete: (ok: number, fail: number) => `Download complete: ${ok} succeeded, ${fail} failed`,
    syncComplete: (up: number, down: number, fail: number) => `Sync complete: ${up} uploaded, ${down} downloaded, ${fail} failed`,
    syncFailed: (msg: string) => `Sync failed: ${msg}`,
    downloadFailed: (msg: string) => `Download failed: ${msg}`,
    uploadFailed: (msg: string) => `Upload failed: ${msg}`,
    listFailed: (msg: string) => `List files failed: ${msg}`,
    errorDetails: 'Error details',
    moreErrors: (count: number) => `...and ${count} more errors`,
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
    testConn: 'Test connection',
    testConnDesc: 'Test R2 connection',
    testConnBtn: 'Test connection',
    manualSync: 'Manual sync',
    manualSyncDesc: 'Manually trigger sync operations',
    uploadAllBtn: 'Upload all',
    downloadAllBtn: 'Download all',
    syncBtn: 'Sync',
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
    configFirst: '请先配置 R2 存储信息',
    syncFolderNotExist: '同步文件夹不存在',
    connSuccess: (count: number) => `连接成功！存储桶中有 ${count} 个 .md 文件`,
    connFailed: (msg: string) => `连接失败: ${msg}`,
    uploadComplete: (ok: number, fail: number) => `上传完成: ${ok} 个成功, ${fail} 个失败`,
    downloadComplete: (ok: number, fail: number) => `下载完成: ${ok} 个成功, ${fail} 个失败`,
    syncComplete: (up: number, down: number, fail: number) => `同步完成: 上传 ${up} 个, 下载 ${down} 个, ${fail} 个失败`,
    syncFailed: (msg: string) => `同步失败: ${msg}`,
    downloadFailed: (msg: string) => `下载失败: ${msg}`,
    uploadFailed: (msg: string) => `上传失败: ${msg}`,
    listFailed: (msg: string) => `列出文件失败: ${msg}`,
    errorDetails: '错误详情',
    moreErrors: (count: number) => `...还有 ${count} 个错误`,
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
    testConn: '测试连接',
    testConnDesc: '测试 R2 连接',
    testConnBtn: '测试连接',
    manualSync: '手动同步',
    manualSyncDesc: '手动触发同步操作',
    uploadAllBtn: '上传全部',
    downloadAllBtn: '下载全部',
    syncBtn: '同步',
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

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new R2SyncSettingTab(this.app, this));
        this.addCommands();
        
        if (this.settings.autoSync) {
            this.startAutoSync();
        }
        
        this.addRibbonIcon('cloud', t(this.settings.language).ribbonTitle, () => {
            void this.sync();
        });
    }

    onunload() {
        this.stopAutoSync();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<R2SyncSettings>);
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
        if (!this.isConfigured()) {
            new Notice(i18n.configFirst);
            return;
        }

        const folder = this.getSyncFolder();
        if (!folder) {
            new Notice(i18n.syncFolderNotExist);
            return;
        }

        const files = this.getAllMdFiles(folder);
        let uploaded = 0;
        const errors: string[] = [];

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                const relativePath = this.getRelativePath(file.path);
                await this.uploadToR2(relativePath, content);
                uploaded++;
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                errors.push(`${file.path}: ${errorMsg}`);
            }
        }

        const failed = errors.length;
        let message = i18n.uploadComplete(uploaded, failed);
        if (errors.length > 0) {
            message += `\n\n${i18n.errorDetails}:\n${errors.slice(0, 5).join('\n')}`;
            if (errors.length > 5) {
                message += `\n${i18n.moreErrors(errors.length - 5)}`;
            }
        }
        new Notice(message, 10000);
    }

    async downloadAll() {
        const i18n = t(this.settings.language);
        if (!this.isConfigured()) {
            new Notice(i18n.configFirst);
            return;
        }

        try {
            const files = await this.listR2Files();
            let downloaded = 0;
            const errors: string[] = [];

            for (const key of files) {
                try {
                    const content = await this.downloadFromR2(key);
                    const localPath = this.getLocalPath(key);
                    await this.saveFile(localPath, content);
                    downloaded++;
                } catch (e) {
                    const errorMsg = e instanceof Error ? e.message : String(e);
                    errors.push(`${key}: ${errorMsg}`);
                }
            }

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
        }
    }

    async sync() {
        const i18n = t(this.settings.language);
        if (!this.isConfigured()) {
            new Notice(i18n.configFirst);
            return;
        }

        try {
            const localFiles = this.getAllMdFiles(this.getSyncFolder()!);
            const remoteFiles = await this.listR2Files();
            
            const localPaths = new Set(localFiles.map(f => this.getRelativePath(f.path)));
            const remotePaths = new Set(remoteFiles);

            let uploaded = 0;
            let downloaded = 0;
            const errors: string[] = [];

            for (const file of localFiles) {
                const relativePath = this.getRelativePath(file.path);
                if (!remotePaths.has(relativePath)) {
                    try {
                        const content = await this.app.vault.read(file);
                        await this.uploadToR2(relativePath, content);
                        uploaded++;
                    } catch (e) {
                        const errorMsg = e instanceof Error ? e.message : String(e);
                        errors.push(`Upload ${relativePath}: ${errorMsg}`);
                    }
                }
            }

            for (const key of remoteFiles) {
                if (!localPaths.has(key)) {
                    try {
                        const content = await this.downloadFromR2(key);
                        await this.saveFile(this.getLocalPath(key), content);
                        downloaded++;
                    } catch (e) {
                        const errorMsg = e instanceof Error ? e.message : String(e);
                        errors.push(`Download ${key}: ${errorMsg}`);
                    }
                }
            }

            let message = i18n.syncComplete(uploaded, downloaded, errors.length);
            if (errors.length > 0) {
                message += `\n\n${i18n.errorDetails}:\n${errors.slice(0, 5).join('\n')}`;
                if (errors.length > 5) {
                    message += `\n${i18n.moreErrors(errors.length - 5)}`;
                }
            }
            new Notice(message, 10000);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            new Notice(i18n.syncFailed(errorMsg), 10000);
        }
    }

    getSyncFolder(): TFolder | null {
        if (!this.settings.syncFolder) {
            return this.app.vault.getRoot();
        }
        const folder = this.app.vault.getAbstractFileByPath(this.settings.syncFolder);
        return folder instanceof TFolder ? folder : null;
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

    async saveFile(path: string, content: string): Promise<void> {
        const dir = path.substring(0, path.lastIndexOf('/'));
        if (dir) {
            await this.app.vault.createFolder(dir).catch(() => {});
        }
        
        const existing = this.app.vault.getAbstractFileByPath(path);
        if (existing instanceof TFile) {
            await this.app.vault.modify(existing, content);
        } else {
            await this.app.vault.create(path, content);
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

    async listR2Files(): Promise<string[]> {
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
        const canonicalQueryString = 'list-type=2';
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
        
        const url = `${baseUrl}/${bucket}/?list-type=2`;
        
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
            const keyRegex = /<Key>([^<]+)<\/Key>/g;
            let match;
            while ((match = keyRegex.exec(xml)) !== null) {
                if (match[1].endsWith('.md')) {
                    keys.push(match[1]);
                }
            }
            return keys;
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
                }));
    }
}

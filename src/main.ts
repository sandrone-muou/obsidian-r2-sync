import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder, requestUrl } from 'obsidian';

interface R2SyncSettings {
    bucketName: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    syncFolder: string;
    autoSync: boolean;
    syncInterval: number;
}

const DEFAULT_SETTINGS: R2SyncSettings = {
    bucketName: '',
    endpoint: '',
    accessKeyId: '',
    secretAccessKey: '',
    syncFolder: '',
    autoSync: false,
    syncInterval: 5
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
        
        this.addRibbonIcon('cloud', 'R2 同步', () => {
            this.sync();
        });
    }

    onunload() {
        this.stopAutoSync();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    addCommands() {
        this.addCommand({
            id: 'r2-sync-upload',
            name: '上传所有文件到 R2',
            callback: () => this.uploadAll()
        });

        this.addCommand({
            id: 'r2-sync-download',
            name: '从 R2 下载所有文件',
            callback: () => this.downloadAll()
        });

        this.addCommand({
            id: 'r2-sync',
            name: '双向同步',
            callback: () => this.sync()
        });
    }

    startAutoSync() {
        this.stopAutoSync();
        const intervalMs = this.settings.syncInterval * 60 * 1000;
        this.syncIntervalId = window.setInterval(() => {
            this.sync();
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
        if (!this.isConfigured()) {
            new Notice('请先配置 R2 存储信息');
            return;
        }

        try {
            const files = await this.listR2Files();
            new Notice(`连接成功！存储桶中有 ${files.length} 个 .md 文件`, 5000);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            new Notice(`连接失败: ${errorMsg}`, 10000);
        }
    }

    async uploadAll() {
        if (!this.isConfigured()) {
            new Notice('请先配置 R2 存储信息');
            return;
        }

        const folder = this.getSyncFolder();
        if (!folder) {
            new Notice('同步文件夹不存在');
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
                console.error(`上传失败: ${file.path}`, e);
            }
        }

        const failed = errors.length;
        let message = `上传完成: ${uploaded} 个成功, ${failed} 个失败`;
        if (errors.length > 0) {
            message += `\n\n错误详情:\n${errors.slice(0, 5).join('\n')}`;
            if (errors.length > 5) {
                message += `\n...还有 ${errors.length - 5} 个错误`;
            }
        }
        new Notice(message, 10000);
    }

    async downloadAll() {
        if (!this.isConfigured()) {
            new Notice('请先配置 R2 存储信息');
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
                    console.error(`下载失败: ${key}`, e);
                }
            }

            const failed = errors.length;
            let message = `下载完成: ${downloaded} 个成功, ${failed} 个失败`;
            if (errors.length > 0) {
                message += `\n\n错误详情:\n${errors.slice(0, 5).join('\n')}`;
                if (errors.length > 5) {
                    message += `\n...还有 ${errors.length - 5} 个错误`;
                }
            }
            new Notice(message, 10000);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            new Notice('下载失败: ' + errorMsg, 10000);
        }
    }

    async sync() {
        if (!this.isConfigured()) {
            new Notice('请先配置 R2 存储信息');
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
                        errors.push(`上传 ${relativePath}: ${errorMsg}`);
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
                        errors.push(`下载 ${key}: ${errorMsg}`);
                    }
                }
            }

            let message = `同步完成: 上传 ${uploaded} 个, 下载 ${downloaded} 个`;
            if (errors.length > 0) {
                message += `, ${errors.length} 个失败`;
                message += `\n\n错误详情:\n${errors.slice(0, 5).join('\n')}`;
                if (errors.length > 5) {
                    message += `\n...还有 ${errors.length - 5} 个错误`;
                }
            }
            new Notice(message, 10000);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            new Notice('同步失败: ' + errorMsg, 10000);
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
                throw new Error(`上传失败: ${response.status} - ${response.text}`);
            }
        } catch (e) {
            if (e instanceof Error) throw e;
            throw new Error(`上传失败: ${String(e)}`);
        }
    }

    async downloadFromR2(key: string): Promise<string> {
        const { url, headers } = await this.createSignature('GET', key, '');
        
        try {
            const response = await requestUrl({
                url,
                method: 'GET',
                headers
            });

            if (response.status < 200 || response.status >= 300) {
                throw new Error(`下载失败: ${response.status} - ${response.text}`);
            }

            return response.text;
        } catch (e) {
            if (e instanceof Error) throw e;
            throw new Error(`下载失败: ${String(e)}`);
        }
    }

    async listR2Files(): Promise<string[]> {
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
                throw new Error(`列出文件失败: ${response.status} - ${response.text}`);
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
            throw new Error(`列出文件失败: ${String(e)}`);
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

        containerEl.createEl('h2', { text: 'R2 同步设置' });

        new Setting(containerEl)
            .setName('存储桶名称')
            .setDesc('Cloudflare R2 存储桶名称')
            .addText(text => text
                .setPlaceholder('my-bucket')
                .setValue(this.plugin.settings.bucketName)
                .onChange(async (value) => {
                    this.plugin.settings.bucketName = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('API 端点')
            .setDesc('格式: https://<account_id>.r2.cloudflarestorage.com')
            .addText(text => text
                .setPlaceholder('https://xxx.r2.cloudflarestorage.com')
                .setValue(this.plugin.settings.endpoint)
                .onChange(async (value) => {
                    this.plugin.settings.endpoint = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Access Key ID')
            .setDesc('R2 API 访问密钥 ID')
            .addText(text => text
                .setValue(this.plugin.settings.accessKeyId)
                .onChange(async (value) => {
                    this.plugin.settings.accessKeyId = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Secret Access Key')
            .setDesc('R2 API 访问密钥')
            .addText(text => text
                .setValue(this.plugin.settings.secretAccessKey)
                .onChange(async (value) => {
                    this.plugin.settings.secretAccessKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('同步文件夹')
            .setDesc('留空则同步整个仓库')
            .addText(text => text
                .setPlaceholder('Notes')
                .setValue(this.plugin.settings.syncFolder)
                .onChange(async (value) => {
                    this.plugin.settings.syncFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('自动同步')
            .setDesc('启用后自动同步')
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
            .setName('同步间隔')
            .setDesc('自动同步间隔（分钟）')
            .addSlider(slider => slider
                .setLimits(1, 60, 1)
                .setValue(this.plugin.settings.syncInterval)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.syncInterval = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: '手动操作' });

        new Setting(containerEl)
            .setName('测试连接')
            .setDesc('测试 R2 连接是否正常')
            .addButton(button => button
                .setButtonText('测试')
                .onClick(() => this.plugin.testConnection()));

        new Setting(containerEl)
            .setName('上传所有文件')
            .setDesc('将本地文件上传到 R2')
            .addButton(button => button
                .setButtonText('上传')
                .onClick(() => this.plugin.uploadAll()));

        new Setting(containerEl)
            .setName('下载所有文件')
            .setDesc('从 R2 下载文件到本地')
            .addButton(button => button
                .setButtonText('下载')
                .onClick(() => this.plugin.downloadAll()));

        new Setting(containerEl)
            .setName('双向同步')
            .setDesc('同步本地和远程差异')
            .addButton(button => button
                .setButtonText('同步')
                .onClick(() => this.plugin.sync()));
    }
}

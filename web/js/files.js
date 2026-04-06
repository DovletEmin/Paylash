// Paylash — File Manager — Turkmen UI
const FilesPage = {
    currentFolder: null,
    currentScope: 'personal', // 'personal' or 'group'
    viewMode: 'grid',
    breadcrumbs: [],
    files: [],
    folders: [],

    render() {
        return `
        <div class="files-page">
            <div class="files-toolbar">
                <div class="files-toolbar-left">
                    <div class="breadcrumbs" id="breadcrumbs"></div>
                </div>
                <div class="files-toolbar-right">
                    <div class="scope-toggle">
                        <button class="btn btn-sm ${this.currentScope === 'personal' ? 'btn-primary' : 'btn-ghost'}" onclick="FilesPage.setScope('personal')">Şahsy</button>
                        <button class="btn btn-sm ${this.currentScope === 'group' ? 'btn-primary' : 'btn-ghost'}" onclick="FilesPage.setScope('group')">Topar</button>
                    </div>
                    <div class="search-box">
                        <span class="search-icon">${UI.icons.search}</span>
                        <input type="text" id="file-search" placeholder="Gözle..." oninput="FilesPage.onSearch(this.value)">
                    </div>
                    <button class="btn btn-icon ${this.viewMode === 'grid' ? 'active' : ''}" onclick="FilesPage.setView('grid')" title="Setka">${UI.icons.grid}</button>
                    <button class="btn btn-icon ${this.viewMode === 'list' ? 'active' : ''}" onclick="FilesPage.setView('list')" title="Sanaw">${UI.icons.list}</button>
                </div>
            </div>

            <div class="files-actions">
                <button class="btn btn-primary" onclick="FilesPage.showUploadModal()">
                    ${UI.icons.upload} <span>Ýükle</span>
                </button>
                <button class="btn btn-ghost" onclick="FilesPage.showNewFolderModal()">
                    ${UI.icons.folder} <span>Täze papka</span>
                </button>
            </div>

            <div class="dropzone" id="dropzone">
                <div class="dropzone-content">
                    ${UI.icons.upload}
                    <p>Faýllary şu ýere süýräň ýa-da <label for="file-input" class="dropzone-link">saýlaň</label></p>
                    <input type="file" id="file-input" multiple style="display:none" onchange="FilesPage.handleFileSelect(this.files)">
                </div>
            </div>

            <div id="upload-progress" class="upload-progress hidden"></div>

            <div id="files-content" class="files-content">
                ${UI.skeletonCards(8)}
            </div>

            <div class="storage-bar" id="storage-bar"></div>
        </div>`;
    },

    async init() {
        await this.loadFiles();
        this.initDragDrop();
        this.loadStorageUsage();
    },

    async loadFiles() {
        const content = document.getElementById('files-content');
        if (!content) return;
        content.innerHTML = UI.skeletonCards(8);
        try {
            const params = { scope: this.currentScope };
            if (this.currentFolder) params.folder_id = this.currentFolder;
            const data = await API.files.list(params);
            this.files = data.files || [];
            this.folders = data.folders || [];
            this.breadcrumbs = data.breadcrumbs || [];
            this.renderBreadcrumbs();
            this.renderFiles();
        } catch (err) {
            content.innerHTML = `<div class="empty-state"><p>Faýllary ýükläp bolmady</p><p class="text-muted">${UI.esc(err.message)}</p></div>`;
        }
    },

    renderBreadcrumbs() {
        const el = document.getElementById('breadcrumbs');
        if (!el) return;
        let html = `<a href="#" class="breadcrumb-item" onclick="FilesPage.goToFolder(null);return false">
            ${this.currentScope === 'personal' ? '🏠 Şahsy' : '👥 Topar'}
        </a>`;
        if (this.breadcrumbs.length) {
            for (const b of this.breadcrumbs) {
                html += `<span class="breadcrumb-sep">/</span><a href="#" class="breadcrumb-item" onclick="FilesPage.goToFolder(${b.id});return false">${UI.esc(b.name)}</a>`;
            }
        }
        el.innerHTML = html;
    },

    renderFiles() {
        const content = document.getElementById('files-content');
        if (!content) return;
        const items = [...this.folders.map(f => ({ ...f, isFolder: true })), ...this.files];
        if (items.length === 0) {
            content.innerHTML = `<div class="empty-state">
                <div class="empty-icon">${UI.icons.folder}</div>
                <p>Bu ýerde faýl ýok</p>
                <p class="text-muted">Faýl ýükläň ýa-da papka dörediň</p>
            </div>`;
            return;
        }

        if (this.viewMode === 'grid') {
            let html = '<div class="file-grid">';
            for (const item of items) {
                html += this.renderGridCard(item);
            }
            content.innerHTML = html + '</div>';
        } else {
            let html = `<div class="file-list">
                <div class="file-list-header">
                    <div class="file-list-name">Ady</div>
                    <div class="file-list-size">Ölçegi</div>
                    <div class="file-list-date">Senesi</div>
                    <div class="file-list-actions"></div>
                </div>`;
            for (const item of items) {
                html += this.renderListRow(item);
            }
            content.innerHTML = html + '</div>';
        }
    },

    renderGridCard(item) {
        const icon = UI.fileIcon(item.name, item.isFolder);
        const cls = UI.fileIconClass(item.name, item.isFolder);
        const dblclick = item.isFolder
            ? `FilesPage.goToFolder(${item.id})`
            : (UI.isCollaboraEditable(item.name) ? `EditorPage.open(${item.id},'${UI.esc(item.name)}')` : `FilesPage.download(${item.id},'${UI.esc(item.name)}')`);
        return `<div class="file-card ${cls}" ondblclick="${dblclick}" oncontextmenu="FilesPage.showMenu(event, ${JSON.stringify(item).replace(/"/g, '&quot;')})">
            <div class="file-card-icon">${icon}</div>
            <div class="file-card-name" title="${UI.esc(item.name)}">${UI.esc(item.name)}</div>
            ${!item.isFolder ? `<div class="file-card-meta">${UI.formatBytes(item.size_bytes || 0)} · ${UI.formatDate(item.updated_at || item.created_at)}</div>` : `<div class="file-card-meta">Papka</div>`}
        </div>`;
    },

    renderListRow(item) {
        const icon = UI.fileIcon(item.name, item.isFolder);
        const dblclick = item.isFolder
            ? `FilesPage.goToFolder(${item.id})`
            : (UI.isCollaboraEditable(item.name) ? `EditorPage.open(${item.id},'${UI.esc(item.name)}')` : `FilesPage.download(${item.id},'${UI.esc(item.name)}')`);
        return `<div class="file-list-row" ondblclick="${dblclick}" oncontextmenu="FilesPage.showMenu(event, ${JSON.stringify(item).replace(/"/g, '&quot;')})">
            <div class="file-list-name"><span class="file-list-icon">${icon}</span>${UI.esc(item.name)}</div>
            <div class="file-list-size">${item.isFolder ? '—' : UI.formatBytes(item.size_bytes || 0)}</div>
            <div class="file-list-date">${UI.formatDate(item.updated_at || item.created_at)}</div>
            <div class="file-list-actions">
                <button class="btn btn-icon btn-sm" onclick="FilesPage.showMenu(event, ${JSON.stringify(item).replace(/"/g, '&quot;')})">⋮</button>
            </div>
        </div>`;
    },

    showMenu(e, item) {
        e.preventDefault();
        e.stopPropagation();
        const items = [];
        if (item.isFolder) {
            items.push({ action: 'open', label: 'Aç', icon: '📂', handler: () => this.goToFolder(item.id) });
            items.push({ action: 'rename', label: 'Adyny üýtget', icon: '✏️', handler: () => this.renameFolder(item) });
            items.push({ divider: true });
            items.push({ action: 'delete', label: 'Poz', icon: '🗑', danger: true, handler: () => this.deleteFolder(item) });
        } else {
            if (UI.isCollaboraEditable(item.name)) {
                items.push({ action: 'edit', label: 'Redaktirle', icon: '📝', handler: () => EditorPage.open(item.id, item.name) });
            }
            items.push({ action: 'download', label: 'Ýükle', icon: '📥', handler: () => this.download(item.id, item.name) });
            items.push({ action: 'share', label: 'Paýlaş', icon: '🔗', handler: () => SharesPage.showShareModal(item) });
            items.push({ action: 'rename', label: 'Adyny üýtget', icon: '✏️', handler: () => this.renameFile(item) });
            items.push({ divider: true });
            items.push({ action: 'delete', label: 'Poz', icon: '🗑', danger: true, handler: () => this.deleteFile(item) });
        }
        UI.showContextMenu(e.clientX, e.clientY, items);
    },

    setScope(scope) {
        this.currentScope = scope;
        this.currentFolder = null;
        this.loadFiles();
    },

    setView(mode) {
        this.viewMode = mode;
        this.renderFiles();
        document.querySelectorAll('.files-toolbar-right .btn-icon').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.files-toolbar-right .btn-icon:nth-of-type(${mode === 'grid' ? 1 : 2})`);
    },

    goToFolder(id) {
        this.currentFolder = id;
        this.loadFiles();
    },

    async onSearch(query) {
        if (!query || query.length < 2) { this.loadFiles(); return; }
        try {
            const data = await API.files.search(query);
            this.files = data || [];
            this.folders = [];
            this.breadcrumbs = [];
            this.renderBreadcrumbs();
            this.renderFiles();
        } catch { /* ignore */ }
    },

    // Upload
    showUploadModal() {
        document.getElementById('file-input').click();
    },

    async handleFileSelect(fileList) {
        if (!fileList.length) return;
        const progressEl = document.getElementById('upload-progress');
        progressEl.classList.remove('hidden');

        for (const file of fileList) {
            const id = 'up-' + Math.random().toString(36).substr(2, 6);
            progressEl.innerHTML += `<div class="upload-item" id="${id}">
                <div class="upload-item-name">${UI.esc(file.name)}</div>
                <div class="upload-item-bar"><div class="upload-item-fill" id="${id}-fill"></div></div>
                <div class="upload-item-pct" id="${id}-pct">0%</div>
            </div>`;

            try {
                await API.files.upload(file, this.currentScope, this.currentFolder, (pct) => {
                    const fill = document.getElementById(id + '-fill');
                    const pctEl = document.getElementById(id + '-pct');
                    if (fill) fill.style.width = pct + '%';
                    if (pctEl) pctEl.textContent = Math.round(pct) + '%';
                });
                const el = document.getElementById(id);
                if (el) el.classList.add('upload-done');
            } catch (err) {
                UI.toast(`"${file.name}" ýüklenip bilmedi: ${err.message}`, 'error');
                const el = document.getElementById(id);
                if (el) el.classList.add('upload-error');
            }
        }

        setTimeout(() => { progressEl.innerHTML = ''; progressEl.classList.add('hidden'); }, 2000);
        this.loadFiles();
        this.loadStorageUsage();
        document.getElementById('file-input').value = '';
    },

    initDragDrop() {
        const dropzone = document.getElementById('dropzone');
        if (!dropzone) return;
        const page = document.querySelector('.files-page');

        ['dragenter', 'dragover'].forEach(evt => {
            page.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('active'); });
        });
        ['dragleave', 'drop'].forEach(evt => {
            page.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('active'); });
        });
        page.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length) this.handleFileSelect(files);
        });
    },

    download(id, name) {
        const a = document.createElement('a');
        a.href = `/api/files/${id}/download`;
        a.download = name;
        a.click();
    },

    // Rename
    renameFile(item) {
        UI.showModal('Adyny üýtget', `
            <div class="form-group">
                <label>Täze ady</label>
                <input type="text" id="rename-input" value="${UI.esc(item.name)}" class="form-control">
            </div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button>
             <button class="btn btn-primary" onclick="FilesPage.doRenameFile(${item.id})">Üýtget</button>`
        );
        setTimeout(() => { const inp = document.getElementById('rename-input'); if (inp) { inp.focus(); inp.select(); } }, 100);
    },

    async doRenameFile(id) {
        const name = document.getElementById('rename-input').value.trim();
        if (!name) return;
        try {
            await API.files.rename(id, name);
            UI.closeModal();
            UI.toast('Faýlyň ady üýtgedildi', 'success');
            this.loadFiles();
        } catch (err) { UI.toast(err.message, 'error'); }
    },

    renameFolder(item) {
        UI.showModal('Papkanyň adyny üýtget', `
            <div class="form-group">
                <label>Täze ady</label>
                <input type="text" id="rename-input" value="${UI.esc(item.name)}" class="form-control">
            </div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button>
             <button class="btn btn-primary" onclick="FilesPage.doRenameFolder(${item.id})">Üýtget</button>`
        );
        setTimeout(() => { const inp = document.getElementById('rename-input'); if (inp) { inp.focus(); inp.select(); } }, 100);
    },

    async doRenameFolder(id) {
        const name = document.getElementById('rename-input').value.trim();
        if (!name) return;
        try {
            await API.folders.rename(id, name);
            UI.closeModal();
            UI.toast('Papkanyň ady üýtgedildi', 'success');
            this.loadFiles();
        } catch (err) { UI.toast(err.message, 'error'); }
    },

    // Delete
    deleteFile(item) {
        UI.showModal('Faýly pozmak', `
            <p>"<strong>${UI.esc(item.name)}</strong>" faýlyny pozmak isleýärsiňizmi?</p>
            <p class="text-muted">Bu hereket yzyna gaýtaryp bolmaýar.</p>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button>
             <button class="btn btn-danger" onclick="FilesPage.doDeleteFile(${item.id})">Poz</button>`
        );
    },

    async doDeleteFile(id) {
        try {
            await API.files.delete(id);
            UI.closeModal();
            UI.toast('Faýl pozuldy', 'success');
            this.loadFiles();
            this.loadStorageUsage();
        } catch (err) { UI.toast(err.message, 'error'); }
    },

    deleteFolder(item) {
        UI.showModal('Papkany pozmak', `
            <p>"<strong>${UI.esc(item.name)}</strong>" papkasyny pozmak isleýärsiňizmi?</p>
            <p class="text-muted">Papkadaky ähli faýllar pozular.</p>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button>
             <button class="btn btn-danger" onclick="FilesPage.doDeleteFolder(${item.id})">Poz</button>`
        );
    },

    async doDeleteFolder(id) {
        try {
            await API.folders.delete(id);
            UI.closeModal();
            UI.toast('Papka pozuldy', 'success');
            this.loadFiles();
        } catch (err) { UI.toast(err.message, 'error'); }
    },

    // New folder
    showNewFolderModal() {
        UI.showModal('Täze papka', `
            <div class="form-group">
                <label>Papkanyň ady</label>
                <input type="text" id="new-folder-name" placeholder="Papka ady" class="form-control">
            </div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button>
             <button class="btn btn-primary" onclick="FilesPage.doCreateFolder()">Döret</button>`
        );
        setTimeout(() => { const inp = document.getElementById('new-folder-name'); if (inp) inp.focus(); }, 100);
    },

    async doCreateFolder() {
        const name = document.getElementById('new-folder-name').value.trim();
        if (!name) return;
        try {
            await API.folders.create(name, this.currentScope, this.currentFolder);
            UI.closeModal();
            UI.toast('Papka döredildi', 'success');
            this.loadFiles();
        } catch (err) { UI.toast(err.message, 'error'); }
    },

    // Storage usage bar
    async loadStorageUsage() {
        try {
            const data = await API.files.storageUsage();
            const bar = document.getElementById('storage-bar');
            if (!bar) return;
            const pct = data.quota_bytes > 0 ? Math.min((data.used_bytes / data.quota_bytes) * 100, 100) : 0;
            bar.innerHTML = `
                <div class="storage-info">
                    <span>Saklanylýan ýer: ${UI.formatBytes(data.used_bytes)} / ${UI.formatBytes(data.quota_bytes)}</span>
                    <span>${Math.round(pct)}%</span>
                </div>
                <div class="storage-track">
                    <div class="storage-fill ${pct > 90 ? 'danger' : pct > 70 ? 'warning' : ''}" style="width:${pct}%"></div>
                </div>`;
        } catch { /* ignore */ }
    }
};

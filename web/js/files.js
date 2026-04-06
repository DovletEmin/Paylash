/* Paylash — File Manager */
const FilesPage = {
    currentFolder: null,
    currentScope: 'personal',
    viewMode: 'grid',
    breadcrumbs: [],
    files: [],
    folders: [],

    render() {
        return `
        <div class="files-page">
            <div class="files-toolbar">
                <div class="files-toolbar-left">
                </div>
                <div class="files-toolbar-right">
                    <div class="search-box">
                        <span class="search-icon">${UI.icons.search}</span>
                        <input type="text" id="file-search" placeholder="Gözle…" oninput="FilesPage.onSearch(this.value)">
                    </div>
                    <button class="btn btn-icon btn-ghost ${this.viewMode === 'grid' ? 'active' : ''}" onclick="FilesPage.setView('grid')" title="Setka">${UI.icons.grid}</button>
                    <button class="btn btn-icon btn-ghost ${this.viewMode === 'list' ? 'active' : ''}" onclick="FilesPage.setView('list')" title="Sanaw">${UI.icons.list}</button>
                </div>
            </div>
            <div class="files-actions">
                <button class="btn btn-primary btn-sm" onclick="FilesPage.showUploadModal()">${UI.icons.upload} Ýükle</button>
                <button class="btn btn-ghost btn-sm" onclick="FilesPage.showNewFolderModal()">${UI.icons.plus} Täze papka</button>
            </div>
            <div class="breadcrumbs" id="breadcrumbs"></div>
            <div class="dropzone" id="dropzone">
                <div class="dropzone-content">
                    ${UI.icons.upload}
                    <p>Faýllary şu ýere süýräň ýa-da <label for="file-input" class="dropzone-link">saýlaň</label></p>
                    <input type="file" id="file-input" multiple style="display:none" onchange="FilesPage.handleFileSelect(this.files)">
                </div>
            </div>
            <div id="upload-progress" class="upload-progress hidden"></div>
            <div id="files-content">${UI.skeletonCards(6)}</div>
            <div id="storage-bar" class="storage-bar"></div>
        </div>`;
    },

    async init() { await this.loadFiles(); this.initDragDrop(); this.loadStorageUsage(); },

    async loadFiles() {
        const c = document.getElementById('files-content');
        if (!c) return;
        c.innerHTML = UI.skeletonCards(6);
        try {
            const p = { scope: this.currentScope };
            if (this.currentFolder) p.folder_id = this.currentFolder;
            const data = await API.files.list(p);
            this.files = data.files || [];
            this.folders = data.folders || [];
            this.breadcrumbs = data.breadcrumbs || [];
            this.renderBreadcrumbs();
            this.renderFiles();
        } catch (err) {
            c.innerHTML = `<div class="empty-state"><p>Faýllary ýükläp bolmady</p><p class="text-muted">${UI.esc(err.message)}</p></div>`;
        }
    },

    renderBreadcrumbs() {
        const el = document.getElementById('breadcrumbs');
        if (!el) return;
        let h = `<a class="breadcrumb-item" onclick="FilesPage.goToFolder(null)">${this.currentScope === 'personal' ? 'Şahsy' : this.currentScope === 'group' ? 'Topar' : 'Umumy'}</a>`;
        for (const b of this.breadcrumbs) {
            h += `<span class="breadcrumb-sep">/</span><a class="breadcrumb-item" onclick="FilesPage.goToFolder(${b.id})">${UI.esc(b.name)}</a>`;
        }
        el.innerHTML = h;
    },

    renderFiles() {
        const c = document.getElementById('files-content');
        if (!c) return;
        const items = [...this.folders.map(f => ({ ...f, isFolder: true })), ...this.files];
        if (!items.length) {
            c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📂</div><p>Bu ýerde faýl ýok</p><p class="text-muted">Faýl ýükläň ýa-da papka dörediň</p></div>';
            return;
        }
        if (this.viewMode === 'grid') {
            c.innerHTML = '<div class="file-grid">' + items.map(i => this.gridCard(i)).join('') + '</div>';
        } else {
            c.innerHTML = `<div class="file-list">
                <div class="file-list-header"><div>Ady</div><div>Ölçegi</div><div>Senesi</div><div></div></div>
                ${items.map(i => this.listRow(i)).join('')}
            </div>`;
        }
    },

    gridCard(item) {
        const icon = UI.fileIcon(item.name, item.isFolder);
        const cls = UI.fileIconClass(item.name, item.isFolder);
        const dbl = item.isFolder ? `FilesPage.goToFolder(${item.id})`
            : (UI.isCollaboraViewable(item.name) ? `EditorPage.open(${item.id},'${UI.esc(item.name)}')` : `FilesPage.download(${item.id},'${UI.esc(item.name)}')`);
        const itemJson = JSON.stringify(item).replace(/"/g, '&quot;');
        return `<div class="file-card" ondblclick="${dbl}" oncontextmenu="FilesPage.showMenu(event,${itemJson})">
            <div class="file-card-icon ${cls}">${icon}</div>
            <div class="file-card-name" title="${UI.esc(item.name)}">${UI.esc(item.name)}</div>
            ${!item.isFolder ? `<div class="file-card-meta">${UI.formatBytes(item.size_bytes || 0)} · ${UI.formatDate(item.updated_at || item.created_at)}</div>` : '<div class="file-card-meta">Papka</div>'}
        </div>`;
    },

    listRow(item) {
        const icon = UI.fileIcon(item.name, item.isFolder);
        const cls = UI.fileIconClass(item.name, item.isFolder);
        const dbl = item.isFolder ? `FilesPage.goToFolder(${item.id})`
            : (UI.isCollaboraViewable(item.name) ? `EditorPage.open(${item.id},'${UI.esc(item.name)}')` : `FilesPage.download(${item.id},'${UI.esc(item.name)}')`);
        const itemJson = JSON.stringify(item).replace(/"/g, '&quot;');
        return `<div class="file-list-row" ondblclick="${dbl}" oncontextmenu="FilesPage.showMenu(event,${itemJson})">
            <div class="file-list-name"><span class="file-list-icon ${cls}">${icon}</span>${UI.esc(item.name)}</div>
            <div class="file-list-size">${item.isFolder ? '—' : UI.formatBytes(item.size_bytes || 0)}</div>
            <div class="file-list-date">${UI.formatDate(item.updated_at || item.created_at)}</div>
            <div class="file-list-actions"><button class="btn btn-icon btn-sm" onclick="FilesPage.showMenu(event,${itemJson})">⋮</button></div>
        </div>`;
    },

    showMenu(e, item) {
        e.preventDefault(); e.stopPropagation();
        const items = [];
        if (item.isFolder) {
            items.push({ action: 'open', label: 'Aç', icon: '📂', handler: () => this.goToFolder(item.id) });
            items.push({ action: 'rename', label: 'Adyny üýtget', icon: '✏️', handler: () => this.renameFolder(item) });
            items.push({ divider: true });
            items.push({ action: 'delete', label: 'Poz', icon: '🗑', danger: true, handler: () => this.deleteFolder(item) });
        } else {
            if (UI.isCollaboraEditable(item.name)) items.push({ action: 'edit', label: 'Redaktirle', icon: '📝', handler: () => EditorPage.open(item.id, item.name) });
            else if (UI.isCollaboraViewable(item.name)) items.push({ action: 'view', label: 'Açmak', icon: '👁', handler: () => EditorPage.open(item.id, item.name) });
            items.push({ action: 'download', label: 'Ýükle', icon: '📥', handler: () => this.download(item.id, item.name) });
            items.push({ action: 'share', label: 'Paýlaş', icon: '🔗', handler: () => SharesPage.showShareModal(item) });
            items.push({ action: 'rename', label: 'Adyny üýtget', icon: '✏️', handler: () => this.renameFile(item) });
            items.push({ divider: true });
            items.push({ action: 'delete', label: 'Poz', icon: '🗑', danger: true, handler: () => this.deleteFile(item) });
        }
        UI.showContextMenu(e.clientX, e.clientY, items);
    },

    setScope(s) { this.currentScope = s; this.currentFolder = null; App.renderPage('files'); },
    setView(m) { this.viewMode = m; this.renderFiles(); },
    goToFolder(id) { this.currentFolder = id; this.loadFiles(); },

    async onSearch(q) {
        if (!q || q.length < 2) { this.loadFiles(); return; }
        try { const data = await API.files.search(q); this.files = data || []; this.folders = []; this.breadcrumbs = []; this.renderBreadcrumbs(); this.renderFiles(); } catch {}
    },

    showUploadModal() { document.getElementById('file-input').click(); },

    async handleFileSelect(fileList) {
        if (!fileList.length) return;
        const prog = document.getElementById('upload-progress');
        prog.classList.remove('hidden');
        for (const file of fileList) {
            const id = 'u-' + Math.random().toString(36).substr(2, 6);
            prog.innerHTML += `<div class="upload-item" id="${id}"><div class="upload-item-name">${UI.esc(file.name)}</div><div class="upload-item-bar"><div class="upload-item-fill" id="${id}-f"></div></div><div class="upload-item-pct" id="${id}-p">0%</div></div>`;
            try {
                await API.files.upload(file, this.currentScope, this.currentFolder, pct => {
                    const f = document.getElementById(id + '-f'), p = document.getElementById(id + '-p');
                    if (f) f.style.width = pct + '%'; if (p) p.textContent = Math.round(pct) + '%';
                });
                document.getElementById(id)?.classList.add('upload-done');
            } catch (err) {
                UI.toast(`"${file.name}" ýüklenip bilmedi: ${err.message}`, 'error');
                document.getElementById(id)?.classList.add('upload-error');
            }
        }
        setTimeout(() => { prog.innerHTML = ''; prog.classList.add('hidden'); }, 2000);
        this.loadFiles(); this.loadStorageUsage();
        document.getElementById('file-input').value = '';
    },

    initDragDrop() {
        const dz = document.getElementById('dropzone'), pg = document.querySelector('.files-page');
        if (!dz || !pg) return;
        ['dragenter', 'dragover'].forEach(e => pg.addEventListener(e, ev => { ev.preventDefault(); dz.classList.add('active'); }));
        ['dragleave', 'drop'].forEach(e => pg.addEventListener(e, ev => { ev.preventDefault(); dz.classList.remove('active'); }));
        pg.addEventListener('drop', e => { if (e.dataTransfer.files.length) this.handleFileSelect(e.dataTransfer.files); });
    },

    async download(id, name) {
        try {
            const res = await fetch(`/api/files/${id}/download`, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('Ýükläp bolmady');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = name;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) { UI.toast(e.message || 'Ýükläp bolmady', 'error'); }
    },

    renameFile(item) {
        UI.showModal('Adyny üýtget', `<div class="form-group"><label>Täze ady</label><input type="text" id="rename-input" value="${UI.esc(item.name)}" class="form-control"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-primary" onclick="FilesPage.doRenameFile(${item.id})">Üýtget</button>`);
        setTimeout(() => { const i = document.getElementById('rename-input'); if (i) { i.focus(); i.select(); } }, 100);
    },
    async doRenameFile(id) {
        const n = document.getElementById('rename-input').value.trim(); if (!n) return;
        try { await API.files.rename(id, n); UI.closeModal(); UI.toast('Ady üýtgedildi', 'success'); this.loadFiles(); } catch (e) { UI.toast(e.message, 'error'); }
    },

    renameFolder(item) {
        UI.showModal('Papkanyň adyny üýtget', `<div class="form-group"><label>Täze ady</label><input type="text" id="rename-input" value="${UI.esc(item.name)}" class="form-control"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-primary" onclick="FilesPage.doRenameFolder(${item.id})">Üýtget</button>`);
        setTimeout(() => { const i = document.getElementById('rename-input'); if (i) { i.focus(); i.select(); } }, 100);
    },
    async doRenameFolder(id) {
        const n = document.getElementById('rename-input').value.trim(); if (!n) return;
        try { await API.folders.rename(id, n); UI.closeModal(); UI.toast('Ady üýtgedildi', 'success'); this.loadFiles(); } catch (e) { UI.toast(e.message, 'error'); }
    },

    deleteFile(item) {
        UI.showModal('Faýly pozmak',
            `<p>"<strong>${UI.esc(item.name)}</strong>" faýlyny pozmak isleýärsiňizmi?</p><p class="text-muted">Bu yzyna gaýtaryp bolmaýar.</p>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-danger" onclick="FilesPage.doDeleteFile(${item.id})">Poz</button>`);
    },
    async doDeleteFile(id) { try { await API.files.delete(id); UI.closeModal(); UI.toast('Faýl pozuldy', 'success'); this.loadFiles(); this.loadStorageUsage(); } catch (e) { UI.toast(e.message, 'error'); } },

    deleteFolder(item) {
        UI.showModal('Papkany pozmak',
            `<p>"<strong>${UI.esc(item.name)}</strong>" papkasyny pozmak isleýärsiňizmi?</p><p class="text-muted">Ähli faýllar pozular.</p>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-danger" onclick="FilesPage.doDeleteFolder(${item.id})">Poz</button>`);
    },
    async doDeleteFolder(id) { try { await API.folders.delete(id); UI.closeModal(); UI.toast('Papka pozuldy', 'success'); this.loadFiles(); } catch (e) { UI.toast(e.message, 'error'); } },

    showNewFolderModal() {
        UI.showModal('Täze papka', `<div class="form-group"><label>Papkanyň ady</label><input type="text" id="new-folder-name" class="form-control" placeholder="Papka ady"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-primary" onclick="FilesPage.doCreateFolder()">Döret</button>`);
        setTimeout(() => { const i = document.getElementById('new-folder-name'); if (i) i.focus(); }, 100);
    },
    async doCreateFolder() {
        const n = document.getElementById('new-folder-name').value.trim(); if (!n) return;
        try { await API.folders.create(n, this.currentScope, this.currentFolder); UI.closeModal(); UI.toast('Papka döredildi', 'success'); this.loadFiles(); } catch (e) { UI.toast(e.message, 'error'); }
    },

    async loadStorageUsage() {
        try {
            const d = await API.files.storageUsage();
            const bar = document.getElementById('storage-bar');
            if (!bar) return;
            const pct = d.quota_bytes > 0 ? Math.min((d.used_bytes / d.quota_bytes) * 100, 100) : 0;
            bar.innerHTML = `<div class="storage-info"><span>${UI.formatBytes(d.used_bytes)} / ${UI.formatBytes(d.quota_bytes)}</span><span>${Math.round(pct)}%</span></div>
                <div class="storage-track"><div class="storage-fill ${pct > 90 ? 'danger' : pct > 70 ? 'warning' : ''}" style="width:${pct}%"></div></div>`;
        } catch {}
    }
};

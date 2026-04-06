// Paylash — Sharing — Turkmen UI
const SharesPage = {
    renderSharedWithMe() {
        return `
        <div class="shares-page">
            <div class="page-header">
                <h2>${UI.icons.share} Maňa paýlaşylanlar</h2>
            </div>
            <div id="shared-content" class="files-content">
                ${UI.skeletonCards(6)}
            </div>
        </div>`;
    },

    async initSharedWithMe() {
        const content = document.getElementById('shared-content');
        if (!content) return;
        try {
            const data = await API.sharing.sharedWithMe();
            const files = data || [];
            if (files.length === 0) {
                content.innerHTML = `<div class="empty-state">
                    <div class="empty-icon">${UI.icons.share}</div>
                    <p>Heniz hiç zat paýlaşylmadyk</p>
                    <p class="text-muted">Beýleki ulanyjylar size faýl paýlaşanda şu ýerde görüner</p>
                </div>`;
                return;
            }
            let html = '<div class="file-grid">';
            for (const f of files) {
                const icon = UI.fileIcon(f.name, false);
                const dblclick = UI.isCollaboraEditable(f.name) ? `EditorPage.open(${f.id},'${UI.esc(f.name)}')` : `FilesPage.download(${f.id},'${UI.esc(f.name)}')`;
                html += `<div class="file-card" ondblclick="${dblclick}">
                    <div class="file-card-icon">${icon}</div>
                    <div class="file-card-name" title="${UI.esc(f.name)}">${UI.esc(f.name)}</div>
                    <div class="file-card-meta">${UI.formatBytes(f.size_bytes || 0)} · ${f.owner_name ? 'Paýlaşan: ' + UI.esc(f.owner_name) : ''}</div>
                    <div class="file-card-badge">${f.permission === 'edit' ? '✏️ Redaktirläp bolýar' : '👁 Diňe görmek'}</div>
                </div>`;
            }
            content.innerHTML = html + '</div>';
        } catch (err) {
            content.innerHTML = `<div class="empty-state"><p>Ýükläp bolmady</p><p class="text-muted">${UI.esc(err.message)}</p></div>`;
        }
    },

    // Share modal
    showShareModal(file) {
        const html = `
            <div class="share-modal-content">
                <div class="form-group">
                    <label>Ulanyjy gözle</label>
                    <input type="text" id="share-user-search" placeholder="Ulanyjy adyny ýazyň..." class="form-control" oninput="SharesPage.searchUsers(this.value)">
                    <div id="share-user-results" class="share-user-results"></div>
                </div>
                <div class="form-group">
                    <label>Rugsat</label>
                    <select id="share-permission" class="form-control">
                        <option value="view">👁 Diňe görmek</option>
                        <option value="edit">✏️ Redaktirlemek</option>
                    </select>
                </div>
                <hr>
                <div class="form-group">
                    <div class="share-public-row">
                        <label>Köpçülige açyk baglanyşyk</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="share-public" onchange="SharesPage.togglePublicShare(${file.id}, this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div id="share-public-link" class="share-public-link hidden"></div>
                </div>
                <hr>
                <div id="share-existing" class="share-existing">
                    <p class="text-muted">Ýüklenýär...</p>
                </div>
            </div>`;
        UI.showModal(`"${file.name}" paýlaş`, html, '');
        this._currentShareFile = file;
        this.loadExistingShares(file.id);
    },

    _currentShareFile: null,
    _selectedUserId: null,

    async searchUsers(query) {
        const results = document.getElementById('share-user-results');
        if (!results) return;
        if (!query || query.length < 2) { results.innerHTML = ''; return; }
        try {
            const users = await API.sharing.searchUsers(query);
            if (!users || !users.length) { results.innerHTML = '<div class="share-user-no-result">Tapylmady</div>'; return; }
            results.innerHTML = users.map(u => `
                <div class="share-user-item" onclick="SharesPage.selectUser(${u.id}, '${UI.esc(u.full_name)}')">
                    <span class="share-user-avatar">${u.full_name.charAt(0).toUpperCase()}</span>
                    <div>
                        <div class="share-user-name">${UI.esc(u.full_name)}</div>
                        <div class="share-user-username">@${UI.esc(u.username)}</div>
                    </div>
                </div>`).join('');
        } catch { results.innerHTML = ''; }
    },

    selectUser(userId, name) {
        this._selectedUserId = userId;
        document.getElementById('share-user-search').value = name;
        document.getElementById('share-user-results').innerHTML = '';
        this.doShare();
    },

    async doShare() {
        if (!this._currentShareFile || !this._selectedUserId) return;
        const perm = document.getElementById('share-permission').value;
        try {
            await API.sharing.share(this._currentShareFile.id, this._selectedUserId, perm);
            UI.toast('Faýl paýlaşyldy', 'success');
            this._selectedUserId = null;
            document.getElementById('share-user-search').value = '';
            this.loadExistingShares(this._currentShareFile.id);
        } catch (err) { UI.toast(err.message, 'error'); }
    },

    async togglePublicShare(fileId, isPublic) {
        const linkEl = document.getElementById('share-public-link');
        try {
            const data = await API.sharing.setPublic(fileId, isPublic);
            if (isPublic) {
                linkEl.innerHTML = `<span class="text-muted">Köpçülige açyk edildi ✓</span>`;
                linkEl.classList.remove('hidden');
            } else {
                linkEl.classList.add('hidden');
                linkEl.innerHTML = '';
            }
        } catch (err) { UI.toast(err.message, 'error'); }
    },

    async loadExistingShares(fileId) {
        const el = document.getElementById('share-existing');
        if (!el) return;
        try {
            const shares = await API.sharing.getFileShares(fileId);
            if (!shares || !shares.length) {
                el.innerHTML = '<p class="text-muted">Heniz hiç kim bilen paýlaşylmadyk</p>';
                return;
            }
            el.innerHTML = '<h4>Paýlaşylanlar</h4>' + shares.map(s => `
                <div class="share-existing-item">
                    <span class="share-user-avatar">${(s.full_name || '?').charAt(0).toUpperCase()}</span>
                    <div class="share-existing-info">
                        <div>${UI.esc(s.full_name || s.username)}</div>
                        <div class="text-muted">${s.permission === 'edit' ? 'Redaktirlemek' : 'Diňe görmek'}</div>
                    </div>
                    <button class="btn btn-icon btn-sm btn-danger" onclick="SharesPage.removeShare(${fileId}, ${s.shared_with})" title="Aýyr">✕</button>
                </div>`).join('');
        } catch { el.innerHTML = ''; }
    },

    async removeShare(fileId, userId) {
        try {
            await API.sharing.deleteShare(fileId, userId);
            UI.toast('Paýlaşma aýyryldy', 'success');
            this.loadExistingShares(fileId);
        } catch (err) { UI.toast(err.message, 'error'); }
    }
};

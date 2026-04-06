/* Paylash — Shares Page */
const SharesPage = {
    renderSharedWithMe() {
        return `
        <div>
            <div id="shared-content">${UI.skeletonCards(6)}</div>
        </div>`;
    },

    async initSharedWithMe() {
        const c = document.getElementById('shared-content');
        if (!c) return;
        try {
            const files = (await API.sharing.sharedWithMe()) || [];
            if (!files.length) {
                c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔗</div><p>Heniz hiç zat paýlaşylmadyk</p><p class="text-muted">Beýleki ulanyjylar size faýl paýlaşanda şu ýerde görüner</p></div>';
                return;
            }
            let h = '<div class="file-grid">';
            for (const f of files) {
                const icon = UI.fileIcon(f.name, false);
                const dbl = UI.isMediaPreviewable(f.name) ? `PreviewPage.open(${f.id},'${UI.esc(f.name)}')`
                    : UI.isCollaboraViewable(f.name) ? `EditorPage.open(${f.id},'${UI.esc(f.name)}')` : `FilesPage.download(${f.id},'${UI.esc(f.name)}')`;
                h += `<div class="file-card" ondblclick="${dbl}">`;
                    <div class="file-card-icon document">${icon}</div>
                    <div class="file-card-name" title="${UI.esc(f.name)}">${UI.esc(f.name)}</div>
                    <div class="file-card-meta">${UI.formatBytes(f.size_bytes || 0)}${f.owner_name ? ' · ' + UI.esc(f.owner_name) : ''}</div>
                    <div class="file-card-badge">${f.permission === 'edit' ? '✏️ Redaktirläp bolýar' : '👁 Diňe görmek'}</div>
                </div>`;
            }
            c.innerHTML = h + '</div>';
        } catch (err) {
            c.innerHTML = `<div class="empty-state"><p>Ýükläp bolmady</p><p class="text-muted">${UI.esc(err.message)}</p></div>`;
        }
    },

    showShareModal(file) {
        const vis = file.visibility || 'private';
        UI.showModal(`"${UI.esc(file.name)}" paýlaş`, `
            <div class="form-group">
                <label>Ulanyjy gözle</label>
                <input type="text" id="share-user-search" class="form-control" placeholder="Ulanyjy adyny ýazyň…" oninput="SharesPage.searchUsers(this.value)">
                <div id="share-user-results" class="share-user-results"></div>
                <div id="share-selected-user" class="share-selected-user hidden"></div>
            </div>
            <div class="form-group">
                <label>Rugsat</label>
                <select id="share-permission" class="form-control">
                    <option value="view">👁 Diňe görmek</option>
                    <option value="edit">✏️ Redaktirlemek</option>
                </select>
            </div>
            <hr style="border:none;border-top:1px solid var(--border);margin:14px 0">
            <div class="form-group">
                <label>Görnüşi</label>
                <div class="visibility-buttons" id="vis-buttons">
                    <button class="btn btn-sm vis-btn ${vis === 'private' ? 'active' : ''}" data-vis="private" onclick="SharesPage.selectVisibility('private')">🔒 Şahsy</button>
                    <button class="btn btn-sm vis-btn ${vis === 'group' ? 'active' : ''}" data-vis="group" onclick="SharesPage.selectVisibility('group')">👥 Topar</button>
                    <button class="btn btn-sm vis-btn ${vis === 'public' ? 'active' : ''}" data-vis="public" onclick="SharesPage.selectVisibility('public')">🌐 Umumy</button>
                </div>
                <div id="vis-status" class="vis-status" style="font-size:.78rem;color:var(--text-3);margin-top:6px">
                    ${vis === 'public' ? 'Ähli ulanyjylar görüp biler' : vis === 'group' ? 'Topardaşlaryňyz görüp biler' : 'Diňe siz we paýlaşylanlar'}
                </div>
            </div>
            <div id="share-existing"><p class="text-muted">Ýüklenýär…</p></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyr</button><button class="btn btn-primary" onclick="SharesPage.saveShare()">Ýatda sakla</button>`);
        this._currentFile = file;
        this._selectedUserId = null;
        this._selectedVisibility = vis;
        this.loadExistingShares(file.id);
    },

    _currentFile: null,
    _selectedUserId: null,

    async searchUsers(q) {
        const r = document.getElementById('share-user-results');
        if (!r) return;
        if (!q || q.length < 2) { r.innerHTML = ''; return; }
        try {
            const users = await API.sharing.searchUsers(q);
            if (!users?.length) { r.innerHTML = '<div class="share-user-no-result">Tapylmady</div>'; return; }
            r.innerHTML = users.map(u => `
                <div class="share-user-item" onclick="SharesPage.selectUser(${u.id},'${UI.esc(u.full_name)}')">
                    <span class="share-user-avatar">${(u.full_name||'?').charAt(0).toUpperCase()}</span>
                    <div><div class="share-user-name">${UI.esc(u.full_name)}</div><div class="share-user-username">@${UI.esc(u.username)}</div></div>
                </div>`).join('');
        } catch { r.innerHTML = ''; }
    },

    selectUser(id, name) {
        this._selectedUserId = id;
        document.getElementById('share-user-search').value = '';
        document.getElementById('share-user-results').innerHTML = '';
        const sel = document.getElementById('share-selected-user');
        if (sel) {
            sel.classList.remove('hidden');
            sel.innerHTML = `<div class="share-user-item">
                <span class="share-user-avatar">${(name||'?').charAt(0).toUpperCase()}</span>
                <div><div class="share-user-name">${UI.esc(name)}</div></div>
                <button class="btn btn-icon btn-sm" onclick="SharesPage.clearSelectedUser()" title="Aýyr">✕</button>
            </div>`;
        }
    },

    clearSelectedUser() {
        this._selectedUserId = null;
        const sel = document.getElementById('share-selected-user');
        if (sel) { sel.classList.add('hidden'); sel.innerHTML = ''; }
    },

    selectVisibility(vis) {
        this._selectedVisibility = vis;
        document.querySelectorAll('.vis-btn').forEach(b => b.classList.toggle('active', b.dataset.vis === vis));
        const st = document.getElementById('vis-status');
        if (st) st.textContent = vis === 'public' ? 'Ähli ulanyjylar görüp biler' : vis === 'group' ? 'Topardaşlaryňyz görüp biler' : 'Diňe siz we paýlaşylanlar';
    },

    async saveShare() {
        if (!this._currentFile) return;
        try {
            // Save visibility
            const newVis = this._selectedVisibility || 'private';
            const oldVis = this._currentFile.visibility || 'private';
            if (newVis !== oldVis) {
                await API.sharing.setVisibility(this._currentFile.id, newVis);
                this._currentFile.visibility = newVis;
            }
            // Share with selected user
            if (this._selectedUserId) {
                const perm = document.getElementById('share-permission').value;
                await API.sharing.share(this._currentFile.id, this._selectedUserId, perm);
                this._selectedUserId = null;
            }
            UI.closeModal();
            UI.toast('Üýtgeşmeler ýatda saklandy', 'success');
            if (typeof FilesPage !== 'undefined') FilesPage.loadFiles();
        } catch (e) { UI.toast(e.message, 'error'); }
    },

    async setVisibility(fileId, visibility) {
        try {
            await API.sharing.setVisibility(fileId, visibility);
            document.querySelectorAll('.vis-btn').forEach(b => b.classList.toggle('active', b.dataset.vis === visibility));
            const st = document.getElementById('vis-status');
            if (st) st.textContent = visibility === 'public' ? 'Ähli ulanyjylar görüp biler' : visibility === 'group' ? 'Topardaşlaryňyz görüp biler' : 'Diňe siz we paýlaşylanlar';
            if (this._currentFile) this._currentFile.visibility = visibility;
        } catch (e) { UI.toast(e.message, 'error'); }
    },

    async loadExistingShares(fileId) {
        const el = document.getElementById('share-existing');
        if (!el) return;
        try {
            const shares = await API.sharing.getFileShares(fileId);
            if (!shares?.length) { el.innerHTML = '<p class="text-muted" style="font-size:.82rem">Heniz hiç kim bilen paýlaşylmadyk</p>'; return; }
            el.innerHTML = '<h4 style="font-size:.82rem;font-weight:600;color:var(--text-2);margin-bottom:8px">Paýlaşylanlar</h4>' +
                shares.map(s => `
                <div class="share-existing-item">
                    <span class="share-user-avatar">${(s.full_name || '?').charAt(0).toUpperCase()}</span>
                    <div class="share-existing-info">
                        <div style="font-size:.82rem;font-weight:500">${UI.esc(s.full_name || s.username)}</div>
                    </div>
                    <select class=\"form-control\" style=\"width:auto;padding:4px 28px 4px 8px;font-size:.72rem\" onchange=\"SharesPage.updatePermission(${fileId},${s.shared_with},this.value)\">
                        <option value=\"view\" ${s.permission === 'view' ? 'selected' : ''}>👁 Görmek</option>
                        <option value=\"edit\" ${s.permission === 'edit' ? 'selected' : ''}>✏️ Redaktirlemek</option>
                    </select>
                    <button class=\"btn btn-icon btn-sm btn-danger\" onclick=\"SharesPage.removeShare(${fileId},${s.shared_with})\" title=\"Aýyr\">✕</button>
                </div>`).join('');
        } catch { el.innerHTML = ''; }
    },

    async updatePermission(fileId, userId, permission) {
        try {
            await API.sharing.updateSharePermission(fileId, userId, permission);
            UI.toast('Rugsat üýtgedildi', 'success');
        } catch (e) { UI.toast(e.message, 'error'); }
    },

    async removeShare(fileId, userId) {
        try { await API.sharing.deleteShare(fileId, userId); UI.toast('Paýlaşma aýyryldy', 'success'); this.loadExistingShares(fileId); }
        catch (e) { UI.toast(e.message, 'error'); }
    }
};

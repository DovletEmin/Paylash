/* Paylash — Admin Panel */
const AdminPage = {
    currentTab: 'dashboard',
    _faculties: [],
    _users: [],
    _adminGroupFiles: { groupId: null, folderId: null, files: [], folders: [], breadcrumbs: [] },
    _adminPublicFiles: { folderId: null, files: [], folders: [], breadcrumbs: [] },

    render() {
        return `
        <div class="admin-page">
            <div class="admin-sidebar">
                <div class="admin-title">${UI.icons.settings} Dolandyryş</div>
                <nav class="admin-nav">
                    <a class="admin-nav-item ${this.currentTab === 'dashboard' ? 'active' : ''}" onclick="AdminPage.switchTab('dashboard')">${UI.icons.dashboard} Statistika</a>
                    <a class="admin-nav-item ${this.currentTab === 'faculties' ? 'active' : ''}" onclick="AdminPage.switchTab('faculties')">${UI.icons.school} Fakultetler</a>
                    <a class="admin-nav-item ${this.currentTab === 'courses' ? 'active' : ''}" onclick="AdminPage.switchTab('courses')">${UI.icons.book} Ugurlar</a>
                    <a class="admin-nav-item ${this.currentTab === 'groups' ? 'active' : ''}" onclick="AdminPage.switchTab('groups')">${UI.icons.users} Toparlar</a>
                    <a class="admin-nav-item ${this.currentTab === 'users' ? 'active' : ''}" onclick="AdminPage.switchTab('users')">${UI.icons.user} Ulanyjylar</a>
                    <a class="admin-nav-item ${this.currentTab === 'group-files' ? 'active' : ''}" onclick="AdminPage.switchTab('group-files')">📁 Topar faýllary</a>
                    <a class="admin-nav-item ${this.currentTab === 'public-files' ? 'active' : ''}" onclick="AdminPage.switchTab('public-files')">🌐 Umumy faýllar</a>
                </nav>
            </div>
            <div class="admin-content" id="admin-content"></div>
        </div>`;
    },

    async init() { await this.switchTab(this.currentTab); },

    async switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.admin-nav-item').forEach((el, i) => {
            el.classList.toggle('active', ['dashboard','faculties','courses','groups','users','group-files','public-files'][i] === tab);
        });
        const c = document.getElementById('admin-content');
        if (!c) return;
        c.innerHTML = '<div class="admin-loading"><div class="spinner"></div></div>';
        switch (tab) {
            case 'dashboard': await this.renderDashboard(c); break;
            case 'faculties': await this.renderFaculties(c); break;
            case 'courses':   await this.renderCourses(c); break;
            case 'groups':    await this.renderGroups(c); break;
            case 'users':     await this.renderUsers(c); break;
            case 'group-files': await this.renderGroupFiles(c); break;
            case 'public-files': await this.renderPublicFiles(c); break;
        }
    },

    /* ── Dashboard ── */
    async renderDashboard(el) {
        try {
            const [d, pq] = await Promise.all([API.admin.dashboard(), API.admin.publicQuota.get()]);
            const pqMB = Math.round((pq.quota_bytes || 53687091200) / (1024 * 1024));
            el.innerHTML = `
            <h2 style="font-size:1.1rem;font-weight:600;margin-bottom:16px">Statistika</h2>
            <div class="stat-cards">
                <div class="stat-card"><div class="stat-card-value">${d.total_users || 0}</div><div class="stat-card-label">Ulanyjylar</div></div>
                <div class="stat-card"><div class="stat-card-value">${d.total_files || 0}</div><div class="stat-card-label">Faýllar</div></div>
                <div class="stat-card"><div class="stat-card-value">${d.total_faculties || 0}</div><div class="stat-card-label">Fakultetler</div></div>
                <div class="stat-card"><div class="stat-card-value">${d.total_courses || 0}</div><div class="stat-card-label">Ugurlar</div></div>
                <div class="stat-card"><div class="stat-card-value">${d.total_groups || 0}</div><div class="stat-card-label">Toparlar</div></div>
                <div class="stat-card"><div class="stat-card-value">${UI.formatBytes(d.total_bytes || 0)}</div><div class="stat-card-label">Ulanylýan ýer</div></div>
            </div>
            <h3 style="font-size:1rem;font-weight:600;margin:24px 0 12px">Umumy ammar kwotasy</h3>
            <div style="display:flex;align-items:center;gap:10px">
                <input type="number" id="public-quota-mb" class="form-control" value="${pqMB}" min="1" style="width:160px">
                <span class="text-muted" style="font-size:.82rem">MB</span>
                <button class="btn btn-primary btn-sm" onclick="AdminPage.savePublicQuota()">Ýatda sakla</button>
            </div>
            <p class="text-muted" style="font-size:.78rem;margin-top:6px">Umumy (public) faýllar üçin umumy kwota.</p>`;
        } catch (e) { el.innerHTML = `<p class="text-muted">${UI.esc(e.message)}</p>`; }
    },

    async savePublicQuota() {
        const mb = parseInt(document.getElementById('public-quota-mb').value) || 0;
        if (mb <= 0) { UI.toast('Dogry kwota giriziň', 'error'); return; }
        try { await API.admin.publicQuota.set(mb); UI.toast('Umumy kwota üýtgedildi', 'success'); } catch (e) { UI.toast(e.message, 'error'); }
    },

    /* ── Faculties ── */
    async renderFaculties(el) {
        try {
            const items = (await API.admin.faculties.list()) || [];
            el.innerHTML = `
            <div class="admin-header"><h2>Fakultetler</h2><button class="btn btn-primary btn-sm" onclick="AdminPage.showFacultyModal()">${UI.icons.plus} Täze</button></div>
            <table class="admin-table"><thead><tr><th>ID</th><th>Ady</th><th>Hereketler</th></tr></thead><tbody>
            ${items.map(f => `<tr><td>${f.id}</td><td>${UI.esc(f.name)}</td><td>
                <button class="btn btn-sm btn-ghost" onclick="AdminPage.showFacultyModal(${f.id},'${UI.esc(f.name)}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="AdminPage.deleteFaculty(${f.id})">🗑</button></td></tr>`).join('')}
            ${!items.length ? '<tr><td colspan="3" class="text-muted text-center">Fakultet ýok</td></tr>' : ''}
            </tbody></table>`;
        } catch (e) { el.innerHTML = `<p class="text-muted">${UI.esc(e.message)}</p>`; }
    },

    showFacultyModal(id, name) {
        const edit = !!id;
        UI.showModal(edit ? 'Fakulteti üýtget' : 'Täze fakultet',
            `<div class="form-group"><label>Ady</label><input type="text" id="faculty-name" value="${name || ''}" class="form-control" placeholder="Fakultetiň ady"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-primary" onclick="AdminPage.saveFaculty(${id||'null'})">${edit ? 'Üýtget' : 'Döret'}</button>`);
    },
    async saveFaculty(id) {
        const n = document.getElementById('faculty-name').value.trim(); if (!n) { UI.toast('Ady giriziň', 'error'); return; }
        try { if (id) await API.admin.faculties.update(id, n); else await API.admin.faculties.create(n); UI.closeModal(); UI.toast(id ? 'Üýtgedildi' : 'Döredildi', 'success'); this.switchTab('faculties'); } catch (e) { UI.toast(e.message, 'error'); }
    },
    async deleteFaculty(id) {
        if (!confirm('Bu fakulteti pozmak isleýärsiňizmi?')) return;
        try { await API.admin.faculties.delete(id); UI.toast('Pozuldy', 'success'); this.switchTab('faculties'); } catch (e) { UI.toast(e.message, 'error'); }
    },

    /* ── Courses ── */
    async renderCourses(el) {
        try {
            const facs = (await API.admin.faculties.list()) || [];
            let all = [];
            for (const f of facs) { const cs = await API.catalogs.courses(f.id); if (cs) all.push(...cs.map(c => ({ ...c, faculty_name: f.name }))); }
            el.innerHTML = `
            <div class="admin-header"><h2>Ugurlar</h2><button class="btn btn-primary btn-sm" onclick="AdminPage.showCourseModal()">${UI.icons.plus} Täze</button></div>
            <table class="admin-table"><thead><tr><th>ID</th><th>Ady</th><th>Fakultet</th><th>Hereketler</th></tr></thead><tbody>
            ${all.map(c => `<tr><td>${c.id}</td><td>${UI.esc(c.name)}</td><td>${UI.esc(c.faculty_name)}</td><td>
                <button class="btn btn-sm btn-ghost" onclick="AdminPage.showCourseModal(${c.id},'${UI.esc(c.name)}',${c.faculty_id})">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="AdminPage.deleteCourse(${c.id})">🗑</button></td></tr>`).join('')}
            ${!all.length ? '<tr><td colspan="4" class="text-muted text-center">Ugur ýok</td></tr>' : ''}
            </tbody></table>`;
            this._faculties = facs;
        } catch (e) { el.innerHTML = `<p class="text-muted">${UI.esc(e.message)}</p>`; }
    },

    async showCourseModal(id, name, facId) {
        if (!this._faculties.length) try { this._faculties = (await API.admin.faculties.list()) || []; } catch {}
        const edit = !!id;
        const opts = this._faculties.map(f => `<option value="${f.id}" ${f.id === facId ? 'selected' : ''}>${UI.esc(f.name)}</option>`).join('');
        UI.showModal(edit ? 'Ugry üýtget' : 'Täze ugur',
            `<div class="form-group"><label>Fakultet</label><select id="course-faculty" class="form-control">${opts}</select></div>
             <div class="form-group"><label>Ady</label><input type="text" id="course-name" value="${name||''}" class="form-control" placeholder="Ugruň ady"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-primary" onclick="AdminPage.saveCourse(${id||'null'})">${edit ? 'Üýtget' : 'Döret'}</button>`);
    },
    async saveCourse(id) {
        const n = document.getElementById('course-name').value.trim(), fId = parseInt(document.getElementById('course-faculty').value);
        if (!n || !fId) { UI.toast('Ähli meýdanlary dolduryň', 'error'); return; }
        try { if (id) await API.admin.courses.update(id, n, fId); else await API.admin.courses.create(n, fId); UI.closeModal(); UI.toast(id ? 'Üýtgedildi' : 'Döredildi', 'success'); this.switchTab('courses'); } catch (e) { UI.toast(e.message, 'error'); }
    },
    async deleteCourse(id) {
        if (!confirm('Bu ugry pozmak isleýärsiňizmi?')) return;
        try { await API.admin.courses.delete(id); UI.toast('Pozuldy', 'success'); this.switchTab('courses'); } catch (e) { UI.toast(e.message, 'error'); }
    },

    /* ── Groups ── */
    async renderGroups(el) {
        try {
            const facs = (await API.admin.faculties.list()) || [];
            let all = [];
            for (const f of facs) { const cs = (await API.catalogs.courses(f.id)) || []; for (const c of cs) { const gs = await API.catalogs.groups(c.id); if (gs) all.push(...gs.map(g => ({ ...g, course_name: c.name, faculty_name: f.name }))); } }
            el.innerHTML = `
            <div class="admin-header"><h2>Toparlar</h2><div style="display:flex;gap:8px"><button class="btn btn-ghost btn-sm" onclick="AdminPage.showBulkGroupQuota()">📊 Kwota hemmesine</button><button class="btn btn-primary btn-sm" onclick="AdminPage.showGroupModal()">${UI.icons.plus} Täze</button></div></div>
            <table class="admin-table"><thead><tr><th>ID</th><th>Ady</th><th>Ugur</th><th>Fakultet</th><th>Kwota</th><th>Hereketler</th></tr></thead><tbody>
            ${all.map(g => `<tr><td>${g.id}</td><td>${UI.esc(g.name)}</td><td>${UI.esc(g.course_name)}</td><td>${UI.esc(g.faculty_name)}</td><td>${UI.formatBytes(g.quota_bytes || 0)}</td><td>
                <button class="btn btn-sm btn-ghost" onclick="AdminPage.showGroupModal(${g.id},'${UI.esc(g.name)}',${g.course_id},${g.quota_bytes||0})">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="AdminPage.deleteGroup(${g.id})">🗑</button></td></tr>`).join('')}
            ${!all.length ? '<tr><td colspan="6" class="text-muted text-center">Topar ýok</td></tr>' : ''}
            </tbody></table>`;
        } catch (e) { el.innerHTML = `<p class="text-muted">${UI.esc(e.message)}</p>`; }
    },

    async showGroupModal(id, name, courseId, quotaBytes) {
        let facs = []; try { facs = (await API.admin.faculties.list()) || []; } catch {}
        const edit = !!id;
        const quotaMB = Math.round((quotaBytes || 5368709120) / (1024 * 1024));
        const fOpts = facs.map(f => `<option value="${f.id}">${UI.esc(f.name)}</option>`).join('');
        UI.showModal(edit ? 'Topary üýtget' : 'Täze topar',
            `<div class="form-group"><label>Fakultet</label><select id="grp-faculty" class="form-control" onchange="AdminPage.onGroupFacultyChange()"><option value="">Saýlaň…</option>${fOpts}</select></div>
             <div class="form-group"><label>Ugur</label><select id="grp-course" class="form-control" disabled><option value="">Ilki fakultet saýlaň</option></select></div>
             <div class="form-group"><label>Ady</label><input type="text" id="grp-name" value="${name||''}" class="form-control" placeholder="Topar ady"></div>
             <div class="form-group"><label>Kwota (MB)</label><input type="number" id="grp-quota" value="${quotaMB}" class="form-control" min="1"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-primary" onclick="AdminPage.saveGroup(${id||'null'})">${edit ? 'Üýtget' : 'Döret'}</button>`);
    },
    async onGroupFacultyChange() {
        const fId = document.getElementById('grp-faculty').value, cEl = document.getElementById('grp-course');
        cEl.innerHTML = '<option value="">Ugur saýlaň…</option>';
        if (!fId) { cEl.disabled = true; return; }
        cEl.disabled = false;
        try { const cs = (await API.catalogs.courses(fId)) || []; cs.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; cEl.appendChild(o); }); } catch { cEl.disabled = true; }
    },
    async saveGroup(id) {
        const n = document.getElementById('grp-name').value.trim(), cId = parseInt(document.getElementById('grp-course').value);
        const quotaMB = parseInt(document.getElementById('grp-quota').value) || 5120;
        const quotaBytes = quotaMB * 1024 * 1024;
        if (!n || !cId) { UI.toast('Ähli meýdanlary dolduryň', 'error'); return; }
        try { if (id) await API.admin.groups.update(id, n, quotaBytes); else await API.admin.groups.create(n, cId, quotaBytes); UI.closeModal(); UI.toast(id ? 'Üýtgedildi' : 'Döredildi', 'success'); this.switchTab('groups'); } catch (e) { UI.toast(e.message, 'error'); }
    },
    async deleteGroup(id) {
        if (!confirm('Bu topary pozmak isleýärsiňizmi?')) return;
        try { await API.admin.groups.delete(id); UI.toast('Pozuldy', 'success'); this.switchTab('groups'); } catch (e) { UI.toast(e.message, 'error'); }
    },

    /* ── Users ── */
    async renderUsers(el) {
        try {
            const users = (await API.admin.users.list()) || [];
            el.innerHTML = `
            <div class="admin-header"><h2>Ulanyjylar</h2>
                <div style="display:flex;gap:8px;align-items:center">
                    <input type="text" id="admin-user-search" class="form-control" placeholder="Gözle…" style="width:200px" oninput="AdminPage.filterUsers(this.value)">
                    <button class="btn btn-ghost btn-sm" onclick="AdminPage.showBulkUserQuota()">📊 Kwota hemmesine</button>
                    <button class="btn btn-danger btn-sm" onclick="AdminPage.confirmDeleteAllUsers()">🗑 Hemmesini poz</button>
                    <button class="btn btn-ghost btn-sm" onclick="AdminPage.showImportModal()">📥 Import</button>
                    <button class="btn btn-primary btn-sm" onclick="AdminPage.showCreateUserModal()">${UI.icons.plus} Täze</button>
                </div>
            </div>
            <table class="admin-table" id="admin-users-table"><thead><tr><th>ID</th><th>Ady</th><th>Ulanyjy ady</th><th>Rol</th><th>Kwota</th><th>Hereketler</th></tr></thead><tbody>
            ${users.map(u => `<tr data-uid="${u.id}"><td>${u.id}</td><td>${UI.esc(u.full_name)}</td><td>@${UI.esc(u.username)}</td>
                <td><span class="badge badge-${u.role === 'admin' ? 'admin' : 'user'}">${u.role === 'admin' ? 'Admin' : 'Ulanyjy'}</span></td>
                <td>${UI.formatBytes(u.quota_bytes || 0)}</td>
                <td><button class="btn btn-sm btn-ghost" onclick="AdminPage.showEditUserModal(${u.id})">✏️</button>
                ${u.role !== 'admin' ? `<button class="btn btn-sm btn-danger" onclick="AdminPage.deleteUser(${u.id})">🗑</button>` : ''}</td></tr>`).join('')}
            ${!users.length ? '<tr><td colspan="6" class="text-muted text-center">Ulanyjy ýok</td></tr>' : ''}
            </tbody></table>`;
            this._users = users;
        } catch (e) { el.innerHTML = `<p class="text-muted">${UI.esc(e.message)}</p>`; }
    },

    filterUsers(q) {
        const lc = q.toLowerCase();
        document.querySelectorAll('#admin-users-table tbody tr').forEach(r => { r.style.display = r.textContent.toLowerCase().includes(lc) ? '' : 'none'; });
    },

    async showCreateUserModal() {
        let facs = []; try { facs = (await API.admin.faculties.list()) || []; } catch {}
        const fOpts = facs.map(f => `<option value="${f.id}">${UI.esc(f.name)}</option>`).join('');
        UI.showModal('Täze ulanyjy', `
            <div class="form-group"><label>Doly ady</label><input type="text" id="nu-name" class="form-control" placeholder="Ady we familiýasy"></div>
            <div class="form-group"><label>Ulanyjy ady</label><input type="text" id="nu-username" class="form-control" placeholder="username"></div>
            <div class="form-group"><label>Parol</label>${UI.passwordField('nu-password', 'Azyndan 6 simwol')}</div>
            <div class="form-group"><label>Rol</label><select id="nu-role" class="form-control"><option value="user">Ulanyjy</option><option value="admin">Admin</option></select></div>
            <div class="form-group"><label>Kwota (MB)</label><input type="number" id="nu-quota" class="form-control" value="10240" min="0"></div>
            <div class="form-group"><label>Fakultet</label><select id="nu-faculty" class="form-control" onchange="AdminPage.onNewUserFacultyChange()"><option value="">Saýlaň…</option>${fOpts}</select></div>
            <div class="form-group"><label>Ugur</label><select id="nu-course" class="form-control" disabled><option value="">Ilki fakultet saýlaň</option></select></div>
            <div class="form-group"><label>Topar</label><select id="nu-group" class="form-control" disabled><option value="">Ilki ugur saýlaň</option></select></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyr</button><button class="btn btn-primary" onclick="AdminPage.doCreateUser()">Döret</button>`);
    },

    async onNewUserFacultyChange() {
        const fId = document.getElementById('nu-faculty').value;
        const cEl = document.getElementById('nu-course'), gEl = document.getElementById('nu-group');
        cEl.innerHTML = '<option value="">Ugur saýlaň…</option>'; cEl.disabled = true;
        gEl.innerHTML = '<option value="">Ilki ugur saýlaň</option>'; gEl.disabled = true;
        if (!fId) return;
        try { const cs = (await API.catalogs.courses(fId)) || []; cEl.disabled = false; cs.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; cEl.appendChild(o); }); } catch {}
        cEl.onchange = async () => {
            gEl.innerHTML = '<option value="">Topar saýlaň…</option>'; gEl.disabled = true;
            const cId = cEl.value; if (!cId) return;
            try { const gs = (await API.catalogs.groups(cId)) || []; gEl.disabled = false; gs.forEach(g => { const o = document.createElement('option'); o.value = g.id; o.textContent = g.name; gEl.appendChild(o); }); } catch {}
        };
    },

    async doCreateUser() {
        const name = document.getElementById('nu-name').value.trim();
        const username = document.getElementById('nu-username').value.trim();
        const password = document.getElementById('nu-password').value;
        const role = document.getElementById('nu-role').value;
        const quotaMB = parseInt(document.getElementById('nu-quota').value) || 0;
        const facultyId = parseInt(document.getElementById('nu-faculty').value) || 0;
        const courseId = parseInt(document.getElementById('nu-course').value) || 0;
        const groupId = parseInt(document.getElementById('nu-group').value) || 0;
        if (!name || !username || !password) { UI.toast('Ähli meýdanlary dolduryň', 'error'); return; }
        try {
            await API.admin.users.create({ full_name: name, username, password, role, quota_mb: quotaMB, faculty_id: facultyId, course_id: courseId, group_id: groupId });
            UI.closeModal(); UI.toast('Ulanyjy döredildi', 'success'); this.switchTab('users');
        } catch (e) { UI.toast(e.message, 'error'); }
    },

    showEditUserModal(id) {
        const u = this._users.find(x => x.id === id); if (!u) return;
        const mb = Math.round((u.quota_bytes || 0) / (1024 * 1024));
        UI.showModal('Ulanyjyny üýtget', `
            <div class="form-group"><label>Doly ady</label><input type="text" id="eu-name" value="${UI.esc(u.full_name)}" class="form-control"></div>
            <div class="form-group"><label>Täze parol</label>${UI.passwordField('eu-password', 'Boş goýsaň üýtgemez')}</div>
            <div class="form-group"><label>Rol</label><select id="eu-role" class="form-control"><option value="user" ${u.role==='user'?'selected':''}>Ulanyjy</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select></div>
            <div class="form-group"><label>Kwota (MB)</label><input type="number" id="eu-quota" value="${mb}" class="form-control" min="0"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyr</button><button class="btn btn-primary" onclick="AdminPage.saveUser(${id})">Ýatda sakla</button>`);
    },
    async saveUser(id) {
        const role = document.getElementById('eu-role').value;
        const mb = parseInt(document.getElementById('eu-quota').value) || 0;
        const name = document.getElementById('eu-name').value.trim();
        const password = document.getElementById('eu-password').value;
        const data = { role, quota_bytes: mb * 1024 * 1024 };
        if (name) data.display_name = name;
        if (password) data.password = password;
        try { await API.admin.users.update(id, data); UI.closeModal(); UI.toast('Üýtgedildi', 'success'); this.switchTab('users'); } catch (e) { UI.toast(e.message, 'error'); }
    },
    async deleteUser(id) {
        if (!confirm('Bu ulanyjyny pozmak isleýärsiňizmi?')) return;
        try { await API.admin.users.delete(id); UI.toast('Pozuldy', 'success'); this.switchTab('users'); } catch (e) { UI.toast(e.message, 'error'); }
    },

    confirmDeleteAllUsers() {
        UI.showModal('Ähli ulanyjylary pozmak', `
            <p style="color:var(--danger);font-weight:600">⚠️ Bu ähli ulanyjylary (admin-den başga) pozar!</p>
            <p class="text-muted" style="font-size:.85rem">Bu hereket yzyna gaýtaryp bolmaz. Tassyklamak üçin aşakda "POZMAK" ýazyň.</p>
            <div class="form-group"><input type="text" id="confirm-delete-all" class="form-control" placeholder='POZMAK ýazyň'></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyr</button><button class="btn btn-danger" onclick="AdminPage.doDeleteAllUsers()">Hemmesini poz</button>`);
    },
    async doDeleteAllUsers() {
        if (document.getElementById('confirm-delete-all').value.trim() !== 'POZMAK') { UI.toast('Tassyklamak üçin "POZMAK" ýazyň', 'error'); return; }
        try { const res = await API.admin.users.deleteAll(); UI.closeModal(); UI.toast(`${res.deleted} ulanyjy pozuldy`, 'success'); this.switchTab('users'); }
        catch (e) { UI.toast(e.message, 'error'); }
    },

    showBulkUserQuota() {
        UI.showModal('Ähli ulanyjylaryň kwotasy', `
            <div class="form-group"><label>Täze kwota (MB)</label><input type="number" id="bulk-user-quota" class="form-control" value="10240" min="1"></div>
            <p class="text-muted" style="font-size:.78rem">Bu ähli ulanyjylaryň (admin-den başga) kwotasyny üýtgeder.</p>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyr</button><button class="btn btn-primary" onclick="AdminPage.doBulkUserQuota()">Üýtget</button>`);
    },
    async doBulkUserQuota() {
        const mb = parseInt(document.getElementById('bulk-user-quota').value) || 0;
        if (mb <= 0) { UI.toast('Dogry kwota giriziň', 'error'); return; }
        try { await API.admin.users.bulkQuota(mb); UI.closeModal(); UI.toast('Ähli ulanyjylaryň kwotasy üýtgedildi', 'success'); this.switchTab('users'); } catch (e) { UI.toast(e.message, 'error'); }
    },

    showBulkGroupQuota() {
        UI.showModal('Ähli toparlaryň kwotasy', `
            <div class="form-group"><label>Täze kwota (MB)</label><input type="number" id="bulk-group-quota" class="form-control" value="51200" min="1"></div>
            <p class="text-muted" style="font-size:.78rem">Bu ähli toparlaryň kwotasyny üýtgeder.</p>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyr</button><button class="btn btn-primary" onclick="AdminPage.doBulkGroupQuota()">Üýtget</button>`);
    },
    async doBulkGroupQuota() {
        const mb = parseInt(document.getElementById('bulk-group-quota').value) || 0;
        if (mb <= 0) { UI.toast('Dogry kwota giriziň', 'error'); return; }
        try { await API.admin.groups.bulkQuota(mb); UI.closeModal(); UI.toast('Ähli toparlaryň kwotasy üýtgedildi', 'success'); this.switchTab('groups'); } catch (e) { UI.toast(e.message, 'error'); }
    },

    showImportModal() {
        UI.showModal('Ulanyjylary import etmek', `
            <p class="text-muted" style="font-size:.82rem;margin-bottom:12px">CSV ýa-da XLSX faýly ýükläň. Faýl formaty:<br>
            <code style="font-size:.75rem">username, password, full_name, faculty_id, course_id, group_id, quota_mb</code></p>
            <div class="form-group">
                <input type="file" id="import-file" class="form-control" accept=".csv,.xlsx,.xls">
            </div>
            <div id="import-results" style="display:none;max-height:200px;overflow:auto;margin-top:8px"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyr</button><button class="btn btn-primary" id="import-btn" onclick="AdminPage.doImportUsers()">Import et</button>`);
    },

    async doImportUsers() {
        const fileInput = document.getElementById('import-file');
        const file = fileInput?.files[0];
        if (!file) { UI.toast('Faýl saýlaň', 'error'); return; }
        const btn = document.getElementById('import-btn');
        btn.disabled = true; btn.textContent = 'Ýüklenýär…';
        try {
            const result = await API.admin.users.importFile(file);
            const el = document.getElementById('import-results');
            el.style.display = 'block';
            let html = `<p style="font-weight:600;margin-bottom:6px">Netije: ${result.created}/${result.total} döredildi</p>`;
            if (result.results) {
                html += '<div style="font-size:.78rem">';
                result.results.forEach(r => {
                    html += `<div style="padding:2px 0;color:${r.success ? 'var(--success)' : 'var(--danger)'}">${UI.esc(r.username)}: ${r.success ? '✓ döredildi' : '✕ ' + UI.esc(r.error)}</div>`;
                });
                html += '</div>';
            }
            el.innerHTML = html;
            if (result.created > 0) this.switchTab('users');
        } catch (e) { UI.toast(e.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Import et'; }
    },

    /* ── Group Files ── */
    async renderGroupFiles(el) {
        try {
            const facs = (await API.admin.faculties.list()) || [];
            const st = this._adminGroupFiles;
            const fOpts = facs.map(f => `<option value="${f.id}">${UI.esc(f.name)}</option>`).join('');
            el.innerHTML = `
            <div class="admin-header"><h2>Topar faýllary</h2></div>
            <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:end">
                <div class="form-group" style="margin:0"><label style="font-size:.78rem">Fakultet</label><select id="gf-faculty" class="form-control" style="width:180px" onchange="AdminPage.onGfFacultyChange()"><option value="">Saýlaň…</option>${fOpts}</select></div>
                <div class="form-group" style="margin:0"><label style="font-size:.78rem">Ugur</label><select id="gf-course" class="form-control" style="width:180px" disabled><option value="">Ilki fakultet saýlaň</option></select></div>
                <div class="form-group" style="margin:0"><label style="font-size:.78rem">Topar</label><select id="gf-group" class="form-control" style="width:180px" disabled><option value="">Ilki ugur saýlaň</option></select></div>
            </div>
            <div id="gf-actions" style="display:none;margin-bottom:12px">
                <button class="btn btn-primary btn-sm" onclick="document.getElementById('gf-file-input').click()">${UI.icons.upload} Faýl ýükle</button>
                <button class="btn btn-ghost btn-sm" onclick="AdminPage.showGfNewFolder()">${UI.icons.plus} Täze papka</button>
                <input type="file" id="gf-file-input" multiple style="display:none" onchange="AdminPage.gfUploadFiles(this.files)">
            </div>
            <div id="gf-breadcrumbs" class="breadcrumbs" style="margin-bottom:8px"></div>
            <div id="gf-upload-progress" class="upload-progress hidden"></div>
            <div id="gf-content"><p class="text-muted">Topary saýlaň</p></div>`;
        } catch (e) { el.innerHTML = `<p class="text-muted">${UI.esc(e.message)}</p>`; }
    },

    async onGfFacultyChange() {
        const fId = document.getElementById('gf-faculty').value;
        const cEl = document.getElementById('gf-course'), gEl = document.getElementById('gf-group');
        cEl.innerHTML = '<option value="">Ugur saýlaň…</option>'; cEl.disabled = true;
        gEl.innerHTML = '<option value="">Ilki ugur saýlaň</option>'; gEl.disabled = true;
        document.getElementById('gf-actions').style.display = 'none';
        document.getElementById('gf-content').innerHTML = '<p class="text-muted">Topary saýlaň</p>';
        if (!fId) return;
        try {
            const cs = (await API.catalogs.courses(fId)) || [];
            cEl.disabled = false;
            cs.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; cEl.appendChild(o); });
        } catch {}
        cEl.onchange = () => this.onGfCourseChange();
    },

    async onGfCourseChange() {
        const cId = document.getElementById('gf-course').value;
        const gEl = document.getElementById('gf-group');
        gEl.innerHTML = '<option value="">Topar saýlaň…</option>'; gEl.disabled = true;
        document.getElementById('gf-actions').style.display = 'none';
        document.getElementById('gf-content').innerHTML = '<p class="text-muted">Topary saýlaň</p>';
        if (!cId) return;
        try {
            const gs = (await API.catalogs.groups(cId)) || [];
            gEl.disabled = false;
            gs.forEach(g => { const o = document.createElement('option'); o.value = g.id; o.textContent = g.name; gEl.appendChild(o); });
        } catch {}
        gEl.onchange = () => this.onGfGroupChange();
    },

    async onGfGroupChange() {
        const gId = parseInt(document.getElementById('gf-group').value);
        if (!gId) {
            document.getElementById('gf-actions').style.display = 'none';
            document.getElementById('gf-content').innerHTML = '<p class="text-muted">Topary saýlaň</p>';
            return;
        }
        this._adminGroupFiles.groupId = gId;
        this._adminGroupFiles.folderId = null;
        document.getElementById('gf-actions').style.display = '';
        await this.loadGfFiles();
    },

    async loadGfFiles() {
        const st = this._adminGroupFiles;
        const c = document.getElementById('gf-content');
        if (!c || !st.groupId) return;
        c.innerHTML = UI.skeletonCards(4);
        try {
            let url = `/api/files?scope=group&group_id=${st.groupId}`;
            if (st.folderId) url += `&folder_id=${st.folderId}`;
            const data = await API._request('GET', url);
            st.files = data.files || [];
            st.folders = data.folders || [];
            st.breadcrumbs = data.breadcrumbs || [];
            this.renderGfBreadcrumbs();
            this.renderGfFileList(c);
        } catch (e) { c.innerHTML = `<p class="text-muted">${UI.esc(e.message)}</p>`; }
    },

    renderGfBreadcrumbs() {
        const el = document.getElementById('gf-breadcrumbs');
        if (!el) return;
        let h = `<a class="breadcrumb-item" onclick="AdminPage._adminGroupFiles.folderId=null;AdminPage.loadGfFiles()">Topar</a>`;
        for (const b of this._adminGroupFiles.breadcrumbs) {
            h += `<span class="breadcrumb-sep">/</span><a class="breadcrumb-item" onclick="AdminPage._adminGroupFiles.folderId=${b.id};AdminPage.loadGfFiles()">${UI.esc(b.name)}</a>`;
        }
        el.innerHTML = h;
    },

    renderGfFileList(c) {
        const st = this._adminGroupFiles;
        const items = [...st.folders.map(f => ({ ...f, isFolder: true })), ...st.files];
        if (!items.length) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📂</div><p>Bu ýerde faýl ýok</p></div>'; return; }
        c.innerHTML = '<div class="file-grid">' + items.map(i => {
            const icon = UI.fileIcon(i.name, i.isFolder);
            const cls = UI.fileIconClass(i.name, i.isFolder);
            let dbl = i.isFolder ? `AdminPage._adminGroupFiles.folderId=${i.id};AdminPage.loadGfFiles()` : `FilesPage.download(${i.id},'${UI.esc(i.name)}')`;
            if (!i.isFolder && UI.isMediaPreviewable(i.name)) dbl = `PreviewPage.open(${i.id},'${UI.esc(i.name)}')`;
            else if (!i.isFolder && UI.isCollaboraViewable(i.name)) dbl = `EditorPage.open(${i.id},'${UI.esc(i.name)}')`;
            return `<div class="file-card" ondblclick="${dbl}" oncontextmenu="AdminPage.showGfMenu(event,${JSON.stringify(i).replace(/"/g,'&quot;')})">
                <div class="file-card-icon ${cls}">${icon}</div>
                <div class="file-card-name" title="${UI.esc(i.name)}">${UI.esc(i.name)}</div>
                ${!i.isFolder ? `<div class="file-card-meta">${UI.formatBytes(i.size_bytes||0)}</div>` : '<div class="file-card-meta">Papka</div>'}
            </div>`;
        }).join('') + '</div>';
    },

    showGfMenu(e, item) {
        e.preventDefault(); e.stopPropagation();
        const items = [];
        if (item.isFolder) {
            items.push({ action: 'open', label: 'Aç', icon: '📂', handler: () => { this._adminGroupFiles.folderId = item.id; this.loadGfFiles(); } });
            items.push({ action: 'rename', label: 'Adyny üýtget', icon: '✏️', handler: () => this.gfRenameFolder(item) });
            items.push({ divider: true });
            items.push({ action: 'delete', label: 'Poz', icon: '🗑', danger: true, handler: () => this.gfDeleteFolder(item) });
        } else {
            items.push({ action: 'download', label: 'Ýükle', icon: '📥', handler: () => FilesPage.download(item.id, item.name) });
            items.push({ action: 'rename', label: 'Adyny üýtget', icon: '✏️', handler: () => this.gfRenameFile(item) });
            items.push({ divider: true });
            items.push({ action: 'delete', label: 'Poz', icon: '🗑', danger: true, handler: () => this.gfDeleteFile(item) });
        }
        UI.showContextMenu(e.clientX, e.clientY, items);
    },

    async gfUploadFiles(fileList) {
        if (!fileList.length || !this._adminGroupFiles.groupId) return;
        const prog = document.getElementById('gf-upload-progress');
        prog.classList.remove('hidden');
        for (const file of fileList) {
            const id = 'gfu-' + Math.random().toString(36).substr(2, 6);
            prog.innerHTML += `<div class="upload-item" id="${id}"><div class="upload-item-name">${UI.esc(file.name)}</div><div class="upload-item-bar"><div class="upload-item-fill" id="${id}-f"></div></div><div class="upload-item-pct" id="${id}-p">0%</div></div>`;
            try {
                const form = new FormData();
                form.append('file', file);
                form.append('scope', 'group');
                form.append('group_id', String(this._adminGroupFiles.groupId));
                if (this._adminGroupFiles.folderId) form.append('folder_id', String(this._adminGroupFiles.folderId));
                await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/api/files/upload');
                    xhr.withCredentials = true;
                    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) { const pct = Math.round(ev.loaded / ev.total * 100); const f = document.getElementById(id+'-f'), p = document.getElementById(id+'-p'); if (f) f.style.width = pct+'%'; if (p) p.textContent = pct+'%'; } };
                    xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) resolve(); else { try { reject(new Error(JSON.parse(xhr.responseText).error)); } catch { reject(new Error('Ýükläp bolmady')); } } };
                    xhr.onerror = () => reject(new Error('Tor näsazlygy'));
                    xhr.send(form);
                });
                document.getElementById(id)?.classList.add('upload-done');
            } catch (err) {
                UI.toast(`"${file.name}": ${err.message}`, 'error');
                document.getElementById(id)?.classList.add('upload-error');
            }
        }
        setTimeout(() => { prog.innerHTML = ''; prog.classList.add('hidden'); }, 2000);
        this.loadGfFiles();
        document.getElementById('gf-file-input').value = '';
    },

    showGfNewFolder() {
        UI.showModal('Täze papka', `<div class="form-group"><label>Papkanyň ady</label><input type="text" id="gf-folder-name" class="form-control" placeholder="Papka ady"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-primary" onclick="AdminPage.doGfCreateFolder()">Döret</button>`);
    },
    async doGfCreateFolder() {
        const n = document.getElementById('gf-folder-name').value.trim(); if (!n) return;
        try { await API.folders.create(n, 'group', this._adminGroupFiles.folderId, this._adminGroupFiles.groupId); UI.closeModal(); UI.toast('Papka döredildi', 'success'); this.loadGfFiles(); } catch (e) { UI.toast(e.message, 'error'); }
    },
    gfRenameFile(item) {
        UI.showModal('Adyny üýtget', `<div class="form-group"><label>Täze ady</label><input type="text" id="gf-rename" value="${UI.esc(item.name)}" class="form-control"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-primary" onclick="AdminPage.doGfRenameFile(${item.id})">Üýtget</button>`);
    },
    async doGfRenameFile(id) { const n = document.getElementById('gf-rename').value.trim(); if (!n) return; try { await API.files.rename(id, n); UI.closeModal(); UI.toast('Üýtgedildi', 'success'); this.loadGfFiles(); } catch (e) { UI.toast(e.message, 'error'); } },
    gfRenameFolder(item) {
        UI.showModal('Papkanyň adyny üýtget', `<div class="form-group"><label>Täze ady</label><input type="text" id="gf-rename" value="${UI.esc(item.name)}" class="form-control"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-primary" onclick="AdminPage.doGfRenameFolder(${item.id})">Üýtget</button>`);
    },
    async doGfRenameFolder(id) { const n = document.getElementById('gf-rename').value.trim(); if (!n) return; try { await API.folders.rename(id, n); UI.closeModal(); UI.toast('Üýtgedildi', 'success'); this.loadGfFiles(); } catch (e) { UI.toast(e.message, 'error'); } },
    async gfDeleteFile(item) {
        if (!confirm(`"${item.name}" faýlyny pozmak isleýärsiňizmi?`)) return;
        try { await API.files.delete(item.id); UI.toast('Pozuldy', 'success'); this.loadGfFiles(); } catch (e) { UI.toast(e.message, 'error'); }
    },
    async gfDeleteFolder(item) {
        if (!confirm(`"${item.name}" papkasyny pozmak isleýärsiňizmi?`)) return;
        try { await API.folders.delete(item.id); UI.toast('Pozuldy', 'success'); this.loadGfFiles(); } catch (e) { UI.toast(e.message, 'error'); }
    },

    /* ── Public Files ── */
    async renderPublicFiles(el) {
        el.innerHTML = `
        <div class="admin-header"><h2>Umumy faýllar</h2></div>
        <div style="margin-bottom:12px">
            <button class="btn btn-primary btn-sm" onclick="document.getElementById('pf-file-input').click()">${UI.icons.upload} Faýl ýükle</button>
            <button class="btn btn-ghost btn-sm" onclick="AdminPage.showPfNewFolder()">${UI.icons.plus} Täze papka</button>
            <input type="file" id="pf-file-input" multiple style="display:none" onchange="AdminPage.pfUploadFiles(this.files)">
        </div>
        <div id="pf-breadcrumbs" class="breadcrumbs" style="margin-bottom:8px"></div>
        <div id="pf-upload-progress" class="upload-progress hidden"></div>
        <div id="pf-content">${UI.skeletonCards(4)}</div>`;
        await this.loadPfFiles();
    },

    async loadPfFiles() {
        const st = this._adminPublicFiles;
        const c = document.getElementById('pf-content');
        if (!c) return;
        c.innerHTML = UI.skeletonCards(4);
        try {
            let url = `/api/files?scope=public`;
            if (st.folderId) url += `&folder_id=${st.folderId}`;
            const data = await API._request('GET', url);
            st.files = data.files || [];
            st.folders = data.folders || [];
            st.breadcrumbs = data.breadcrumbs || [];
            this.renderPfBreadcrumbs();
            this.renderPfFileList(c);
        } catch (e) { c.innerHTML = `<p class="text-muted">${UI.esc(e.message)}</p>`; }
    },

    renderPfBreadcrumbs() {
        const el = document.getElementById('pf-breadcrumbs');
        if (!el) return;
        let h = `<a class="breadcrumb-item" onclick="AdminPage._adminPublicFiles.folderId=null;AdminPage.loadPfFiles()">Umumy</a>`;
        for (const b of this._adminPublicFiles.breadcrumbs) {
            h += `<span class="breadcrumb-sep">/</span><a class="breadcrumb-item" onclick="AdminPage._adminPublicFiles.folderId=${b.id};AdminPage.loadPfFiles()">${UI.esc(b.name)}</a>`;
        }
        el.innerHTML = h;
    },

    renderPfFileList(c) {
        const st = this._adminPublicFiles;
        const items = [...st.folders.map(f => ({ ...f, isFolder: true })), ...st.files];
        if (!items.length) { c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📂</div><p>Bu ýerde faýl ýok</p></div>'; return; }
        c.innerHTML = '<div class="file-grid">' + items.map(i => {
            const icon = UI.fileIcon(i.name, i.isFolder);
            const cls = UI.fileIconClass(i.name, i.isFolder);
            let dbl = i.isFolder ? `AdminPage._adminPublicFiles.folderId=${i.id};AdminPage.loadPfFiles()` : `FilesPage.download(${i.id},'${UI.esc(i.name)}')`;
            if (!i.isFolder && UI.isMediaPreviewable(i.name)) dbl = `PreviewPage.open(${i.id},'${UI.esc(i.name)}')`;
            else if (!i.isFolder && UI.isCollaboraViewable(i.name)) dbl = `EditorPage.open(${i.id},'${UI.esc(i.name)}')`;
            return `<div class="file-card" ondblclick="${dbl}" oncontextmenu="AdminPage.showPfMenu(event,${JSON.stringify(i).replace(/"/g,'&quot;')})">
                <div class="file-card-icon ${cls}">${icon}</div>
                <div class="file-card-name" title="${UI.esc(i.name)}">${UI.esc(i.name)}</div>
                ${!i.isFolder ? `<div class="file-card-meta">${UI.formatBytes(i.size_bytes||0)}</div>` : '<div class="file-card-meta">Papka</div>'}
            </div>`;
        }).join('') + '</div>';
    },

    showPfMenu(e, item) {
        e.preventDefault(); e.stopPropagation();
        const items = [];
        if (item.isFolder) {
            items.push({ action: 'open', label: 'Aç', icon: '📂', handler: () => { this._adminPublicFiles.folderId = item.id; this.loadPfFiles(); } });
            items.push({ action: 'rename', label: 'Adyny üýtget', icon: '✏️', handler: () => this.pfRenameFolder(item) });
            items.push({ divider: true });
            items.push({ action: 'delete', label: 'Poz', icon: '🗑', danger: true, handler: () => this.pfDeleteFolder(item) });
        } else {
            items.push({ action: 'download', label: 'Ýükle', icon: '📥', handler: () => FilesPage.download(item.id, item.name) });
            items.push({ action: 'rename', label: 'Adyny üýtget', icon: '✏️', handler: () => this.pfRenameFile(item) });
            items.push({ divider: true });
            items.push({ action: 'delete', label: 'Poz', icon: '🗑', danger: true, handler: () => this.pfDeleteFile(item) });
        }
        UI.showContextMenu(e.clientX, e.clientY, items);
    },

    async pfUploadFiles(fileList) {
        if (!fileList.length) return;
        const prog = document.getElementById('pf-upload-progress');
        prog.classList.remove('hidden');
        for (const file of fileList) {
            const id = 'pfu-' + Math.random().toString(36).substr(2, 6);
            prog.innerHTML += `<div class="upload-item" id="${id}"><div class="upload-item-name">${UI.esc(file.name)}</div><div class="upload-item-bar"><div class="upload-item-fill" id="${id}-f"></div></div><div class="upload-item-pct" id="${id}-p">0%</div></div>`;
            try {
                const form = new FormData();
                form.append('file', file);
                form.append('scope', 'public');
                if (this._adminPublicFiles.folderId) form.append('folder_id', String(this._adminPublicFiles.folderId));
                await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/api/files/upload');
                    xhr.withCredentials = true;
                    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) { const pct = Math.round(ev.loaded / ev.total * 100); const f = document.getElementById(id+'-f'), p = document.getElementById(id+'-p'); if (f) f.style.width = pct+'%'; if (p) p.textContent = pct+'%'; } };
                    xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) resolve(); else { try { reject(new Error(JSON.parse(xhr.responseText).error)); } catch { reject(new Error('Ýükläp bolmady')); } } };
                    xhr.onerror = () => reject(new Error('Tor näsazlygy'));
                    xhr.send(form);
                });
                document.getElementById(id)?.classList.add('upload-done');
            } catch (err) {
                UI.toast(`"${file.name}": ${err.message}`, 'error');
                document.getElementById(id)?.classList.add('upload-error');
            }
        }
        setTimeout(() => { prog.innerHTML = ''; prog.classList.add('hidden'); }, 2000);
        this.loadPfFiles();
        document.getElementById('pf-file-input').value = '';
    },

    showPfNewFolder() {
        UI.showModal('Täze papka', `<div class="form-group"><label>Papkanyň ady</label><input type="text" id="pf-folder-name" class="form-control" placeholder="Papka ady"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-primary" onclick="AdminPage.doPfCreateFolder()">Döret</button>`);
    },
    async doPfCreateFolder() {
        const n = document.getElementById('pf-folder-name').value.trim(); if (!n) return;
        try { await API.folders.create(n, 'public', this._adminPublicFiles.folderId); UI.closeModal(); UI.toast('Papka döredildi', 'success'); this.loadPfFiles(); } catch (e) { UI.toast(e.message, 'error'); }
    },
    pfRenameFile(item) {
        UI.showModal('Adyny üýtget', `<div class="form-group"><label>Täze ady</label><input type="text" id="pf-rename" value="${UI.esc(item.name)}" class="form-control"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-primary" onclick="AdminPage.doPfRenameFile(${item.id})">Üýtget</button>`);
    },
    async doPfRenameFile(id) { const n = document.getElementById('pf-rename').value.trim(); if (!n) return; try { await API.files.rename(id, n); UI.closeModal(); UI.toast('Üýtgedildi', 'success'); this.loadPfFiles(); } catch (e) { UI.toast(e.message, 'error'); } },
    pfRenameFolder(item) {
        UI.showModal('Papkanyň adyny üýtget', `<div class="form-group"><label>Täze ady</label><input type="text" id="pf-rename" value="${UI.esc(item.name)}" class="form-control"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-primary" onclick="AdminPage.doPfRenameFolder(${item.id})">Üýtget</button>`);
    },
    async doPfRenameFolder(id) { const n = document.getElementById('pf-rename').value.trim(); if (!n) return; try { await API.folders.rename(id, n); UI.closeModal(); UI.toast('Üýtgedildi', 'success'); this.loadPfFiles(); } catch (e) { UI.toast(e.message, 'error'); } },
    async pfDeleteFile(item) {
        if (!confirm(`"${item.name}" faýlyny pozmak isleýärsiňizmi?`)) return;
        try { await API.files.delete(item.id); UI.toast('Pozuldy', 'success'); this.loadPfFiles(); } catch (e) { UI.toast(e.message, 'error'); }
    },
    async pfDeleteFolder(item) {
        if (!confirm(`"${item.name}" papkasyny pozmak isleýärsiňizmi?`)) return;
        try { await API.folders.delete(item.id); UI.toast('Pozuldy', 'success'); this.loadPfFiles(); } catch (e) { UI.toast(e.message, 'error'); }
    }
};

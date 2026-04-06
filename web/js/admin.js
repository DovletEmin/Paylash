/* Paylash — Admin Panel */
const AdminPage = {
    currentTab: 'dashboard',
    _faculties: [],
    _users: [],

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
                </nav>
            </div>
            <div class="admin-content" id="admin-content"></div>
        </div>`;
    },

    async init() { await this.switchTab(this.currentTab); },

    async switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.admin-nav-item').forEach((el, i) => {
            el.classList.toggle('active', ['dashboard','faculties','courses','groups','users'][i] === tab);
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
        }
    },

    /* ── Dashboard ── */
    async renderDashboard(el) {
        try {
            const d = await API.admin.dashboard();
            el.innerHTML = `
            <h2 style="font-size:1.1rem;font-weight:600;margin-bottom:16px">Statistika</h2>
            <div class="stat-cards">
                <div class="stat-card"><div class="stat-card-value">${d.total_users || 0}</div><div class="stat-card-label">Ulanyjylar</div></div>
                <div class="stat-card"><div class="stat-card-value">${d.total_files || 0}</div><div class="stat-card-label">Faýllar</div></div>
                <div class="stat-card"><div class="stat-card-value">${d.total_faculties || 0}</div><div class="stat-card-label">Fakultetler</div></div>
                <div class="stat-card"><div class="stat-card-value">${d.total_courses || 0}</div><div class="stat-card-label">Ugurlar</div></div>
                <div class="stat-card"><div class="stat-card-value">${d.total_groups || 0}</div><div class="stat-card-label">Toparlar</div></div>
                <div class="stat-card"><div class="stat-card-value">${UI.formatBytes(d.total_bytes || 0)}</div><div class="stat-card-label">Ulanylýan ýer</div></div>
            </div>`;
        } catch (e) { el.innerHTML = `<p class="text-muted">${UI.esc(e.message)}</p>`; }
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
            <div class="admin-header"><h2>Toparlar</h2><button class="btn btn-primary btn-sm" onclick="AdminPage.showGroupModal()">${UI.icons.plus} Täze</button></div>
            <table class="admin-table"><thead><tr><th>ID</th><th>Ady</th><th>Ugur</th><th>Fakultet</th><th>Hereketler</th></tr></thead><tbody>
            ${all.map(g => `<tr><td>${g.id}</td><td>${UI.esc(g.name)}</td><td>${UI.esc(g.course_name)}</td><td>${UI.esc(g.faculty_name)}</td><td>
                <button class="btn btn-sm btn-ghost" onclick="AdminPage.showGroupModal(${g.id},'${UI.esc(g.name)}',${g.course_id})">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="AdminPage.deleteGroup(${g.id})">🗑</button></td></tr>`).join('')}
            ${!all.length ? '<tr><td colspan="5" class="text-muted text-center">Topar ýok</td></tr>' : ''}
            </tbody></table>`;
        } catch (e) { el.innerHTML = `<p class="text-muted">${UI.esc(e.message)}</p>`; }
    },

    async showGroupModal(id, name, courseId) {
        let facs = []; try { facs = (await API.admin.faculties.list()) || []; } catch {}
        const edit = !!id;
        const fOpts = facs.map(f => `<option value="${f.id}">${UI.esc(f.name)}</option>`).join('');
        UI.showModal(edit ? 'Topary üýtget' : 'Täze topar',
            `<div class="form-group"><label>Fakultet</label><select id="grp-faculty" class="form-control" onchange="AdminPage.onGroupFacultyChange()"><option value="">Saýlaň…</option>${fOpts}</select></div>
             <div class="form-group"><label>Ugur</label><select id="grp-course" class="form-control" disabled><option value="">Ilki fakultet saýlaň</option></select></div>
             <div class="form-group"><label>Ady</label><input type="text" id="grp-name" value="${name||''}" class="form-control" placeholder="Topar ady"></div>`,
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
        if (!n || !cId) { UI.toast('Ähli meýdanlary dolduryň', 'error'); return; }
        try { if (id) await API.admin.groups.update(id, n, cId); else await API.admin.groups.create(n, cId); UI.closeModal(); UI.toast(id ? 'Üýtgedildi' : 'Döredildi', 'success'); this.switchTab('groups'); } catch (e) { UI.toast(e.message, 'error'); }
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
                <div class="admin-search"><input type="text" id="admin-user-search" class="form-control" placeholder="Gözle…" oninput="AdminPage.filterUsers(this.value)"></div>
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

    showEditUserModal(id) {
        const u = this._users.find(x => x.id === id); if (!u) return;
        const mb = Math.round((u.quota_bytes || 0) / (1024 * 1024));
        UI.showModal('Ulanyjyny üýtget',
            `<div class="form-group"><label>Doly ady</label><input type="text" id="eu-name" value="${UI.esc(u.full_name)}" class="form-control" disabled></div>
             <div class="form-group"><label>Rol</label><select id="eu-role" class="form-control"><option value="user" ${u.role==='user'?'selected':''}>Ulanyjy</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select></div>
             <div class="form-group"><label>Kwota (MB)</label><input type="number" id="eu-quota" value="${mb}" class="form-control" min="0"></div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button><button class="btn btn-primary" onclick="AdminPage.saveUser(${id})">Ýatda sakla</button>`);
    },
    async saveUser(id) {
        const role = document.getElementById('eu-role').value, mb = parseInt(document.getElementById('eu-quota').value) || 0;
        try { await API.admin.users.update(id, role, mb * 1024 * 1024); UI.closeModal(); UI.toast('Üýtgedildi', 'success'); this.switchTab('users'); } catch (e) { UI.toast(e.message, 'error'); }
    },
    async deleteUser(id) {
        if (!confirm('Bu ulanyjyny pozmak isleýärsiňizmi?')) return;
        try { await API.admin.users.delete(id); UI.toast('Pozuldy', 'success'); this.switchTab('users'); } catch (e) { UI.toast(e.message, 'error'); }
    }
};

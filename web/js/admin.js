// Paylash — Admin Panel — Turkmen UI (purple accent)
const AdminPage = {
    currentTab: 'dashboard',
    data: {},

    render() {
        return `
        <div class="admin-page">
            <div class="admin-sidebar">
                <h3 class="admin-title">${UI.icons.settings} Dolandyryş</h3>
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
        const content = document.getElementById('admin-content');
        if (!content) return;
        content.innerHTML = '<div class="admin-loading"><div class="spinner"></div></div>';

        switch (tab) {
            case 'dashboard': await this.renderDashboard(content); break;
            case 'faculties': await this.renderFaculties(content); break;
            case 'courses': await this.renderCourses(content); break;
            case 'groups': await this.renderGroups(content); break;
            case 'users': await this.renderUsers(content); break;
        }
    },

    // Dashboard
    async renderDashboard(el) {
        try {
            const d = await API.admin.dashboard();
            el.innerHTML = `
            <h2>Statistika</h2>
            <div class="admin-stats">
                <div class="stat-card"><div class="stat-value">${d.total_users || 0}</div><div class="stat-label">Ulanyjylar</div></div>
                <div class="stat-card"><div class="stat-value">${d.total_files || 0}</div><div class="stat-label">Faýllar</div></div>
                <div class="stat-card"><div class="stat-value">${d.total_faculties || 0}</div><div class="stat-label">Fakultetler</div></div>
                <div class="stat-card"><div class="stat-value">${d.total_courses || 0}</div><div class="stat-label">Ugurlar</div></div>
                <div class="stat-card"><div class="stat-value">${d.total_groups || 0}</div><div class="stat-label">Toparlar</div></div>
                <div class="stat-card"><div class="stat-value">${UI.formatBytes(d.total_bytes || 0)}</div><div class="stat-label">Ulanylýan ýer</div></div>
            </div>`;
        } catch (err) { el.innerHTML = `<p class="text-muted">Ýükläp bolmady: ${UI.esc(err.message)}</p>`; }
    },

    // Faculties
    async renderFaculties(el) {
        try {
            const data = await API.admin.faculties.list();
            const items = data || [];
            el.innerHTML = `
            <div class="admin-header">
                <h2>Fakultetler</h2>
                <button class="btn btn-primary" onclick="AdminPage.showFacultyModal()">${UI.icons.plus} Täze fakultet</button>
            </div>
            <table class="admin-table">
                <thead><tr><th>ID</th><th>Ady</th><th>Hereketler</th></tr></thead>
                <tbody>
                ${items.map(f => `<tr>
                    <td>${f.id}</td>
                    <td>${UI.esc(f.name)}</td>
                    <td>
                        <button class="btn btn-sm btn-ghost" onclick="AdminPage.showFacultyModal(${f.id}, '${UI.esc(f.name)}')">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="AdminPage.deleteFaculty(${f.id})">🗑</button>
                    </td>
                </tr>`).join('')}
                ${items.length === 0 ? '<tr><td colspan="3" class="text-muted text-center">Fakultet ýok</td></tr>' : ''}
                </tbody>
            </table>`;
        } catch (err) { el.innerHTML = `<p class="text-muted">${UI.esc(err.message)}</p>`; }
    },

    showFacultyModal(id, name) {
        const isEdit = !!id;
        UI.showModal(isEdit ? 'Fakulteti üýtget' : 'Täze fakultet', `
            <div class="form-group">
                <label>Ady</label>
                <input type="text" id="faculty-name" value="${name || ''}" class="form-control" placeholder="Fakultetiň ady">
            </div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button>
             <button class="btn btn-primary" onclick="AdminPage.saveFaculty(${id || 'null'})">${isEdit ? 'Üýtget' : 'Döret'}</button>`
        );
    },

    async saveFaculty(id) {
        const name = document.getElementById('faculty-name').value.trim();
        if (!name) { UI.toast('Ady giriziň', 'error'); return; }
        try {
            if (id) await API.admin.faculties.update(id, name);
            else await API.admin.faculties.create(name);
            UI.closeModal();
            UI.toast(id ? 'Fakultet üýtgedildi' : 'Fakultet döredildi', 'success');
            this.switchTab('faculties');
        } catch (err) { UI.toast(err.message, 'error'); }
    },

    async deleteFaculty(id) {
        if (!confirm('Bu fakulteti pozmak isleýärsiňizmi?')) return;
        try { await API.admin.faculties.delete(id); UI.toast('Fakultet pozuldy', 'success'); this.switchTab('faculties'); }
        catch (err) { UI.toast(err.message, 'error'); }
    },

    // Courses
    async renderCourses(el) {
        try {
            const faculties = await API.admin.faculties.list();
            // Load courses for all faculties
            let allCourses = [];
            for (const f of (faculties || [])) {
                const courses = await API.catalogs.courses(f.id);
                if (courses) allCourses.push(...courses.map(c => ({ ...c, faculty_name: f.name })));
            }
            el.innerHTML = `
            <div class="admin-header">
                <h2>Ugurlar</h2>
                <button class="btn btn-primary" onclick="AdminPage.showCourseModal()">${UI.icons.plus} Täze ugur</button>
            </div>
            <table class="admin-table">
                <thead><tr><th>ID</th><th>Ady</th><th>Fakultet</th><th>Hereketler</th></tr></thead>
                <tbody>
                ${allCourses.map(c => `<tr>
                    <td>${c.id}</td>
                    <td>${UI.esc(c.name)}</td>
                    <td>${UI.esc(c.faculty_name || '')}</td>
                    <td>
                        <button class="btn btn-sm btn-ghost" onclick="AdminPage.showCourseModal(${c.id}, '${UI.esc(c.name)}', ${c.faculty_id})">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="AdminPage.deleteCourse(${c.id})">🗑</button>
                    </td>
                </tr>`).join('')}
                ${allCourses.length === 0 ? '<tr><td colspan="4" class="text-muted text-center">Ugur ýok</td></tr>' : ''}
                </tbody>
            </table>`;
            this._faculties = faculties || [];
        } catch (err) { el.innerHTML = `<p class="text-muted">${UI.esc(err.message)}</p>`; }
    },

    _faculties: [],

    async showCourseModal(id, name, facultyId) {
        if (!this._faculties.length) {
            try { this._faculties = await API.admin.faculties.list() || []; } catch { }
        }
        const isEdit = !!id;
        const opts = this._faculties.map(f => `<option value="${f.id}" ${f.id === facultyId ? 'selected' : ''}>${UI.esc(f.name)}</option>`).join('');
        UI.showModal(isEdit ? 'Ugry üýtget' : 'Täze ugur', `
            <div class="form-group">
                <label>Fakultet</label>
                <select id="course-faculty" class="form-control">${opts}</select>
            </div>
            <div class="form-group">
                <label>Ady</label>
                <input type="text" id="course-name" value="${name || ''}" class="form-control" placeholder="Ugruň ady">
            </div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button>
             <button class="btn btn-primary" onclick="AdminPage.saveCourse(${id || 'null'})">${isEdit ? 'Üýtget' : 'Döret'}</button>`
        );
    },

    async saveCourse(id) {
        const name = document.getElementById('course-name').value.trim();
        const facultyId = parseInt(document.getElementById('course-faculty').value);
        if (!name || !facultyId) { UI.toast('Ähli meýdanlary dolduryň', 'error'); return; }
        try {
            if (id) await API.admin.courses.update(id, name, facultyId);
            else await API.admin.courses.create(name, facultyId);
            UI.closeModal();
            UI.toast(id ? 'Ugur üýtgedildi' : 'Ugur döredildi', 'success');
            this.switchTab('courses');
        } catch (err) { UI.toast(err.message, 'error'); }
    },

    async deleteCourse(id) {
        if (!confirm('Bu ugry pozmak isleýärsiňizmi?')) return;
        try { await API.admin.courses.delete(id); UI.toast('Ugur pozuldy', 'success'); this.switchTab('courses'); }
        catch (err) { UI.toast(err.message, 'error'); }
    },

    // Groups
    async renderGroups(el) {
        try {
            const faculties = await API.admin.faculties.list();
            let allGroups = [];
            for (const f of (faculties || [])) {
                const courses = await API.catalogs.courses(f.id);
                for (const c of (courses || [])) {
                    const groups = await API.catalogs.groups(c.id);
                    if (groups) allGroups.push(...groups.map(g => ({ ...g, course_name: c.name, faculty_name: f.name })));
                }
            }
            el.innerHTML = `
            <div class="admin-header">
                <h2>Toparlar</h2>
                <button class="btn btn-primary" onclick="AdminPage.showGroupModal()">${UI.icons.plus} Täze topar</button>
            </div>
            <table class="admin-table">
                <thead><tr><th>ID</th><th>Ady</th><th>Ugur</th><th>Fakultet</th><th>Hereketler</th></tr></thead>
                <tbody>
                ${allGroups.map(g => `<tr>
                    <td>${g.id}</td>
                    <td>${UI.esc(g.name)}</td>
                    <td>${UI.esc(g.course_name || '')}</td>
                    <td>${UI.esc(g.faculty_name || '')}</td>
                    <td>
                        <button class="btn btn-sm btn-ghost" onclick="AdminPage.showGroupModal(${g.id}, '${UI.esc(g.name)}', ${g.course_id})">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="AdminPage.deleteGroup(${g.id})">🗑</button>
                    </td>
                </tr>`).join('')}
                ${allGroups.length === 0 ? '<tr><td colspan="5" class="text-muted text-center">Topar ýok</td></tr>' : ''}
                </tbody>
            </table>`;
        } catch (err) { el.innerHTML = `<p class="text-muted">${UI.esc(err.message)}</p>`; }
    },

    async showGroupModal(id, name, courseId) {
        // Need to load faculty → course cascade
        let faculties = [];
        try { faculties = await API.admin.faculties.list() || []; } catch { }
        const isEdit = !!id;
        const fOpts = faculties.map(f => `<option value="${f.id}">${UI.esc(f.name)}</option>`).join('');
        UI.showModal(isEdit ? 'Topary üýtget' : 'Täze topar', `
            <div class="form-group">
                <label>Fakultet</label>
                <select id="grp-faculty" class="form-control" onchange="AdminPage.onGroupFacultyChange()">
                    <option value="">Saýlaň...</option>${fOpts}
                </select>
            </div>
            <div class="form-group">
                <label>Ugur</label>
                <select id="grp-course" class="form-control" disabled><option value="">Ilki fakultet saýlaň</option></select>
            </div>
            <div class="form-group">
                <label>Ady</label>
                <input type="text" id="grp-name" value="${name || ''}" class="form-control" placeholder="Topar ady">
            </div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button>
             <button class="btn btn-primary" onclick="AdminPage.saveGroup(${id || 'null'})">${isEdit ? 'Üýtget' : 'Döret'}</button>`
        );
    },

    async onGroupFacultyChange() {
        const fId = document.getElementById('grp-faculty').value;
        const courseEl = document.getElementById('grp-course');
        courseEl.innerHTML = '<option value="">Ugur saýlaň...</option>';
        if (!fId) { courseEl.disabled = true; return; }
        courseEl.disabled = false;
        try {
            const courses = await API.catalogs.courses(fId);
            (courses || []).forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                courseEl.appendChild(opt);
            });
        } catch { courseEl.disabled = true; }
    },

    async saveGroup(id) {
        const name = document.getElementById('grp-name').value.trim();
        const courseId = parseInt(document.getElementById('grp-course').value);
        if (!name || !courseId) { UI.toast('Ähli meýdanlary dolduryň', 'error'); return; }
        try {
            if (id) await API.admin.groups.update(id, name, courseId);
            else await API.admin.groups.create(name, courseId);
            UI.closeModal();
            UI.toast(id ? 'Topar üýtgedildi' : 'Topar döredildi', 'success');
            this.switchTab('groups');
        } catch (err) { UI.toast(err.message, 'error'); }
    },

    async deleteGroup(id) {
        if (!confirm('Bu topary pozmak isleýärsiňizmi?')) return;
        try { await API.admin.groups.delete(id); UI.toast('Topar pozuldy', 'success'); this.switchTab('groups'); }
        catch (err) { UI.toast(err.message, 'error'); }
    },

    // Users
    async renderUsers(el) {
        try {
            const data = await API.admin.users.list();
            const users = data || [];
            el.innerHTML = `
            <div class="admin-header">
                <h2>Ulanyjylar</h2>
                <div class="admin-search">
                    <input type="text" id="admin-user-search" placeholder="Gözle..." class="form-control" oninput="AdminPage.filterUsers(this.value)">
                </div>
            </div>
            <table class="admin-table" id="admin-users-table">
                <thead><tr><th>ID</th><th>Ady</th><th>Ulanyjy ady</th><th>Rol</th><th>Kwota</th><th>Hereketler</th></tr></thead>
                <tbody>
                ${users.map(u => this.renderUserRow(u)).join('')}
                ${users.length === 0 ? '<tr><td colspan="6" class="text-muted text-center">Ulanyjy ýok</td></tr>' : ''}
                </tbody>
            </table>`;
            this._users = users;
        } catch (err) { el.innerHTML = `<p class="text-muted">${UI.esc(err.message)}</p>`; }
    },

    _users: [],

    renderUserRow(u) {
        return `<tr data-userid="${u.id}">
            <td>${u.id}</td>
            <td>${UI.esc(u.full_name)}</td>
            <td>@${UI.esc(u.username)}</td>
            <td><span class="badge badge-${u.role === 'admin' ? 'admin' : 'user'}">${u.role === 'admin' ? 'Admin' : 'Ulanyjy'}</span></td>
            <td>${UI.formatBytes(u.quota_bytes || 0)}</td>
            <td>
                <button class="btn btn-sm btn-ghost" onclick="AdminPage.showEditUserModal(${u.id})">✏️</button>
                ${u.role !== 'admin' ? `<button class="btn btn-sm btn-danger" onclick="AdminPage.deleteUser(${u.id})">🗑</button>` : ''}
            </td>
        </tr>`;
    },

    filterUsers(query) {
        const lc = query.toLowerCase();
        const rows = document.querySelectorAll('#admin-users-table tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(lc) ? '' : 'none';
        });
    },

    showEditUserModal(id) {
        const u = this._users.find(u => u.id === id);
        if (!u) return;
        const quotaMB = Math.round((u.quota_bytes || 0) / (1024 * 1024));
        UI.showModal('Ulanyjyny üýtget', `
            <div class="form-group">
                <label>Doly ady</label>
                <input type="text" id="edit-user-fullname" value="${UI.esc(u.full_name)}" class="form-control">
            </div>
            <div class="form-group">
                <label>Rol</label>
                <select id="edit-user-role" class="form-control">
                    <option value="user" ${u.role === 'user' ? 'selected' : ''}>Ulanyjy</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </div>
            <div class="form-group">
                <label>Kwota (MB)</label>
                <input type="number" id="edit-user-quota" value="${quotaMB}" class="form-control" min="0">
            </div>`,
            `<button class="btn btn-ghost" onclick="UI.closeModal()">Ýatyrmak</button>
             <button class="btn btn-primary" onclick="AdminPage.saveUser(${id})">Ýatda sakla</button>`
        );
    },

    async saveUser(id) {
        const role = document.getElementById('edit-user-role').value;
        const quotaMB = parseInt(document.getElementById('edit-user-quota').value) || 0;
        try {
            await API.admin.users.update(id, role, quotaMB * 1024 * 1024);
            UI.closeModal();
            UI.toast('Ulanyjy üýtgedildi', 'success');
            this.switchTab('users');
        } catch (err) { UI.toast(err.message, 'error'); }
    },

    async deleteUser(id) {
        if (!confirm('Bu ulanyjyny pozmak isleýärsiňizmi?')) return;
        try { await API.admin.users.delete(id); UI.toast('Ulanyjy pozuldy', 'success'); this.switchTab('users'); }
        catch (err) { UI.toast(err.message, 'error'); }
    }
};

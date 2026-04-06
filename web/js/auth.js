// Paylash — Auth pages (Login & Register) — Turkmen UI
const AuthPage = {
    faculties: [],
    courses: [],
    groups: [],

    renderLogin() {
        return `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-logo">${UI.icons.cloud}<span>Paylash</span></div>
                <h2 class="auth-title">Ulgama giriň</h2>
                <p class="auth-subtitle">Ulanyjy adyňyzy we parolyňyzy giriziň</p>
                <form id="login-form" class="auth-form">
                    <div class="form-group">
                        <label for="login-username">Ulanyjy ady</label>
                        <input type="text" id="login-username" placeholder="Ulanyjy adyňyz" required autocomplete="username">
                    </div>
                    <div class="form-group">
                        <label for="login-password">Parol</label>
                        <input type="password" id="login-password" placeholder="Parolyňyz" required autocomplete="current-password">
                    </div>
                    <button type="submit" class="btn btn-primary btn-block" id="login-btn">Giriş</button>
                </form>
                <p class="auth-link">Hasabyňyz ýokmy? <a href="#" onclick="App.navigate('register');return false">Hasap dörediň</a></p>
            </div>
        </div>`;
    },

    renderRegister() {
        return `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-logo">${UI.icons.cloud}<span>Paylash</span></div>
                <h2 class="auth-title">Hasap döretmek</h2>
                <p class="auth-subtitle">Maglumatyňyzy dolduryň</p>
                <form id="register-form" class="auth-form">
                    <div class="form-group">
                        <label for="reg-fullname">Doly adyňyz</label>
                        <input type="text" id="reg-fullname" placeholder="Mysal: Aman Amanow" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-username">Ulanyjy ady</label>
                        <input type="text" id="reg-username" placeholder="Ulanyjy adyňyz" required autocomplete="username">
                    </div>
                    <div class="form-group">
                        <label for="reg-password">Parol</label>
                        <input type="password" id="reg-password" placeholder="Iň az 6 simwol" required minlength="6" autocomplete="new-password">
                    </div>
                    <div class="form-group">
                        <label for="reg-faculty">Fakultet</label>
                        <select id="reg-faculty" required>
                            <option value="">Fakultet saýlaň...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="reg-course">Ugur</label>
                        <select id="reg-course" required disabled>
                            <option value="">Ilki fakultet saýlaň</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="reg-group">Topar</label>
                        <select id="reg-group" required disabled>
                            <option value="">Ilki ugur saýlaň</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block" id="register-btn">Hasap döret</button>
                </form>
                <p class="auth-link">Hasabyňyz barmy? <a href="#" onclick="App.navigate('login');return false">Giriş</a></p>
            </div>
        </div>`;
    },

    initLogin() {
        const form = document.getElementById('login-form');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('login-btn');
            btn.disabled = true;
            btn.textContent = 'Girilýär...';
            try {
                const username = document.getElementById('login-username').value.trim();
                const password = document.getElementById('login-password').value;
                if (!username || !password) { UI.toast('Ähli meýdanlary dolduryň', 'error'); return; }
                await API.auth.login(username, password);
                UI.toast('Üstünlikli girildi!', 'success');
                await App.checkAuth();
                App.navigate('files');
            } catch (err) {
                UI.toast(err.message || 'Giriş ýalňyşlygy', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Giriş';
            }
        });
    },

    async initRegister() {
        const form = document.getElementById('register-form');
        if (!form) return;

        // Load faculties
        try {
            this.faculties = await API.catalogs.faculties();
            const sel = document.getElementById('reg-faculty');
            this.faculties.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = f.name;
                sel.appendChild(opt);
            });
        } catch { /* ignore */ }

        // Cascading selects
        document.getElementById('reg-faculty').addEventListener('change', async (e) => {
            const courseEl = document.getElementById('reg-course');
            const groupEl = document.getElementById('reg-group');
            courseEl.innerHTML = '<option value="">Ugur saýlaň...</option>';
            groupEl.innerHTML = '<option value="">Ilki ugur saýlaň</option>';
            groupEl.disabled = true;

            if (!e.target.value) { courseEl.disabled = true; return; }
            courseEl.disabled = false;
            try {
                this.courses = await API.catalogs.courses(e.target.value);
                this.courses.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    courseEl.appendChild(opt);
                });
            } catch { courseEl.disabled = true; }
        });

        document.getElementById('reg-course').addEventListener('change', async (e) => {
            const groupEl = document.getElementById('reg-group');
            groupEl.innerHTML = '<option value="">Topar saýlaň...</option>';

            if (!e.target.value) { groupEl.disabled = true; return; }
            groupEl.disabled = false;
            try {
                this.groups = await API.catalogs.groups(e.target.value);
                this.groups.forEach(g => {
                    const opt = document.createElement('option');
                    opt.value = g.id;
                    opt.textContent = g.name;
                    groupEl.appendChild(opt);
                });
            } catch { groupEl.disabled = true; }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('register-btn');
            btn.disabled = true;
            btn.textContent = 'Döredilýär...';
            try {
                const fullName = document.getElementById('reg-fullname').value.trim();
                const username = document.getElementById('reg-username').value.trim();
                const password = document.getElementById('reg-password').value;
                const facultyId = parseInt(document.getElementById('reg-faculty').value);
                const courseId = parseInt(document.getElementById('reg-course').value);
                const groupId = parseInt(document.getElementById('reg-group').value);

                if (!fullName || !username || !password || !facultyId || !courseId || !groupId) {
                    UI.toast('Ähli meýdanlary dolduryň', 'error');
                    return;
                }
                if (password.length < 6) {
                    UI.toast('Parol iň az 6 simwol bolmaly', 'error');
                    return;
                }

                await API.auth.register(username, password, fullName, facultyId, courseId, groupId);
                UI.toast('Hasap döredildi! Ulgama giriň', 'success');
                App.navigate('login');
            } catch (err) {
                UI.toast(err.message || 'Hasap döredip bolmady', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Hasap döret';
            }
        });
    }
};

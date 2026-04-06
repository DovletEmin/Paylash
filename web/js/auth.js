/* Paylash — Auth Pages */
const AuthPage = {
    renderLogin() {
        return `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-logo">${UI.icons.cloud} <span>Paylash</span></div>
                <h2 class="auth-title">Ulgama giriň</h2>
                <p class="auth-subtitle">Ulanyjy adyňyzy we parolyňyzy giriziň</p>
                <form id="login-form" class="auth-form">
                    <div class="form-group">
                        <label>Ulanyjy ady</label>
                        <input type="text" id="login-username" class="form-control" placeholder="Ulanyjy adyňyz" required autocomplete="username">
                    </div>
                    <div class="form-group">
                        <label>Parol</label>
                        <input type="password" id="login-password" class="form-control" placeholder="Parolyňyz" required autocomplete="current-password">
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
                <div class="auth-logo">${UI.icons.cloud} <span>Paylash</span></div>
                <h2 class="auth-title">Hasap döretmek</h2>
                <p class="auth-subtitle">Maglumatyňyzy dolduryň</p>
                <form id="register-form" class="auth-form">
                    <div class="form-group">
                        <label>Doly adyňyz</label>
                        <input type="text" id="reg-fullname" class="form-control" placeholder="Mysal: Aman Amanow" required>
                    </div>
                    <div class="form-group">
                        <label>Ulanyjy ady</label>
                        <input type="text" id="reg-username" class="form-control" placeholder="Ulanyjy adyňyz" required autocomplete="username">
                    </div>
                    <div class="form-group">
                        <label>Parol</label>
                        <input type="password" id="reg-password" class="form-control" placeholder="Iň az 6 simwol" required minlength="6" autocomplete="new-password">
                    </div>
                    <div class="form-group">
                        <label>Fakultet</label>
                        <select id="reg-faculty" class="form-control" required><option value="">Fakultet saýlaň…</option></select>
                    </div>
                    <div class="form-group">
                        <label>Ugur</label>
                        <select id="reg-course" class="form-control" required disabled><option value="">Ilki fakultet saýlaň</option></select>
                    </div>
                    <div class="form-group">
                        <label>Topar</label>
                        <select id="reg-group" class="form-control" required disabled><option value="">Ilki ugur saýlaň</option></select>
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
            btn.disabled = true; btn.textContent = 'Girilýär…';
            try {
                const u = document.getElementById('login-username').value.trim();
                const p = document.getElementById('login-password').value;
                if (!u || !p) { UI.toast('Ähli meýdanlary dolduryň', 'error'); return; }
                await API.auth.login(u, p);
                await App.checkAuth();
                App.navigate('files');
            } catch (err) {
                UI.toast(err.message || 'Giriş ýalňyşlygy', 'error');
            } finally { btn.disabled = false; btn.textContent = 'Giriş'; }
        });
    },

    async initRegister() {
        const form = document.getElementById('register-form');
        if (!form) return;

        try {
            const facs = await API.catalogs.faculties();
            const sel = document.getElementById('reg-faculty');
            (facs || []).forEach(f => { const o = document.createElement('option'); o.value = f.id; o.textContent = f.name; sel.appendChild(o); });
        } catch {}

        document.getElementById('reg-faculty').addEventListener('change', async (e) => {
            const cEl = document.getElementById('reg-course'), gEl = document.getElementById('reg-group');
            cEl.innerHTML = '<option value="">Ugur saýlaň…</option>'; gEl.innerHTML = '<option value="">Ilki ugur saýlaň</option>'; gEl.disabled = true;
            if (!e.target.value) { cEl.disabled = true; return; }
            cEl.disabled = false;
            try { const cs = await API.catalogs.courses(e.target.value); (cs||[]).forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; cEl.appendChild(o); }); } catch { cEl.disabled = true; }
        });

        document.getElementById('reg-course').addEventListener('change', async (e) => {
            const gEl = document.getElementById('reg-group');
            gEl.innerHTML = '<option value="">Topar saýlaň…</option>';
            if (!e.target.value) { gEl.disabled = true; return; }
            gEl.disabled = false;
            try { const gs = await API.catalogs.groups(e.target.value); (gs||[]).forEach(g => { const o = document.createElement('option'); o.value = g.id; o.textContent = g.name; gEl.appendChild(o); }); } catch { gEl.disabled = true; }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('register-btn');
            btn.disabled = true; btn.textContent = 'Döredilýär…';
            try {
                const fn = document.getElementById('reg-fullname').value.trim();
                const un = document.getElementById('reg-username').value.trim();
                const pw = document.getElementById('reg-password').value;
                const fId = parseInt(document.getElementById('reg-faculty').value);
                const cId = parseInt(document.getElementById('reg-course').value);
                const gId = parseInt(document.getElementById('reg-group').value);
                if (!fn || !un || !pw || !fId || !cId || !gId) { UI.toast('Ähli meýdanlary dolduryň', 'error'); return; }
                if (pw.length < 6) { UI.toast('Parol iň az 6 simwol bolmaly', 'error'); return; }
                await API.auth.register(un, pw, fn, fId, cId, gId);
                UI.toast('Hasap döredildi! Giriň', 'success');
                App.navigate('login');
            } catch (err) { UI.toast(err.message || 'Hasap döredip bolmady', 'error'); }
            finally { btn.disabled = false; btn.textContent = 'Hasap döret'; }
        });
    }
};

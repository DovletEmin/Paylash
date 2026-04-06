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
                        ${UI.passwordField('login-password', 'Parolyňyz')}
                    </div>
                    <button type="submit" class="btn btn-primary btn-block" id="login-btn">Giriş</button>
                </form>
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
    }
};

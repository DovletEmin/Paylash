/* Paylash — Main App Router */
const App = {
    user: null,
    currentPage: null,

    async start() {
        this.initTheme();
        await this.checkAuth();
        window.addEventListener('popstate', () => this.route());
        this.route();
    },

    async checkAuth() {
        try { this.user = await API.auth.me(); } catch { this.user = null; }
    },

    navigate(page, replace) {
        const url = '/' + (page === 'files' ? '' : page);
        if (replace) history.replaceState({ page }, '', url);
        else history.pushState({ page }, '', url);
        this.route();
    },

    route() {
        const path = location.pathname.replace(/^\/+/, '') || '';
        const page = path.split('/')[0] || 'files';

        if (!this.user && !['login', 'register'].includes(page)) { this.navigate('login', true); return; }
        if (this.user && ['login', 'register'].includes(page)) { this.navigate('files', true); return; }
        if (page === 'admin' && this.user && this.user.role !== 'admin') { this.navigate('files', true); return; }

        this.renderPage(page);
    },

    renderPage(page) {
        this.currentPage = page;
        const app = document.getElementById('app');

        if (['login', 'register'].includes(page)) {
            if (page === 'login') { app.innerHTML = AuthPage.renderLogin(); AuthPage.initLogin(); }
            else { app.innerHTML = AuthPage.renderRegister(); AuthPage.initRegister(); }
            return;
        }

        // Editor is fullscreen, no sidebar
        if (page === 'editor') {
            app.innerHTML = EditorPage.render();
            EditorPage.init();
            return;
        }

        app.innerHTML = this.renderShell(page);
        this.initPage(page);
    },

    renderShell(page) {
        const u = this.user;
        const isAdmin = u && u.role === 'admin';
        return `
        <div class="app-layout">
            <aside class="sidebar" id="sidebar">
                <div class="sidebar-header">
                    <div class="sidebar-logo">${UI.icons.cloud} Paylash</div>
                </div>
                <nav class="sidebar-nav">
                    <div class="sidebar-section">Esasy</div>
                    <a class="nav-item ${page === 'files' ? 'active' : ''}" onclick="App.navigate('files')">
                        ${UI.icons.folder} <span>Faýllar</span>
                    </a>
                    <a class="nav-item nav-sub ${page === 'files' && FilesPage.currentScope === 'personal' ? 'active' : ''}" onclick="FilesPage.setScope('personal');App.navigate('files')">
                        <span>🔒</span> <span>Şahsy</span>
                    </a>
                    <a class="nav-item nav-sub ${page === 'files' && FilesPage.currentScope === 'group' ? 'active' : ''}" onclick="FilesPage.setScope('group');App.navigate('files')">
                        <span>👥</span> <span>Topar</span>
                    </a>
                    <a class="nav-item nav-sub ${page === 'files' && FilesPage.currentScope === 'public' ? 'active' : ''}" onclick="FilesPage.setScope('public');App.navigate('files')">
                        <span>🌐</span> <span>Umumy</span>
                    </a>
                    <a class="nav-item ${page === 'shared' ? 'active' : ''}" onclick="App.navigate('shared')">
                        ${UI.icons.share} <span>Paýlaşylanlar</span>
                    </a>
                    ${isAdmin ? `
                    <div class="sidebar-section">Dolandyryş</div>
                    <a class="nav-item admin-item ${page === 'admin' ? 'active' : ''}" onclick="App.navigate('admin')">
                        ${UI.icons.settings} <span>Admin panel</span>
                    </a>` : ''}
                </nav>
                <div class="sidebar-footer">
                    <div class="sidebar-user">
                        <div class="sidebar-avatar">${(u.full_name || 'U').charAt(0).toUpperCase()}</div>
                        <div class="sidebar-user-info">
                            <div class="sidebar-user-name">${UI.esc(u.full_name)}</div>
                            <div class="sidebar-user-role">${u.role === 'admin' ? 'Admin' : 'Ulanyjy'}</div>
                        </div>
                        <button class="sidebar-logout" onclick="App.logout()" title="Çykyş">${UI.icons.logout}</button>
                    </div>
                </div>
            </aside>
            <main class="main-content">
                <header class="topbar">
                    <button class="sidebar-toggle" onclick="document.getElementById('sidebar').classList.toggle('open')">${UI.icons.menu}</button>
                    <div class="topbar-title">${this.pageTitle(page)}</div>
                    <div class="topbar-right">
                        <button class="btn btn-icon btn-ghost" id="theme-toggle" onclick="App.toggleTheme()" title="Tema">
                            <span class="theme-icon-dark">${UI.icons.sun}</span>
                            <span class="theme-icon-light">${UI.icons.moon}</span>
                        </button>
                    </div>
                </header>
                <div class="page-content" id="page-content"></div>
            </main>
        </div>`;
    },

    pageTitle(p) {
        return { files: 'Faýllar', shared: 'Paýlaşylanlar', admin: 'Dolandyryş' }[p] || 'Paylash';
    },

    initPage(page) {
        const c = document.getElementById('page-content');
        if (!c) return;
        switch (page) {
            case 'files':  c.innerHTML = FilesPage.render(); FilesPage.init(); break;
            case 'shared': c.innerHTML = SharesPage.renderSharedWithMe(); SharesPage.initSharedWithMe(); break;
            case 'admin':  c.innerHTML = AdminPage.render(); AdminPage.init(); break;
            default:       c.innerHTML = '<div class="empty-state"><p>Sahypa tapylmady</p></div>';
        }
    },

    async logout() {
        try { await API.auth.logout(); } catch {}
        this.user = null;
        this.navigate('login', true);
        UI.toast('Ulgamdan çykdyňyz', 'info');
    },

    initTheme() {
        const saved = localStorage.getItem('paylash-theme');
        if (saved === 'light') document.documentElement.classList.add('light');
    },

    toggleTheme() {
        const isLight = document.documentElement.classList.toggle('light');
        localStorage.setItem('paylash-theme', isLight ? 'light' : 'dark');
    }
};

document.addEventListener('DOMContentLoaded', () => App.start());

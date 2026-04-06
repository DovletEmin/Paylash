// Paylash — Main SPA Router & Init — Turkmen UI
const App = {
    user: null,
    currentPage: null,

    async start() {
        await this.checkAuth();
        window.addEventListener('popstate', () => this.route());
        document.addEventListener('click', () => UI.hideContextMenu());
        this.route();
    },

    async checkAuth() {
        try {
            this.user = await API.auth.me();
        } catch {
            this.user = null;
        }
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

        // Auth guards
        if (!this.user && !['login', 'register'].includes(page)) {
            this.navigate('login', true);
            return;
        }
        if (this.user && ['login', 'register'].includes(page)) {
            this.navigate('files', true);
            return;
        }

        // Admin guard
        if (page === 'admin' && this.user && this.user.role !== 'admin') {
            this.navigate('files', true);
            return;
        }

        this.renderPage(page);
    },

    renderPage(page) {
        this.currentPage = page;
        const app = document.getElementById('app');

        // Auth pages — no sidebar
        if (['login', 'register'].includes(page)) {
            app.className = 'auth-layout';
            if (page === 'login') {
                app.innerHTML = AuthPage.renderLogin();
                AuthPage.initLogin();
            } else {
                app.innerHTML = AuthPage.renderRegister();
                AuthPage.initRegister();
            }
            return;
        }

        // Main layout with sidebar
        app.className = 'main-layout';
        app.innerHTML = this.renderLayout(page);
        this.initPage(page);
    },

    renderLayout(page) {
        const u = this.user;
        const isAdmin = u && u.role === 'admin';
        return `
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-logo">${UI.icons.cloud}<span>Paylash</span></div>
            </div>
            <nav class="sidebar-nav">
                <a class="sidebar-item ${page === 'files' ? 'active' : ''}" onclick="App.navigate('files')">
                    ${UI.icons.folder} <span>Faýllar</span>
                </a>
                <a class="sidebar-item ${page === 'shared' ? 'active' : ''}" onclick="App.navigate('shared')">
                    ${UI.icons.share} <span>Paýlaşylanlar</span>
                </a>
                ${isAdmin ? `<a class="sidebar-item sidebar-admin ${page === 'admin' ? 'active' : ''}" onclick="App.navigate('admin')">
                    ${UI.icons.settings} <span>Dolandyryş</span>
                </a>` : ''}
            </nav>
            <div class="sidebar-footer">
                <div class="sidebar-user">
                    <div class="sidebar-avatar">${(u.full_name || 'U').charAt(0).toUpperCase()}</div>
                    <div class="sidebar-user-info">
                        <div class="sidebar-user-name">${UI.esc(u.full_name)}</div>
                        <div class="sidebar-user-role">${u.role === 'admin' ? 'Admin' : 'Ulanyjy'}</div>
                    </div>
                </div>
                <button class="btn btn-ghost btn-sm sidebar-logout" onclick="App.logout()" title="Çykyş">${UI.icons.logout}</button>
            </div>
        </aside>
        <main class="main-content" id="main-content">
            <header class="topbar">
                <button class="btn btn-icon sidebar-toggle" onclick="document.getElementById('sidebar').classList.toggle('open')">${UI.icons.menu}</button>
                <div class="topbar-title">${this.pageTitle(page)}</div>
            </header>
            <div class="page-content" id="page-content"></div>
        </main>`;
    },

    pageTitle(page) {
        const titles = { files: 'Faýllar', shared: 'Paýlaşylanlar', admin: 'Dolandyryş', editor: 'Redaktor' };
        return titles[page] || 'Paylash';
    },

    initPage(page) {
        const content = document.getElementById('page-content');
        if (!content) return;

        switch (page) {
            case 'files':
                content.innerHTML = FilesPage.render();
                FilesPage.init();
                break;
            case 'shared':
                content.innerHTML = SharesPage.renderSharedWithMe();
                SharesPage.initSharedWithMe();
                break;
            case 'admin':
                content.innerHTML = AdminPage.render();
                AdminPage.init();
                break;
            case 'editor':
                content.innerHTML = EditorPage.render();
                EditorPage.init();
                break;
            default:
                content.innerHTML = '<div class="empty-state"><p>Sahypa tapylmady</p></div>';
        }
    },

    async logout() {
        try {
            await API.auth.logout();
        } catch { /* ignore */ }
        this.user = null;
        this.navigate('login', true);
        UI.toast('Ulgamdan çykdyňyz', 'info');
    }
};

// Start app when DOM ready
document.addEventListener('DOMContentLoaded', () => App.start());

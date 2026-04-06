// Paylash API Client — Turkmen UI
const API = {
    async _request(method, url, body) {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
        };
        if (body && method !== 'GET') opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        if (res.status === 401 && !url.includes('/auth/me')) {
            if (typeof App !== 'undefined') App.navigate('login');
            throw new Error('Sessiýa gutardy');
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Näsazlyk ýüze çykdy');
        return data;
    },

    auth: {
        login(username, password) {
            return API._request('POST', '/api/auth/login', { username, password });
        },
        logout() { return API._request('POST', '/api/auth/logout'); },
        me() { return API._request('GET', '/api/auth/me'); },
        updateProfile(displayName, oldPassword, newPassword) {
            return API._request('PATCH', '/api/auth/profile', {
                display_name: displayName, old_password: oldPassword, new_password: newPassword
            });
        },
        uploadAvatar(file) {
            const form = new FormData();
            form.append('avatar', file);
            return fetch('/api/auth/avatar', { method: 'POST', body: form, credentials: 'same-origin' })
                .then(r => r.json().then(d => r.ok ? d : Promise.reject(new Error(d.error || 'Ýalňyşlyk'))));
        },
    },

    catalogs: {
        faculties() { return API._request('GET', '/api/faculties'); },
        courses(facultyId) { return API._request('GET', `/api/faculties/${facultyId}/courses`); },
        groups(courseId) { return API._request('GET', `/api/courses/${courseId}/groups`); },
    },

    files: {
        list(params) {
            let url = `/api/files?scope=${params.scope || 'personal'}`;
            if (params.folder_id) url += `&folder_id=${params.folder_id}`;
            if (params.sort) url += `&sort=${params.sort}`;
            if (params.order) url += `&order=${params.order}`;
            return API._request('GET', url);
        },
        upload(file, scope, folderId, onProgress) {
            const form = new FormData();
            form.append('file', file);
            form.append('scope', scope || 'personal');
            if (folderId) form.append('folder_id', String(folderId));

            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/files/upload');
                xhr.withCredentials = true;
                if (onProgress) {
                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100));
                    };
                }
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        try { reject(new Error(JSON.parse(xhr.responseText).error)); }
                        catch { reject(new Error('Ýükläp bolmady')); }
                    }
                };
                xhr.onerror = () => reject(new Error('Tor näsazlygy'));
                xhr.send(form);
            });
        },
        download(id) { window.open(`/api/files/${id}/download`, '_blank'); },
        rename(id, name) { return API._request('PATCH', `/api/files/${id}`, { name }); },
        delete(id) { return API._request('DELETE', `/api/files/${id}`); },
        search(q) { return API._request('GET', `/api/search?q=${encodeURIComponent(q)}`); },
        storageUsage(scope) { return API._request('GET', `/api/storage/usage?scope=${scope || 'personal'}`); },
    },

    folders: {
        create(name, scope, parentId) {
            return API._request('POST', '/api/folders', {
                name, scope: scope || 'personal', parent_id: parentId || null
            });
        },
        rename(id, name) { return API._request('PATCH', `/api/folders/${id}`, { name }); },
        delete(id) { return API._request('DELETE', `/api/folders/${id}`); },
    },

    sharing: {
        share(fileId, userId, permission) {
            return API._request('POST', `/api/files/${fileId}/share`, {
                user_id: userId, permission: permission || 'view'
            });
        },
        deleteShare(fileId, userId) {
            return API._request('DELETE', `/api/files/${fileId}/share/${userId}`);
        },
        updateSharePermission(fileId, userId, permission) {
            return API._request('PATCH', `/api/files/${fileId}/share/${userId}`, { permission });
        },
        setPublic(fileId, isPublic) {
            return API._request('PATCH', `/api/files/${fileId}/share/public`, { is_public: isPublic });
        },
        setVisibility(fileId, visibility) {
            return API._request('PATCH', `/api/files/${fileId}/visibility`, { visibility });
        },
        sharedWithMe() { return API._request('GET', '/api/shared-with-me'); },
        getFileShares(fileId) { return API._request('GET', `/api/files/${fileId}/shares`); },
        searchUsers(q) { return API._request('GET', `/api/users/search?q=${encodeURIComponent(q)}`); },
    },

    collabora: {
        editorURL(fileId) { return API._request('GET', `/api/collabora/editor-url?file_id=${fileId}`); },
    },

    admin: {
        dashboard() { return API._request('GET', '/api/admin/dashboard'); },
        faculties: {
            list() { return API._request('GET', '/api/faculties'); },
            create(name) { return API._request('POST', '/api/admin/faculties', { name }); },
            update(id, name) { return API._request('PATCH', `/api/admin/faculties/${id}`, { name }); },
            delete(id) { return API._request('DELETE', `/api/admin/faculties/${id}`); },
        },
        courses: {
            create(name, facultyId) { return API._request('POST', '/api/admin/courses', { name, faculty_id: facultyId }); },
            update(id, name, facultyId) { return API._request('PATCH', `/api/admin/courses/${id}`, { name }); },
            delete(id) { return API._request('DELETE', `/api/admin/courses/${id}`); },
        },
        groups: {
            create(name, courseId, quotaBytes) { return API._request('POST', '/api/admin/groups', { name, course_id: courseId, quota_bytes: quotaBytes || 5368709120 }); },
            update(id, name, quotaBytes) { return API._request('PATCH', `/api/admin/groups/${id}`, { name, quota_bytes: quotaBytes }); },
            delete(id) { return API._request('DELETE', `/api/admin/groups/${id}`); },
            bulkQuota(quotaMB) { return API._request('POST', '/api/admin/groups/bulk-quota', { quota_mb: quotaMB }); },
        },
        users: {
            list(filters) {
                let url = '/api/admin/users';
                if (filters) url += '?' + new URLSearchParams(filters).toString();
                return API._request('GET', url);
            },
            create(data) {
                return API._request('POST', '/api/admin/users', data);
            },
            update(id, data) {
                return API._request('PATCH', `/api/admin/users/${id}`, data);
            },
            delete(id) { return API._request('DELETE', `/api/admin/users/${id}`); },
            bulkQuota(quotaMB) { return API._request('POST', '/api/admin/users/bulk-quota', { quota_mb: quotaMB }); },
            importFile(file) {
                const form = new FormData();
                form.append('file', file);
                return fetch('/api/admin/users/import', { method: 'POST', body: form, credentials: 'same-origin' })
                    .then(r => r.json().then(d => r.ok ? d : Promise.reject(new Error(d.error || 'Ýalňyşlyk'))));
            },
        },
    },
};

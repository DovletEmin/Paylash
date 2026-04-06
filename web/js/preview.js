/* Paylash — Media Preview Page */
const PreviewPage = {
    currentFileId: null,
    currentFileName: '',

    render() {
        return `
        <div class="editor-page">
            <div class="editor-toolbar">
                <button class="btn btn-ghost btn-sm" onclick="App.navigate('files')">← Yza</button>
                <span class="editor-filename">${UI.esc(this.currentFileName)}</span>
                <div class="editor-toolbar-right">
                    <button class="btn btn-ghost btn-sm" onclick="PreviewPage.download()">${UI.icons.download} Ýükle</button>
                    <button class="btn btn-ghost btn-sm" onclick="SharesPage.showShareModal({id:PreviewPage.currentFileId,name:PreviewPage.currentFileName})">${UI.icons.share} Paýlaş</button>
                </div>
            </div>
            <div class="preview-container" id="preview-container">
                <div class="editor-loading"><div class="spinner"></div><p>Ýüklenýär…</p></div>
            </div>
        </div>`;
    },

    async open(fileId, fileName) {
        this.currentFileId = fileId;
        this.currentFileName = fileName;
        App.navigate('preview');
    },

    async init() {
        if (!this.currentFileId) { App.navigate('files'); return; }
        const c = document.getElementById('preview-container');
        const type = UI.mediaType(this.currentFileName);
        const url = `/api/files/${this.currentFileId}/download`;

        if (type === 'image') {
            c.innerHTML = `<div class="preview-media preview-image"><img src="${url}" alt="${UI.esc(this.currentFileName)}" onclick="PreviewPage.toggleZoom(this)"></div>`;
        } else if (type === 'audio') {
            c.innerHTML = `<div class="preview-media preview-audio">
                <div class="preview-audio-icon">🎵</div>
                <div class="preview-audio-name">${UI.esc(this.currentFileName)}</div>
                <audio controls autoplay src="${url}" style="width:100%;max-width:500px"></audio>
            </div>`;
        } else if (type === 'video') {
            c.innerHTML = `<div class="preview-media preview-video"><video controls autoplay src="${url}"></video></div>`;
        } else {
            c.innerHTML = '<div class="empty-state"><p>Bu faýly görkezip bolmaýar</p></div>';
        }
    },

    toggleZoom(img) {
        img.classList.toggle('zoomed');
    },

    download() { if (this.currentFileId) FilesPage.download(this.currentFileId, this.currentFileName); }
};

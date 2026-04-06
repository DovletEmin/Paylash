package api

import (
	"fmt"
	"io"
	"net/http"
	"paylash/internal/authutil"
	"paylash/internal/models"
	"paylash/internal/storage"
	"strconv"
	"strings"
)

func (h *Handler) ListFiles(w http.ResponseWriter, r *http.Request) {
	user := authutil.GetUser(r)
	scope := r.URL.Query().Get("scope")
	if scope == "" {
		scope = "personal"
	}
	sort := r.URL.Query().Get("sort")
	order := r.URL.Query().Get("order")

	var folderID *int
	if fid := r.URL.Query().Get("folder_id"); fid != "" {
		if n, err := strconv.Atoi(fid); err == nil {
			folderID = &n
		}
	}

	files, err := h.db.ListFiles(user.ID, user.GroupID, scope, folderID, sort, order)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "faýllary alyp bolmady")
		return
	}
	folders, err := h.db.ListFolders(user.ID, user.GroupID, scope, folderID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "bukjalary alyp bolmady")
		return
	}
	if files == nil {
		files = []models.File{}
	}
	if folders == nil {
		folders = []models.Folder{}
	}
	writeJSON(w, http.StatusOK, models.FileListResponse{Files: files, Folders: folders})
}

func (h *Handler) UploadFile(w http.ResponseWriter, r *http.Request) {
	user := authutil.GetUser(r)

	if err := r.ParseMultipartForm(100 << 20); err != nil { // 100MB max
		writeError(w, http.StatusBadRequest, "faýl juda uly")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "faýl tapylmady")
		return
	}
	defer file.Close()

	scope := r.FormValue("scope")
	if scope == "" {
		scope = "personal"
	}

	// Determine bucket and check quota
	var bucket string
	var groupID *int
	if scope == "group" && user.GroupID != nil {
		groupID = user.GroupID
		bucket = storage.GroupBucket(*user.GroupID)
	} else {
		scope = "personal"
		bucket = storage.PersonalBucket(user.ID)
	}

	// Check quota
	usage, err := h.db.GetStorageUsage(user.ID, scope, groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "ammar maglumatyny alyp bolmady")
		return
	}
	if usage.UsedBytes+header.Size > usage.QuotaBytes {
		writeError(w, http.StatusForbidden, "ammar doly, ýer ýok")
		return
	}

	if err := h.minio.EnsureBucket(r.Context(), bucket); err != nil {
		writeError(w, http.StatusInternalServerError, "ammar döredip bolmady")
		return
	}

	// Build key
	var folderID *int
	if fid := r.FormValue("folder_id"); fid != "" {
		if n, err := strconv.Atoi(fid); err == nil {
			folderID = &n
		}
	}

	key := fmt.Sprintf("%d/%s", user.ID, header.Filename)
	if folderID != nil {
		key = fmt.Sprintf("%d/f%d/%s", user.ID, *folderID, header.Filename)
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	if err := h.minio.Upload(r.Context(), bucket, key, file, header.Size, contentType); err != nil {
		writeError(w, http.StatusInternalServerError, "faýly ýükläp bolmady")
		return
	}

	f := &models.File{
		Name:        header.Filename,
		MimeType:    contentType,
		SizeBytes:   header.Size,
		MinioBucket: bucket,
		MinioKey:    key,
		FolderID:    folderID,
		OwnerID:     user.ID,
		GroupID:     groupID,
		Scope:       scope,
	}
	if err := h.db.CreateFile(f); err != nil {
		writeError(w, http.StatusInternalServerError, "faýl maglumatyny saklap bolmady")
		return
	}

	writeJSON(w, http.StatusCreated, f)
}

func (h *Handler) DownloadFile(w http.ResponseWriter, r *http.Request) {
	user := authutil.GetUser(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "nädogry ID")
		return
	}

	f, err := h.db.GetFile(id)
	if err != nil || f == nil {
		writeError(w, http.StatusNotFound, "faýl tapylmady")
		return
	}

	canAccess, err := h.db.CanAccessFile(f.ID, user.ID, user.GroupID, "view")
	if err != nil || !canAccess {
		writeError(w, http.StatusForbidden, "rugsat ýok")
		return
	}

	obj, err := h.minio.Download(r.Context(), f.MinioBucket, f.MinioKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "faýly alyp bolmady")
		return
	}
	defer obj.Close()

	w.Header().Set("Content-Type", f.MimeType)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, f.Name))
	io.Copy(w, obj)
}

func (h *Handler) RenameFile(w http.ResponseWriter, r *http.Request) {
	user := authutil.GetUser(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "nädogry ID")
		return
	}

	f, err := h.db.GetFile(id)
	if err != nil || f == nil {
		writeError(w, http.StatusNotFound, "faýl tapylmady")
		return
	}
	if f.OwnerID != user.ID && user.Role != "admin" {
		writeError(w, http.StatusForbidden, "rugsat ýok")
		return
	}

	var req models.RenameRequest
	if err := readJSON(r, &req); err != nil || strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "at girizilmeli")
		return
	}

	if err := h.db.RenameFile(id, strings.TrimSpace(req.Name)); err != nil {
		writeError(w, http.StatusInternalServerError, "ady üýtgedip bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) DeleteFile(w http.ResponseWriter, r *http.Request) {
	user := authutil.GetUser(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "nädogry ID")
		return
	}

	f, err := h.db.GetFile(id)
	if err != nil || f == nil {
		writeError(w, http.StatusNotFound, "faýl tapylmady")
		return
	}
	if f.OwnerID != user.ID && user.Role != "admin" {
		writeError(w, http.StatusForbidden, "rugsat ýok")
		return
	}

	if err := h.minio.Delete(r.Context(), f.MinioBucket, f.MinioKey); err != nil {
		writeError(w, http.StatusInternalServerError, "faýly pozup bolmady")
		return
	}
	if err := h.db.DeleteFile(id); err != nil {
		writeError(w, http.StatusInternalServerError, "faýl maglumatyny pozup bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) SearchFiles(w http.ResponseWriter, r *http.Request) {
	user := authutil.GetUser(r)
	q := r.URL.Query().Get("q")
	if q == "" {
		writeJSON(w, http.StatusOK, []models.File{})
		return
	}
	files, err := h.db.SearchFiles(user.ID, user.GroupID, q)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "gözleg ýalňyşlygy")
		return
	}
	if files == nil {
		files = []models.File{}
	}
	writeJSON(w, http.StatusOK, files)
}

func (h *Handler) StorageUsage(w http.ResponseWriter, r *http.Request) {
	user := authutil.GetUser(r)
	scope := r.URL.Query().Get("scope")
	if scope == "" {
		scope = "personal"
	}
	usage, err := h.db.GetStorageUsage(user.ID, scope, user.GroupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "ammar maglumatyny alyp bolmady")
		return
	}
	writeJSON(w, http.StatusOK, usage)
}

// Folders

func (h *Handler) CreateFolder(w http.ResponseWriter, r *http.Request) {
	user := authutil.GetUser(r)
	var req models.CreateFolderRequest
	if err := readJSON(r, &req); err != nil || strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "bukja ady girizilmeli")
		return
	}

	scope := req.Scope
	if scope == "" {
		scope = "personal"
	}

	folder := &models.Folder{
		Name:     strings.TrimSpace(req.Name),
		ParentID: req.ParentID,
		OwnerID:  user.ID,
		Scope:    scope,
	}
	if scope == "group" && user.GroupID != nil {
		folder.GroupID = user.GroupID
	}

	if err := h.db.CreateFolder(folder); err != nil {
		writeError(w, http.StatusInternalServerError, "bukja döredip bolmady")
		return
	}
	writeJSON(w, http.StatusCreated, folder)
}

func (h *Handler) RenameFolder(w http.ResponseWriter, r *http.Request) {
	user := authutil.GetUser(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "nädogry ID")
		return
	}

	folder, err := h.db.GetFolder(id)
	if err != nil || folder == nil {
		writeError(w, http.StatusNotFound, "bukja tapylmady")
		return
	}
	if folder.OwnerID != user.ID && user.Role != "admin" {
		writeError(w, http.StatusForbidden, "rugsat ýok")
		return
	}

	var req models.RenameRequest
	if err := readJSON(r, &req); err != nil || strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "at girizilmeli")
		return
	}

	if err := h.db.RenameFolder(id, strings.TrimSpace(req.Name)); err != nil {
		writeError(w, http.StatusInternalServerError, "ady üýtgedip bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) DeleteFolder(w http.ResponseWriter, r *http.Request) {
	user := authutil.GetUser(r)
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "nädogry ID")
		return
	}

	folder, err := h.db.GetFolder(id)
	if err != nil || folder == nil {
		writeError(w, http.StatusNotFound, "bukja tapylmady")
		return
	}
	if folder.OwnerID != user.ID && user.Role != "admin" {
		writeError(w, http.StatusForbidden, "rugsat ýok")
		return
	}

	if err := h.db.DeleteFolder(id); err != nil {
		writeError(w, http.StatusInternalServerError, "bukjany pozup bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

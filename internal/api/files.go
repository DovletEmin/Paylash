package api

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"net/http"
	"paylash/internal/authutil"
	"paylash/internal/models"
	"paylash/internal/storage"
	"strconv"
	"strings"
	"time"
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

	// Admin can list files for any group via group_id param
	groupID := user.GroupID
	if user.Role == "admin" {
		if gid := r.URL.Query().Get("group_id"); gid != "" {
			if n, err := strconv.Atoi(gid); err == nil {
				groupID = &n
			}
		}
	}

	files, err := h.db.ListFiles(user.ID, groupID, scope, folderID, sort, order)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "faýllary alyp bolmady")
		return
	}
	folders, err := h.db.ListFolders(user.ID, groupID, scope, folderID)
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

	// Only admin can upload to group/public scopes
	if (scope == "group" || scope == "public") && user.Role != "admin" {
		writeError(w, http.StatusForbidden, "diňe admin topar/umumy faýl ýükläp biler")
		return
	}

	// Determine bucket and check quota
	var bucket string
	var groupID *int
	if scope == "group" {
		gidStr := r.FormValue("group_id")
		gid, err := strconv.Atoi(gidStr)
		if err != nil || gid <= 0 {
			writeError(w, http.StatusBadRequest, "topar saýlanmaly")
			return
		}
		groupID = &gid
		bucket = storage.GroupBucket(gid)
	} else if scope == "public" {
		bucket = "public-files"
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
	if scope == "group" {
		f.Visibility = "group"
	} else if scope == "public" {
		f.Visibility = "public"
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

	// Read full content for http.ServeContent (supports Range requests for video/audio)
	data, err := io.ReadAll(obj)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "faýly okap bolmady")
		return
	}

	// Determine if inline or attachment
	disposition := "attachment"
	ct := f.MimeType
	if strings.HasPrefix(ct, "image/") || strings.HasPrefix(ct, "audio/") || strings.HasPrefix(ct, "video/") ||
		ct == "application/pdf" || strings.HasPrefix(ct, "text/") {
		disposition = "inline"
	}

	w.Header().Set("Content-Type", ct)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`%s; filename="%s"`, disposition, f.Name))
	http.ServeContent(w, r, f.Name, time.Now(), bytes.NewReader(data))
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

func (h *Handler) CreateBlankFile(w http.ResponseWriter, r *http.Request) {
	user := authutil.GetUser(r)

	var req models.CreateBlankFileRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "nädogry maglumat")
		return
	}

	req.Type = strings.ToLower(strings.TrimSpace(req.Type))
	if req.Type != "docx" && req.Type != "xlsx" && req.Type != "pdf" {
		writeError(w, http.StatusBadRequest, "nädogry faýl görnüşi (docx, xlsx, pdf)")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = "Täze dokument"
	}
	if !strings.HasSuffix(strings.ToLower(name), "."+req.Type) {
		name = name + "." + req.Type
	}

	scope := req.Scope
	if scope == "" {
		scope = "personal"
	}
	if (scope == "group" || scope == "public") && user.Role != "admin" {
		writeError(w, http.StatusForbidden, "diňe admin topar/umumy faýl döredip biler")
		return
	}

	var bucket string
	var groupID *int
	if scope == "group" {
		if req.GroupID != nil {
			groupID = req.GroupID
		} else {
			groupID = user.GroupID
		}
		if groupID == nil || *groupID <= 0 {
			writeError(w, http.StatusBadRequest, "topar saýlanmaly")
			return
		}
		bucket = storage.GroupBucket(*groupID)
	} else if scope == "public" {
		bucket = "public-files"
	} else {
		scope = "personal"
		bucket = storage.PersonalBucket(user.ID)
	}

	// Generate blank file content
	var fileBytes []byte
	var mimeType string
	var err error

	switch req.Type {
	case "docx":
		fileBytes, err = generateBlankDOCX()
		mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case "xlsx":
		fileBytes, err = generateBlankXLSX()
		mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case "pdf":
		fileBytes = generateBlankPDF()
		mimeType = "application/pdf"
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "faýl döredip bolmady")
		return
	}

	// Check quota
	usage, err := h.db.GetStorageUsage(user.ID, scope, groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "ammar maglumatyny alyp bolmady")
		return
	}
	if usage.UsedBytes+int64(len(fileBytes)) > usage.QuotaBytes {
		writeError(w, http.StatusForbidden, "ammar doly, ýer ýok")
		return
	}

	if err := h.minio.EnsureBucket(r.Context(), bucket); err != nil {
		writeError(w, http.StatusInternalServerError, "ammar döredip bolmady")
		return
	}

	key := fmt.Sprintf("%d/%s", user.ID, name)
	if req.FolderID != nil {
		key = fmt.Sprintf("%d/f%d/%s", user.ID, *req.FolderID, name)
	}

	reader := bytes.NewReader(fileBytes)
	if err := h.minio.Upload(r.Context(), bucket, key, reader, int64(len(fileBytes)), mimeType); err != nil {
		writeError(w, http.StatusInternalServerError, "faýly ýükläp bolmady")
		return
	}

	f := &models.File{
		Name:        name,
		MimeType:    mimeType,
		SizeBytes:   int64(len(fileBytes)),
		MinioBucket: bucket,
		MinioKey:    key,
		FolderID:    req.FolderID,
		OwnerID:     user.ID,
		GroupID:     groupID,
		Scope:       scope,
	}
	if scope == "group" {
		f.Visibility = "group"
	} else if scope == "public" {
		f.Visibility = "public"
	}
	if err := h.db.CreateFile(f); err != nil {
		writeError(w, http.StatusInternalServerError, "faýl maglumatyny saklap bolmady")
		return
	}

	writeJSON(w, http.StatusCreated, f)
}

// generateBlankDOCX creates a minimal valid DOCX file
func generateBlankDOCX() ([]byte, error) {
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	contentTypes := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

	rels := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

	document := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t></w:t></w:r></w:p>
  </w:body>
</w:document>`

	files := map[string]string{
		"[Content_Types].xml": contentTypes,
		"_rels/.rels":         rels,
		"word/document.xml":   document,
	}

	for name, content := range files {
		fw, err := zw.Create(name)
		if err != nil {
			return nil, err
		}
		if _, err := fw.Write([]byte(content)); err != nil {
			return nil, err
		}
	}

	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// generateBlankXLSX creates a minimal valid XLSX file using excelize
func generateBlankXLSX() ([]byte, error) {
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	contentTypes := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`

	rels := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

	workbookRels := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`

	workbook := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`

	sheet := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData/>
</worksheet>`

	files := map[string]string{
		"[Content_Types].xml":      contentTypes,
		"_rels/.rels":              rels,
		"xl/_rels/workbook.xml.rels": workbookRels,
		"xl/workbook.xml":          workbook,
		"xl/worksheets/sheet1.xml": sheet,
	}

	for name, content := range files {
		fw, err := zw.Create(name)
		if err != nil {
			return nil, err
		}
		if _, err := fw.Write([]byte(content)); err != nil {
			return nil, err
		}
	}

	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// generateBlankPDF creates a minimal valid PDF
func generateBlankPDF() []byte {
	pdf := `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
206
%%EOF`
	return []byte(pdf)
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

	// Only admin can create folders in group/public scopes
	if (scope == "group" || scope == "public") && user.Role != "admin" {
		writeError(w, http.StatusForbidden, "diňe admin topar/umumy papka döredip biler")
		return
	}

	folder := &models.Folder{
		Name:     strings.TrimSpace(req.Name),
		ParentID: req.ParentID,
		OwnerID:  user.ID,
		Scope:    scope,
	}
	if scope == "group" && req.GroupID != nil {
		folder.GroupID = req.GroupID
	} else if scope == "group" && user.GroupID != nil {
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

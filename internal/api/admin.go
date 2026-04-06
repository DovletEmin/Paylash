package api

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"paylash/internal/authutil"
	"paylash/internal/models"
	"paylash/internal/storage"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
)

// Admin Dashboard
func (h *Handler) AdminDashboard(w http.ResponseWriter, r *http.Request) {
	dash, err := h.db.GetDashboard()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "maglumat alyp bolmady")
		return
	}
	writeJSON(w, http.StatusOK, dash)
}

// Faculties
func (h *Handler) AdminCreateFaculty(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if err := readJSON(r, &req); err != nil || strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "fakultet ady girizilmeli")
		return
	}
	f, err := h.db.CreateFaculty(strings.TrimSpace(req.Name))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fakultet döredip bolmady")
		return
	}
	writeJSON(w, http.StatusCreated, f)
}

func (h *Handler) AdminUpdateFaculty(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "nädogry ID")
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := readJSON(r, &req); err != nil || strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "at girizilmeli")
		return
	}
	if err := h.db.UpdateFaculty(id, strings.TrimSpace(req.Name)); err != nil {
		writeError(w, http.StatusInternalServerError, "üýtgedip bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) AdminDeleteFaculty(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "nädogry ID")
		return
	}
	if err := h.db.DeleteFaculty(id); err != nil {
		writeError(w, http.StatusInternalServerError, "pozup bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Courses
func (h *Handler) AdminCreateCourse(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name      string `json:"name"`
		FacultyID int    `json:"faculty_id"`
	}
	if err := readJSON(r, &req); err != nil || strings.TrimSpace(req.Name) == "" || req.FacultyID == 0 {
		writeError(w, http.StatusBadRequest, "kurs ady we fakultet saýlanmaly")
		return
	}
	c, err := h.db.CreateCourse(strings.TrimSpace(req.Name), req.FacultyID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "kurs döredip bolmady")
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

func (h *Handler) AdminUpdateCourse(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "nädogry ID")
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := readJSON(r, &req); err != nil || strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "at girizilmeli")
		return
	}
	if err := h.db.UpdateCourse(id, strings.TrimSpace(req.Name)); err != nil {
		writeError(w, http.StatusInternalServerError, "üýtgedip bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) AdminDeleteCourse(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "nädogry ID")
		return
	}
	if err := h.db.DeleteCourse(id); err != nil {
		writeError(w, http.StatusInternalServerError, "pozup bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Groups
func (h *Handler) AdminCreateGroup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name       string `json:"name"`
		CourseID   int    `json:"course_id"`
		QuotaBytes int64  `json:"quota_bytes"`
	}
	if err := readJSON(r, &req); err != nil || strings.TrimSpace(req.Name) == "" || req.CourseID == 0 {
		writeError(w, http.StatusBadRequest, "topar ady we kurs saýlanmaly")
		return
	}
	if req.QuotaBytes <= 0 {
		req.QuotaBytes = 5 * 1024 * 1024 * 1024 // 5 GB
	}
	g, err := h.db.CreateGroup(strings.TrimSpace(req.Name), req.CourseID, req.QuotaBytes)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "topar döredip bolmady")
		return
	}
	// Create MinIO bucket for group
	if err := h.minio.EnsureBucket(r.Context(), storage.GroupBucket(g.ID)); err != nil {
		writeError(w, http.StatusInternalServerError, "ammar döredip bolmady")
		return
	}
	writeJSON(w, http.StatusCreated, g)
}

func (h *Handler) AdminUpdateGroup(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "nädogry ID")
		return
	}
	var req struct {
		Name       string `json:"name"`
		QuotaBytes int64  `json:"quota_bytes"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "nädogry maglumat")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "at girizilmeli")
		return
	}
	if err := h.db.UpdateGroup(id, strings.TrimSpace(req.Name), req.QuotaBytes); err != nil {
		writeError(w, http.StatusInternalServerError, "üýtgedip bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) AdminDeleteGroup(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "nädogry ID")
		return
	}
	if err := h.db.DeleteGroup(id); err != nil {
		writeError(w, http.StatusInternalServerError, "pozup bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Users management
func (h *Handler) AdminListUsers(w http.ResponseWriter, r *http.Request) {
	facultyID, _ := strconv.Atoi(r.URL.Query().Get("faculty_id"))
	courseID, _ := strconv.Atoi(r.URL.Query().Get("course_id"))
	groupID, _ := strconv.Atoi(r.URL.Query().Get("group_id"))

	users, err := h.db.ListUsers(facultyID, courseID, groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "ulanyjylary alyp bolmady")
		return
	}
	if users == nil {
		users = []models.User{}
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *Handler) AdminUpdateUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "nädogry ID")
		return
	}
	var req struct {
		Role        string `json:"role"`
		QuotaBytes  int64  `json:"quota_bytes"`
		GroupID     *int   `json:"group_id"`
		FacultyID   *int   `json:"faculty_id"`
		CourseID    *int   `json:"course_id"`
		DisplayName string `json:"display_name"`
		Password    string `json:"password"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "nädogry maglumat")
		return
	}
	if req.Role != "user" && req.Role != "admin" {
		req.Role = "user"
	}
	var hash string
	if req.Password != "" {
		if len(req.Password) < 6 {
			writeError(w, http.StatusBadRequest, "parol azyndan 6 simwol bolmaly")
			return
		}
		h2, err := authutil.HashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "ýalňyşlyk")
			return
		}
		hash = h2
	}
	if err := h.db.UpdateUser(id, req.Role, req.QuotaBytes, req.GroupID, req.FacultyID, req.CourseID, req.DisplayName, hash); err != nil {
		writeError(w, http.StatusInternalServerError, "üýtgedip bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) AdminDeleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "nädogry ID")
		return
	}
	if err := h.db.DeleteUser(id); err != nil {
		writeError(w, http.StatusInternalServerError, "pozup bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) AdminDeleteAllUsers(w http.ResponseWriter, r *http.Request) {
	count, err := h.db.DeleteAllUsersExceptAdmin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "pozup bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "deleted": count})
}

func (h *Handler) AdminCreateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username  string `json:"username"`
		Password  string `json:"password"`
		FullName  string `json:"full_name"`
		Role      string `json:"role"`
		FacultyID int    `json:"faculty_id"`
		CourseID  int    `json:"course_id"`
		GroupID   int    `json:"group_id"`
		QuotaMB   int    `json:"quota_mb"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "n\u00e4dogry maglumat")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if len(req.Username) < 3 {
		writeError(w, http.StatusBadRequest, "ulanyjy ady azyndan 3 harp bolmaly")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "parol azyndan 6 simwol bolmaly")
		return
	}
	exists, err := h.db.UserExists(req.Username)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "\u00fda\u0148ly\u015flyk")
		return
	}
	if exists {
		writeError(w, http.StatusConflict, "bu ulanyjy ady e\u00fd\u00fd\u00e4m bar")
		return
	}
	hash, err := authutil.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "\u00fda\u0148ly\u015flyk")
		return
	}
	regReq := &models.RegisterRequest{
		Username:  req.Username,
		Password:  req.Password,
		FullName:  strings.TrimSpace(req.FullName),
		FacultyID: req.FacultyID,
		CourseID:  req.CourseID,
		GroupID:   req.GroupID,
	}
	user, err := h.db.CreateUser(regReq, hash)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "ulanyjy d\u00f6redip bolmady")
		return
	}
	if req.Role == "admin" {
		h.db.UpdateUser(user.ID, "admin", user.QuotaBytes, user.GroupID, user.FacultyID, user.CourseID, user.DisplayName, "")
	}
	if req.QuotaMB > 0 {
		h.db.UpdateUser(user.ID, req.Role, int64(req.QuotaMB)*1024*1024, user.GroupID, user.FacultyID, user.CourseID, user.DisplayName, "")
	}
	bucket := storage.PersonalBucket(user.ID)
	h.minio.EnsureBucket(r.Context(), bucket)
	writeJSON(w, http.StatusCreated, user)
}

func (h *Handler) AdminBulkUserQuota(w http.ResponseWriter, r *http.Request) {
	var req struct {
		QuotaMB int64 `json:"quota_mb"`
	}
	if err := readJSON(r, &req); err != nil || req.QuotaMB <= 0 {
		writeError(w, http.StatusBadRequest, "kwota girizilmeli")
		return
	}
	if err := h.db.SetAllUsersQuota(req.QuotaMB * 1024 * 1024); err != nil {
		writeError(w, http.StatusInternalServerError, "\u00fc\u00fdtgedip bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) AdminBulkGroupQuota(w http.ResponseWriter, r *http.Request) {
	var req struct {
		QuotaMB int64 `json:"quota_mb"`
	}
	if err := readJSON(r, &req); err != nil || req.QuotaMB <= 0 {
		writeError(w, http.StatusBadRequest, "kwota girizilmeli")
		return
	}
	if err := h.db.SetAllGroupsQuota(req.QuotaMB * 1024 * 1024); err != nil {
		writeError(w, http.StatusInternalServerError, "\u00fc\u00fdtgedip bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) AdminImportUsers(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "faýl juda uly")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "faýl tapylmady")
		return
	}
	defer file.Close()

	name := strings.ToLower(header.Filename)
	var rows [][]string

	if strings.HasSuffix(name, ".xlsx") || strings.HasSuffix(name, ".xls") {
		xlsx, err := excelize.OpenReader(file)
		if err != nil {
			writeError(w, http.StatusBadRequest, "XLSX faýly okap bolmady")
			return
		}
		defer xlsx.Close()
		sheet := xlsx.GetSheetName(0)
		rows, err = xlsx.GetRows(sheet)
		if err != nil {
			writeError(w, http.StatusBadRequest, "XLSX sahypasyny okap bolmady")
			return
		}
	} else {
		reader := csv.NewReader(file)
		reader.LazyQuotes = true
		reader.TrimLeadingSpace = true
		rows, err = reader.ReadAll()
		if err != nil {
			writeError(w, http.StatusBadRequest, "CSV faýly okap bolmady")
			return
		}
	}

	if len(rows) < 2 {
		writeError(w, http.StatusBadRequest, "faýlda maglumat ýok (diňe başlyk bar)")
		return
	}

	type importResult struct {
		Username string `json:"username"`
		Success  bool   `json:"success"`
		Error    string `json:"error,omitempty"`
	}
	var results []importResult
	created := 0

	for i, row := range rows[1:] {
		if len(row) < 6 {
			results = append(results, importResult{Username: fmt.Sprintf("setir %d", i+2), Error: "ýeterlik sütün ýok (6 gerek)"})
			continue
		}
		username := strings.TrimSpace(row[0])
		password := strings.TrimSpace(row[1])
		fullName := strings.TrimSpace(row[2])
		facultyID, _ := strconv.Atoi(strings.TrimSpace(row[3]))
		courseID, _ := strconv.Atoi(strings.TrimSpace(row[4]))
		groupID, _ := strconv.Atoi(strings.TrimSpace(row[5]))
		quotaMB := 10240
		if len(row) >= 7 {
			if q, err := strconv.Atoi(strings.TrimSpace(row[6])); err == nil && q > 0 {
				quotaMB = q
			}
		}

		if len(username) < 3 {
			results = append(results, importResult{Username: username, Error: "ulanyjy ady azyndan 3 harp"})
			continue
		}
		if len(password) < 6 {
			results = append(results, importResult{Username: username, Error: "parol azyndan 6 simwol"})
			continue
		}
		if facultyID == 0 || courseID == 0 || groupID == 0 {
			results = append(results, importResult{Username: username, Error: "fakultet, kurs we topar ID girizilmeli"})
			continue
		}

		exists, _ := h.db.UserExists(username)
		if exists {
			results = append(results, importResult{Username: username, Error: "eýýäm bar"})
			continue
		}

		hash, err := authutil.HashPassword(password)
		if err != nil {
			results = append(results, importResult{Username: username, Error: "parol hashlap bolmady"})
			continue
		}

		regReq := &models.RegisterRequest{
			Username:  username,
			Password:  password,
			FullName:  fullName,
			FacultyID: facultyID,
			CourseID:  courseID,
			GroupID:   groupID,
		}
		user, err := h.db.CreateUser(regReq, hash)
		if err != nil {
			results = append(results, importResult{Username: username, Error: "döredip bolmady"})
			continue
		}

		if quotaMB > 0 {
			h.db.UpdateUser(user.ID, "user", int64(quotaMB)*1024*1024, &groupID, user.FacultyID, user.CourseID, user.DisplayName, "")
		}

		bucket := storage.PersonalBucket(user.ID)
		h.minio.EnsureBucket(r.Context(), bucket)

		results = append(results, importResult{Username: username, Success: true})
		created++
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"created": created,
		"total":   len(rows) - 1,
		"results": results,
	})
}

func (h *Handler) AdminGetPublicQuota(w http.ResponseWriter, r *http.Request) {
	val, err := h.db.GetSetting("public_quota_bytes")
	if err != nil {
		val = "53687091200"
	}
	bytes, _ := strconv.ParseInt(val, 10, 64)
	if bytes <= 0 {
		bytes = 53687091200
	}
	writeJSON(w, http.StatusOK, map[string]int64{"quota_bytes": bytes})
}

func (h *Handler) AdminSetPublicQuota(w http.ResponseWriter, r *http.Request) {
	var req struct {
		QuotaMB int64 `json:"quota_mb"`
	}
	if err := readJSON(r, &req); err != nil || req.QuotaMB <= 0 {
		writeError(w, http.StatusBadRequest, "kwota girizilmeli")
		return
	}
	bytes := req.QuotaMB * 1024 * 1024
	if err := h.db.SetSetting("public_quota_bytes", strconv.FormatInt(bytes, 10)); err != nil {
		writeError(w, http.StatusInternalServerError, "üýtgedip bolmady")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
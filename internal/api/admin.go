package api

import (
	"net/http"
	"paylash/internal/models"
	"paylash/internal/storage"
	"strconv"
	"strings"
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
		Role       string `json:"role"`
		QuotaBytes int64  `json:"quota_bytes"`
		GroupID    *int   `json:"group_id"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "nädogry maglumat")
		return
	}
	if req.Role != "user" && req.Role != "admin" {
		req.Role = "user"
	}
	if err := h.db.UpdateUser(id, req.Role, req.QuotaBytes, req.GroupID); err != nil {
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

package api

import (
	"net/http"
	"paylash/internal/authutil"
	"paylash/internal/models"
	"paylash/internal/storage"
	"strings"
	"time"
)

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "nädogry maglumat")
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
	if req.FacultyID == 0 || req.CourseID == 0 || req.GroupID == 0 {
		writeError(w, http.StatusBadRequest, "fakultet, kurs we topar saýlanmaly")
		return
	}

	exists, err := h.db.UserExists(req.Username)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "ýalňyşlyk ýüze çykdy")
		return
	}
	if exists {
		writeError(w, http.StatusConflict, "bu ulanyjy ady eýýäm bar")
		return
	}

	hash, err := authutil.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "ýalňyşlyk ýüze çykdy")
		return
	}

	user, err := h.db.CreateUser(&req, hash)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "hasap döredip bolmady")
		return
	}

	// Create personal bucket in MinIO
	bucket := storage.PersonalBucket(user.ID)
	if err := h.minio.EnsureBucket(r.Context(), bucket); err != nil {
		writeError(w, http.StatusInternalServerError, "ammar döredip bolmady")
		return
	}

	writeJSON(w, http.StatusCreated, user)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "nädogry maglumat")
		return
	}

	user, err := h.db.GetUserByUsername(strings.TrimSpace(req.Username))
	if err != nil || user == nil {
		writeError(w, http.StatusUnauthorized, "nädogry ulanyjy ady ýa-da parol")
		return
	}

	if !authutil.CheckPassword(req.Password, user.PasswordHash) {
		writeError(w, http.StatusUnauthorized, "nädogry ulanyjy ady ýa-da parol")
		return
	}

	session, err := h.db.CreateSession(user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "sessiýa döredip bolmady")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    session.ID,
		Path:     "/",
		Expires:  session.ExpiresAt,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session")
	if err == nil {
		h.db.DeleteSession(cookie.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
	})
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	user := authutil.GetUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "ulgama giriň")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

package db

import (
	"database/sql"
	"paylash/internal/models"
	"strconv"
)

func (d *DB) CreateUser(u *models.RegisterRequest, hash string) (*models.User, error) {
	user := &models.User{}
	err := d.QueryRow(
		`INSERT INTO users (username, password_hash, display_name, role, faculty_id, course_id, group_id)
		 VALUES ($1, $2, $3, 'user', $4, $5, $6)
		 RETURNING id, username, display_name, role, faculty_id, course_id, group_id, quota_bytes, created_at`,
		u.Username, hash, u.FullName, u.FacultyID, u.CourseID, u.GroupID,
	).Scan(&user.ID, &user.Username, &user.DisplayName, &user.Role, &user.FacultyID, &user.CourseID, &user.GroupID, &user.QuotaBytes, &user.CreatedAt)
	return user, err
}

func (d *DB) GetUserByUsername(username string) (*models.User, error) {
	u := &models.User{}
	err := d.QueryRow(
		`SELECT id, username, password_hash, display_name, role, faculty_id, course_id, group_id, quota_bytes, created_at
		 FROM users WHERE username = $1`, username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.DisplayName, &u.Role, &u.FacultyID, &u.CourseID, &u.GroupID, &u.QuotaBytes, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return u, err
}

func (d *DB) GetUserByID(id int) (*models.User, error) {
	u := &models.User{}
	err := d.QueryRow(
		`SELECT id, username, password_hash, display_name, role, faculty_id, course_id, group_id, quota_bytes, created_at
		 FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.DisplayName, &u.Role, &u.FacultyID, &u.CourseID, &u.GroupID, &u.QuotaBytes, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return u, err
}

func (d *DB) SearchUsers(query string, limit int) ([]models.UserSearchResult, error) {
	rows, err := d.Query(
		`SELECT u.id, u.username, u.display_name, COALESCE(g.name, '')
		 FROM users u LEFT JOIN groups g ON u.group_id = g.id
		 WHERE u.role = 'user' AND (u.username ILIKE $1 OR u.display_name ILIKE $1)
		 ORDER BY u.username LIMIT $2`,
		"%"+query+"%", limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []models.UserSearchResult
	for rows.Next() {
		var r models.UserSearchResult
		if err := rows.Scan(&r.ID, &r.Username, &r.DisplayName, &r.GroupName); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

func (d *DB) ListUsers(facultyID, courseID, groupID int) ([]models.User, error) {
	q := `SELECT id, username, display_name, role, faculty_id, course_id, group_id, quota_bytes, created_at
	      FROM users WHERE role = 'user'`
	args := []any{}
	n := 0
	if facultyID > 0 {
		n++
		q += ` AND faculty_id = $` + itoa(n)
		args = append(args, facultyID)
	}
	if courseID > 0 {
		n++
		q += ` AND course_id = $` + itoa(n)
		args = append(args, courseID)
	}
	if groupID > 0 {
		n++
		q += ` AND group_id = $` + itoa(n)
		args = append(args, groupID)
	}
	q += ` ORDER BY created_at DESC`

	rows, err := d.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.Role, &u.FacultyID, &u.CourseID, &u.GroupID, &u.QuotaBytes, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (d *DB) UpdateUser(id int, role string, quotaBytes int64, groupID *int) error {
	_, err := d.Exec(
		`UPDATE users SET role = $1, quota_bytes = $2, group_id = $3 WHERE id = $4`,
		role, quotaBytes, groupID, id,
	)
	return err
}

func (d *DB) DeleteUser(id int) error {
	_, err := d.Exec(`DELETE FROM users WHERE id = $1`, id)
	return err
}

func (d *DB) UserExists(username string) (bool, error) {
	var exists bool
	err := d.QueryRow(`SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)`, username).Scan(&exists)
	return exists, err
}

func itoa(n int) string {
	return strconv.Itoa(n)
}

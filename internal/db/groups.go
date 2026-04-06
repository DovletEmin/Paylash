package db

import (
	"fmt"
	"paylash/internal/models"
	"strconv"
	"strings"
)

// Faculties

func (d *DB) CreateFaculty(name string) (*models.Faculty, error) {
	f := &models.Faculty{}
	err := d.QueryRow(
		`INSERT INTO faculties (name) VALUES ($1) RETURNING id, name, created_at`, name,
	).Scan(&f.ID, &f.Name, &f.CreatedAt)
	return f, err
}

func (d *DB) ListFaculties() ([]models.Faculty, error) {
	rows, err := d.Query(`SELECT id, name, created_at FROM faculties ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.Faculty
	for rows.Next() {
		var f models.Faculty
		if err := rows.Scan(&f.ID, &f.Name, &f.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, f)
	}
	return list, rows.Err()
}

func (d *DB) UpdateFaculty(id int, name string) error {
	_, err := d.Exec(`UPDATE faculties SET name = $1 WHERE id = $2`, name, id)
	return err
}

func (d *DB) DeleteFaculty(id int) error {
	_, err := d.Exec(`DELETE FROM faculties WHERE id = $1`, id)
	return err
}

// Courses

func (d *DB) CreateCourse(name string, facultyID int) (*models.Course, error) {
	c := &models.Course{}
	err := d.QueryRow(
		`INSERT INTO courses (name, faculty_id) VALUES ($1, $2) RETURNING id, name, faculty_id, created_at`,
		name, facultyID,
	).Scan(&c.ID, &c.Name, &c.FacultyID, &c.CreatedAt)
	return c, err
}

func (d *DB) ListCoursesByFaculty(facultyID int) ([]models.Course, error) {
	rows, err := d.Query(
		`SELECT id, name, faculty_id, created_at FROM courses WHERE faculty_id = $1 ORDER BY name`, facultyID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.Course
	for rows.Next() {
		var c models.Course
		if err := rows.Scan(&c.ID, &c.Name, &c.FacultyID, &c.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

func (d *DB) UpdateCourse(id int, name string) error {
	_, err := d.Exec(`UPDATE courses SET name = $1 WHERE id = $2`, name, id)
	return err
}

func (d *DB) DeleteCourse(id int) error {
	_, err := d.Exec(`DELETE FROM courses WHERE id = $1`, id)
	return err
}

// Groups

func (d *DB) CreateGroup(name string, courseID int, quotaBytes int64) (*models.Group, error) {
	g := &models.Group{}
	bucket := fmt.Sprintf("group-%d", 0) // placeholder, updated after insert
	err := d.QueryRow(
		`INSERT INTO groups (name, course_id, quota_bytes, minio_bucket)
		 VALUES ($1, $2, $3, $4) RETURNING id, name, course_id, quota_bytes, minio_bucket, created_at`,
		name, courseID, quotaBytes, bucket,
	).Scan(&g.ID, &g.Name, &g.CourseID, &g.QuotaBytes, &g.MinioBucket, &g.CreatedAt)
	if err != nil {
		return nil, err
	}
	g.MinioBucket = fmt.Sprintf("group-%d", g.ID)
	_, err = d.Exec(`UPDATE groups SET minio_bucket = $1 WHERE id = $2`, g.MinioBucket, g.ID)
	return g, err
}

func (d *DB) ListGroupsByCourse(courseID int) ([]models.Group, error) {
	rows, err := d.Query(
		`SELECT id, name, course_id, quota_bytes, minio_bucket, created_at
		 FROM groups WHERE course_id = $1 ORDER BY name`, courseID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.Group
	for rows.Next() {
		var g models.Group
		if err := rows.Scan(&g.ID, &g.Name, &g.CourseID, &g.QuotaBytes, &g.MinioBucket, &g.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, g)
	}
	return list, rows.Err()
}

func (d *DB) GetGroup(id int) (*models.Group, error) {
	g := &models.Group{}
	err := d.QueryRow(
		`SELECT id, name, course_id, quota_bytes, minio_bucket, created_at FROM groups WHERE id = $1`, id,
	).Scan(&g.ID, &g.Name, &g.CourseID, &g.QuotaBytes, &g.MinioBucket, &g.CreatedAt)
	return g, err
}

func (d *DB) UpdateGroup(id int, name string, quotaBytes int64) error {
	_, err := d.Exec(`UPDATE groups SET name = $1, quota_bytes = $2 WHERE id = $3`, name, quotaBytes, id)
	return err
}

func (d *DB) DeleteGroup(id int) error {
	_, err := d.Exec(`DELETE FROM groups WHERE id = $1`, id)
	return err
}

func (d *DB) ListAllGroups() ([]models.Group, error) {
	rows, err := d.Query(`SELECT id, name, course_id, quota_bytes, minio_bucket, created_at FROM groups ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.Group
	for rows.Next() {
		var g models.Group
		if err := rows.Scan(&g.ID, &g.Name, &g.CourseID, &g.QuotaBytes, &g.MinioBucket, &g.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, g)
	}
	return list, rows.Err()
}

// Dashboard

func (d *DB) GetDashboard() (*models.AdminDashboard, error) {
	dash := &models.AdminDashboard{}
	err := d.QueryRow(`SELECT COUNT(*) FROM users WHERE role = 'user'`).Scan(&dash.TotalUsers)
	if err != nil {
		return nil, err
	}
	_ = d.QueryRow(`SELECT COUNT(*) FROM groups`).Scan(&dash.TotalGroups)
	_ = d.QueryRow(`SELECT COUNT(*) FROM files`).Scan(&dash.TotalFiles)
	_ = d.QueryRow(`SELECT COALESCE(SUM(size_bytes), 0) FROM files`).Scan(&dash.TotalBytes)
	_ = d.QueryRow(`SELECT COUNT(*) FROM faculties`).Scan(&dash.TotalFaculties)
	_ = d.QueryRow(`SELECT COUNT(*) FROM courses`).Scan(&dash.TotalCourses)
	return dash, nil
}

// Helper for building dynamic queries safely
func buildPlaceholders(start, count int) string {
	parts := make([]string, count)
	for i := range parts {
		parts[i] = "$" + strconv.Itoa(start+i)
	}
	return strings.Join(parts, ", ")
}

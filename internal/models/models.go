package models

import "time"

type User struct {
	ID           int       `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	DisplayName  string    `json:"full_name"`
	Role         string    `json:"role"`
	FacultyID    *int      `json:"faculty_id"`
	CourseID     *int      `json:"course_id"`
	GroupID      *int      `json:"group_id"`
	QuotaBytes   int64     `json:"quota_bytes"`
	AvatarURL    string    `json:"avatar_url"`
	CreatedAt    time.Time `json:"created_at"`
}

type Faculty struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Course struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	FacultyID int       `json:"faculty_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Group struct {
	ID         int       `json:"id"`
	Name       string    `json:"name"`
	CourseID   int       `json:"course_id"`
	QuotaBytes int64     `json:"quota_bytes"`
	MinioBucket string   `json:"minio_bucket"`
	CreatedAt  time.Time `json:"created_at"`
}

type Folder struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	ParentID  *int      `json:"parent_id"`
	OwnerID   int       `json:"owner_id"`
	GroupID   *int      `json:"group_id"`
	Scope     string    `json:"scope"`
	CreatedAt time.Time `json:"created_at"`
}

type File struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	MimeType    string    `json:"mime_type"`
	SizeBytes   int64     `json:"size_bytes"`
	MinioBucket string    `json:"minio_bucket"`
	MinioKey    string    `json:"minio_key"`
	FolderID    *int      `json:"folder_id"`
	OwnerID     int       `json:"owner_id"`
	GroupID     *int      `json:"group_id"`
	Scope       string    `json:"scope"`
	Visibility  string    `json:"visibility"`
	Version     int       `json:"version"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type FileShare struct {
	ID         int       `json:"id"`
	FileID     int       `json:"file_id"`
	SharedBy   int       `json:"shared_by"`
	SharedWith *int      `json:"shared_with"`
	Permission string    `json:"permission"`
	IsPublic   bool      `json:"is_public"`
	CreatedAt  time.Time `json:"created_at"`
}

type WOPIToken struct {
	ID         int       `json:"id"`
	Token      string    `json:"token"`
	FileID     int       `json:"file_id"`
	UserID     int       `json:"user_id"`
	Permission string    `json:"permission"`
	ExpiresAt  time.Time `json:"expires_at"`
	CreatedAt  time.Time `json:"created_at"`
}

type ShareView struct {
	ID         int       `json:"id"`
	FileID     int       `json:"file_id"`
	SharedBy   int       `json:"shared_by"`
	SharedWith *int      `json:"shared_with"`
	Permission string    `json:"permission"`
	IsPublic   bool      `json:"is_public"`
	FullName   string    `json:"full_name"`
	Username   string    `json:"username"`
	CreatedAt  time.Time `json:"created_at"`
}

type Session struct {
	ID        string    `json:"id"`
	UserID    int       `json:"user_id"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// API request/response types

type RegisterRequest struct {
	Username  string `json:"username"`
	Password  string `json:"password"`
	FullName  string `json:"full_name"`
	FacultyID int    `json:"faculty_id"`
	CourseID  int    `json:"course_id"`
	GroupID   int    `json:"group_id"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type CreateFolderRequest struct {
	Name     string `json:"name"`
	ParentID *int   `json:"parent_id"`
	Scope    string `json:"scope"`
}

type RenameRequest struct {
	Name string `json:"name"`
}

type VisibilityRequest struct {
	Visibility string `json:"visibility"`
}

type ShareRequest struct {
	UserID     *int   `json:"user_id"`
	Permission string `json:"permission"`
	IsPublic   bool   `json:"is_public"`
}

type FileListResponse struct {
	Files   []File   `json:"files"`
	Folders []Folder `json:"folders"`
}

type StorageUsage struct {
	UsedBytes  int64 `json:"used_bytes"`
	QuotaBytes int64 `json:"quota_bytes"`
}

type AdminDashboard struct {
	TotalUsers     int   `json:"total_users"`
	TotalGroups    int   `json:"total_groups"`
	TotalFiles     int   `json:"total_files"`
	TotalBytes     int64 `json:"total_bytes"`
	TotalFaculties int   `json:"total_faculties"`
	TotalCourses   int   `json:"total_courses"`
}

type SharedFileView struct {
	File
	SharedByName string `json:"owner_name"`
	Permission   string `json:"permission"`
	SharedAt     time.Time `json:"shared_at"`
}

type UserSearchResult struct {
	ID          int    `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"full_name"`
	GroupName   string `json:"group_name"`
}

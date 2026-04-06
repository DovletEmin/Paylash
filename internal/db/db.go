package db

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

type DB struct {
	*sql.DB
}

func Connect(dsn string) (*DB, error) {
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("db connect: %w", err)
	}
	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("db ping: %w", err)
	}
	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(5)
	return &DB{conn}, nil
}

func (d *DB) Migrate() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS faculties (
			id         SERIAL PRIMARY KEY,
			name       VARCHAR(255) NOT NULL UNIQUE,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS courses (
			id         SERIAL PRIMARY KEY,
			name       VARCHAR(100) NOT NULL,
			faculty_id INT REFERENCES faculties(id) ON DELETE CASCADE,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(name, faculty_id)
		)`,
		`CREATE TABLE IF NOT EXISTS groups (
			id           SERIAL PRIMARY KEY,
			name         VARCHAR(100) NOT NULL,
			course_id    INT REFERENCES courses(id) ON DELETE CASCADE,
			quota_bytes  BIGINT DEFAULT 5368709120,
			minio_bucket VARCHAR(255),
			created_at   TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS users (
			id            SERIAL PRIMARY KEY,
			username      VARCHAR(100) NOT NULL UNIQUE,
			password_hash VARCHAR(255) NOT NULL,
			display_name  VARCHAR(255) DEFAULT '',
			role          VARCHAR(20) DEFAULT 'user',
			faculty_id    INT REFERENCES faculties(id) ON DELETE SET NULL,
			course_id     INT REFERENCES courses(id) ON DELETE SET NULL,
			group_id      INT REFERENCES groups(id) ON DELETE SET NULL,
			quota_bytes   BIGINT DEFAULT 1073741824,
			created_at    TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS folders (
			id         SERIAL PRIMARY KEY,
			name       VARCHAR(255) NOT NULL,
			parent_id  INT REFERENCES folders(id) ON DELETE CASCADE,
			owner_id   INT REFERENCES users(id) ON DELETE CASCADE,
			group_id   INT REFERENCES groups(id) ON DELETE CASCADE,
			scope      VARCHAR(20) NOT NULL DEFAULT 'personal',
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS files (
			id           SERIAL PRIMARY KEY,
			name         VARCHAR(500) NOT NULL,
			mime_type    VARCHAR(255) DEFAULT '',
			size_bytes   BIGINT NOT NULL DEFAULT 0,
			minio_bucket VARCHAR(255) NOT NULL,
			minio_key    VARCHAR(1000) NOT NULL,
			folder_id    INT REFERENCES folders(id) ON DELETE SET NULL,
			owner_id     INT REFERENCES users(id) ON DELETE CASCADE,
			group_id     INT REFERENCES groups(id) ON DELETE SET NULL,
			scope        VARCHAR(20) NOT NULL DEFAULT 'personal',
			version      INT DEFAULT 1,
			created_at   TIMESTAMPTZ DEFAULT NOW(),
			updated_at   TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS file_shares (
			id          SERIAL PRIMARY KEY,
			file_id     INT REFERENCES files(id) ON DELETE CASCADE,
			shared_by   INT REFERENCES users(id) ON DELETE CASCADE,
			shared_with INT REFERENCES users(id) ON DELETE CASCADE,
			permission  VARCHAR(20) DEFAULT 'view',
			is_public   BOOLEAN DEFAULT FALSE,
			created_at  TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(file_id, shared_with)
		)`,
		`CREATE TABLE IF NOT EXISTS wopi_tokens (
			id         SERIAL PRIMARY KEY,
			token      VARCHAR(255) NOT NULL UNIQUE,
			file_id    INT REFERENCES files(id) ON DELETE CASCADE,
			user_id    INT REFERENCES users(id) ON DELETE CASCADE,
			permission VARCHAR(20) DEFAULT 'view',
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id         VARCHAR(255) PRIMARY KEY,
			user_id    INT REFERENCES users(id) ON DELETE CASCADE,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id)`,
		`CREATE INDEX IF NOT EXISTS idx_files_group ON files(group_id)`,
		`CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id)`,
		`CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner_id)`,
		`CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id)`,
		`CREATE INDEX IF NOT EXISTS idx_file_shares_file ON file_shares(file_id)`,
		`CREATE INDEX IF NOT EXISTS idx_file_shares_with ON file_shares(shared_with)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_wopi_tokens_token ON wopi_tokens(token)`,
		`ALTER TABLE files ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'private'`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) DEFAULT ''`,
	}

	for _, m := range migrations {
		if _, err := d.Exec(m); err != nil {
			return fmt.Errorf("migration failed: %w\nSQL: %s", err, m)
		}
	}
	log.Println("database migrations completed")
	return nil
}

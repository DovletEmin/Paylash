package db

import (
	"paylash/internal/models"
)

func (d *DB) CreateShare(fileID, sharedBy int, sharedWith *int, permission string, isPublic bool) (*models.FileShare, error) {
	s := &models.FileShare{}
	err := d.QueryRow(
		`INSERT INTO file_shares (file_id, shared_by, shared_with, permission, is_public)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (file_id, shared_with) DO UPDATE SET permission = $4
		 RETURNING id, file_id, shared_by, shared_with, permission, is_public, created_at`,
		fileID, sharedBy, sharedWith, permission, isPublic,
	).Scan(&s.ID, &s.FileID, &s.SharedBy, &s.SharedWith, &s.Permission, &s.IsPublic, &s.CreatedAt)
	return s, err
}

func (d *DB) SetPublicShare(fileID, sharedBy int, isPublic bool) error {
	if isPublic {
		_, err := d.Exec(
			`INSERT INTO file_shares (file_id, shared_by, shared_with, permission, is_public)
			 VALUES ($1, $2, NULL, 'view', TRUE)
			 ON CONFLICT (file_id, shared_with) DO UPDATE SET is_public = TRUE`,
			fileID, sharedBy,
		)
		return err
	}
	_, err := d.Exec(`DELETE FROM file_shares WHERE file_id = $1 AND is_public = TRUE AND shared_with IS NULL`, fileID)
	return err
}

func (d *DB) DeleteShare(fileID, sharedWithID int) error {
	_, err := d.Exec(
		`DELETE FROM file_shares WHERE file_id = $1 AND shared_with = $2`,
		fileID, sharedWithID,
	)
	return err
}

func (d *DB) UpdateSharePermission(fileID, sharedWithID int, permission string) error {
	_, err := d.Exec(
		`UPDATE file_shares SET permission = $3 WHERE file_id = $1 AND shared_with = $2`,
		fileID, sharedWithID, permission,
	)
	return err
}

func (d *DB) GetSharesForFile(fileID int) ([]models.ShareView, error) {
	rows, err := d.Query(
		`SELECT fs.id, fs.file_id, fs.shared_by, fs.shared_with, fs.permission, fs.is_public,
		        COALESCE(u.display_name,'') AS full_name, COALESCE(u.username,'') AS username,
		        fs.created_at
		 FROM file_shares fs
		 LEFT JOIN users u ON fs.shared_with = u.id
		 WHERE fs.file_id = $1 ORDER BY fs.created_at`, fileID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var shares []models.ShareView
	for rows.Next() {
		var s models.ShareView
		if err := rows.Scan(&s.ID, &s.FileID, &s.SharedBy, &s.SharedWith, &s.Permission, &s.IsPublic,
			&s.FullName, &s.Username, &s.CreatedAt); err != nil {
			return nil, err
		}
		shares = append(shares, s)
	}
	return shares, rows.Err()
}

func (d *DB) GetSharedWithMe(userID int, groupID *int) ([]models.SharedFileView, error) {
	args := []any{userID}

	q := `SELECT sub.* FROM (
		SELECT DISTINCT ON (f.id)
			f.id, f.name, f.mime_type, f.size_bytes, f.minio_bucket, f.minio_key,
			f.folder_id, f.owner_id, f.group_id, f.scope, f.visibility, f.version, f.created_at, f.updated_at,
			owner.display_name,
			COALESCE(fs.permission, 'view') AS perm,
			COALESCE(fs.created_at, f.updated_at) AS shared_at
		FROM files f
		JOIN users owner ON f.owner_id = owner.id
		LEFT JOIN file_shares fs ON fs.file_id = f.id AND fs.shared_with = $1
		WHERE f.owner_id != $1
		AND (
			fs.id IS NOT NULL
			OR f.visibility = 'public'`

	if groupID != nil {
		q += `
			OR (f.visibility = 'group' AND owner.group_id = $2)`
		args = append(args, *groupID)
	}

	q += `
		)
		ORDER BY f.id, fs.permission DESC NULLS LAST
	) sub ORDER BY sub.shared_at DESC`

	rows, err := d.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []models.SharedFileView
	for rows.Next() {
		var sv models.SharedFileView
		if err := rows.Scan(&sv.ID, &sv.Name, &sv.MimeType, &sv.SizeBytes, &sv.MinioBucket, &sv.MinioKey,
			&sv.FolderID, &sv.OwnerID, &sv.GroupID, &sv.Scope, &sv.Visibility, &sv.Version, &sv.CreatedAt, &sv.UpdatedAt,
			&sv.SharedByName, &sv.Permission, &sv.SharedAt); err != nil {
			return nil, err
		}
		list = append(list, sv)
	}
	return list, rows.Err()
}

func (d *DB) CanAccessFile(fileID, userID int, groupID *int, requiredPerm string) (bool, error) {
	// Owner always has access
	var ownerID int
	err := d.QueryRow(`SELECT owner_id FROM files WHERE id = $1`, fileID).Scan(&ownerID)
	if err != nil {
		return false, err
	}
	if ownerID == userID {
		return true, nil
	}

	// Check group scope — members of same group have access
	var fileGroupID *int
	var scope string
	var visibility string
	err = d.QueryRow(`SELECT group_id, scope, visibility FROM files WHERE id = $1`, fileID).Scan(&fileGroupID, &scope, &visibility)
	if err != nil {
		return false, err
	}
	if scope == "group" && fileGroupID != nil && groupID != nil && *fileGroupID == *groupID {
		return true, nil
	}

	// Check visibility
	if visibility == "public" && requiredPerm == "view" {
		return true, nil
	}
	if visibility == "group" && requiredPerm == "view" && groupID != nil {
		var ownerGroupID *int
		_ = d.QueryRow(`SELECT group_id FROM users WHERE id = $1`, ownerID).Scan(&ownerGroupID)
		if ownerGroupID != nil && *ownerGroupID == *groupID {
			return true, nil
		}
	}

	// Check explicit share
	var perm string
	err = d.QueryRow(
		`SELECT permission FROM file_shares WHERE file_id = $1 AND shared_with = $2`, fileID, userID,
	).Scan(&perm)
	if err == nil {
		if requiredPerm == "view" || perm == "edit" {
			return true, nil
		}
		return perm == requiredPerm, nil
	}

	// Check public share within group
	if groupID != nil {
		var isPublic bool
		err = d.QueryRow(
			`SELECT EXISTS(SELECT 1 FROM file_shares fs JOIN files f ON fs.file_id = f.id
			  WHERE fs.file_id = $1 AND fs.is_public = TRUE AND f.group_id = $2)`,
			fileID, *groupID,
		).Scan(&isPublic)
		if err == nil && isPublic {
			return requiredPerm == "view", nil
		}
	}

	return false, nil
}

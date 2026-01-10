package helpers

import (
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
)

func IsAdmin(userId string) bool {
	_, err := query.FindById[*models.Superuser](userId)
	return err == nil
}

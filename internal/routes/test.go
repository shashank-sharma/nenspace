package routes

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
)

func TestHandler(e *core.RequestEvent) error {
	return e.JSON(http.StatusOK, map[string]interface{}{"message": "success"})
}

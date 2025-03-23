package routes

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/services/search"
)

// RegisterSearchRoutes registers the search API routes
func RegisterSearchRoutes(apiRouter *router.RouterGroup[*core.RequestEvent], path string, searchService *search.FullTextSearchService) {
	searchRouter := apiRouter.Group(path)
	
	searchRouter.GET("/{collection}", func(e *core.RequestEvent) error {
		return SearchCollection(e, searchService)
	})
	
	logger.LogInfo("Search routes registered")
}

// SearchCollection performs a full-text search on a collection
func SearchCollection(e *core.RequestEvent, searchService *search.FullTextSearchService) error {
	collection := e.Request.PathValue("collection")
	query := e.Request.URL.Query().Get("q")
	
	if query == "" {
		return e.JSON(http.StatusOK, search.SearchResponse{
			Items:      []map[string]interface{}{},
			Page:       1,
			PerPage:    20,
			TotalItems: 0,
			TotalPages: 0,
		})
	}
	
	page := 1
	perPage := 20
	
	if pageStr := e.Request.URL.Query().Get("page"); pageStr != "" {
		if pageNum, err := strconv.Atoi(pageStr); err == nil && pageNum > 0 {
			page = pageNum
		}
	}
	
	if perPageStr := e.Request.URL.Query().Get("perPage"); perPageStr != "" {
		if perPageNum, err := strconv.Atoi(perPageStr); err == nil && perPageNum > 0 && perPageNum <= 100 {
			perPage = perPageNum
		}
	}
	
	results, totalItems, err := searchService.SearchCollection(collection, query, page, perPage)
	if err != nil {
		logger.LogError(fmt.Sprintf("Search error: %v", err))
		return apis.NewBadRequestError("Failed to perform search", err)
	}
	
	// Prepare and return paginated results
	response := searchService.PrepareSearchResponse(results, totalItems, page, perPage)
	return e.JSON(http.StatusOK, response)
} 
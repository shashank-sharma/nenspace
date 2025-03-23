package routes

import (
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
	pbtypes "github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/services/memorysystem"
	"github.com/shashank-sharma/backend/internal/util"
)

// Request/response structures
type SearchMemoryRequest struct {
	Query string `json:"query"`
	Limit int    `json:"limit"`
}

type MemoryProcessRequest struct {
	ProcessType string `json:"process_type"`
}

type RateInsightRequest struct {
	Rating float64 `json:"rating"`
}

type CreateInsightRequest struct {
	Title           string   `json:"title"`
	Content         string   `json:"content"`
	Category        string   `json:"category"`
	Confidence      float64  `json:"confidence"`
	SourceMemories  []string `json:"source_memories"`
	RelatedEntities []string `json:"related_entities"`
	IsHighlighted   bool     `json:"is_highlighted"`
}

type CreateMemoryRequest struct {
	MemoryType       string                 `json:"memory_type"`
	Title            string                 `json:"title"`
	Content          string                 `json:"content"`
	SourceId         string                 `json:"source_id"`
	SourceCollection string                 `json:"source_collection"`
	Entities         []string               `json:"entities"`
	Metadata         map[string]interface{} `json:"metadata"`
	Tags             []string               `json:"tags"`
	Importance       *float64               `json:"importance"`
}

type CreateEntityRequest struct {
	EntityType    string                 `json:"entity_type"`
	Name          string                 `json:"name"`
	Description   string                 `json:"description"`
	Attributes    map[string]interface{} `json:"attributes"`
	SourceRecords []string               `json:"source_records"`
}

type CreateConnectionRequest struct {
	SourceType     string                 `json:"source_type"`
	SourceId       string                 `json:"source_id"`
	TargetType     string                 `json:"target_type"`
	TargetId       string                 `json:"target_id"`
	ConnectionType string                 `json:"connection_type"`
	Strength       float64                `json:"strength"`
	Metadata       map[string]interface{} `json:"metadata"`
}

type TimelineRequest struct {
	StartDate string   `json:"start_date"`
	EndDate   string   `json:"end_date"`
	Limit     int      `json:"limit"`
	Tags      []string `json:"tags"`
}

// MemorySystem instance
var memSystem *memorysystem.MemorySystem

// InitMemorySystem initializes the memory system
func InitMemorySystem() {
	memSystem = memorysystem.New()
}

// SearchMemory searches through memories
func SearchMemory(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	data := &SearchMemoryRequest{}
	if err := e.BindBody(data); err != nil {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"message": "Invalid request data",
		})
	}

	if data.Limit <= 0 {
		data.Limit = 10
	}

	memories, err := memSystem.RetrieveMemories(userId, data.Query, data.Limit)
	if err != nil {
		logger.LogError("Error retrieving memories:", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to retrieve memories",
		})
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"memories": memories,
	})
}

// GetMemoryTimeline retrieves memories in a chronological timeline
func GetMemoryTimeline(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	data := &TimelineRequest{}
	if err := e.BindBody(data); err != nil {
		startDate := e.Request.URL.Query().Get("start_date")
		endDate := e.Request.URL.Query().Get("end_date")
		limitStr := e.Request.URL.Query().Get("limit")
		tagsStr := e.Request.URL.Query().Get("tags")

		data.StartDate = startDate
		data.EndDate = endDate

		if limitStr != "" {
			if limit, err := strconv.Atoi(limitStr); err == nil {
				data.Limit = limit
			}
		}

		if tagsStr != "" {
			data.Tags = []string{tagsStr}
		}
	}

	if data.Limit <= 0 {
		data.Limit = 50
	}

	var startTime, endTime time.Time
	var parseErr error

	if data.StartDate != "" {
		startTime, parseErr = time.Parse(time.RFC3339, data.StartDate)
		if parseErr != nil {
			startTime, parseErr = time.Parse("2006-01-02", data.StartDate)
			if parseErr != nil {
				startTime = time.Now().AddDate(0, -1, 0)
			}
		}
	} else {
		startTime = time.Now().AddDate(0, -1, 0)
	}

	if data.EndDate != "" {
		endTime, parseErr = time.Parse(time.RFC3339, data.EndDate)
		if parseErr != nil {
			endTime, parseErr = time.Parse("2006-01-02", data.EndDate)
			if parseErr != nil {
				endTime = time.Now()
			}
		}
	} else {
		endTime = time.Now()
	}

	filter := map[string]interface{}{
		"user": userId,
		"created": map[string]interface{}{
			"gte": startTime,
			"lte": endTime,
		},
	}

	memories, err := query.FindAllByFilter[*models.Memory](filter)
	if err != nil {
		logger.LogError("Error retrieving memories:", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to retrieve memories",
		})
	}

	if len(data.Tags) > 0 {
		var filteredMemories []*models.Memory

		for _, memory := range memories {
			if memory.Tags != nil {
				var memoryTags []string
				if err := json.Unmarshal(memory.Tags, &memoryTags); err != nil {
					continue
				}

				// Check if memory has at least one of the requested tags
				hasTag := false
				for _, tag := range data.Tags {
					for _, memoryTag := range memoryTags {
						if tag == memoryTag {
							hasTag = true
							break
						}
					}
					if hasTag {
						break
					}
				}

				if hasTag {
					filteredMemories = append(filteredMemories, memory)
				}
			}
		}

		memories = filteredMemories
	}

	sortByCreationTime(memories, true)

	if len(memories) > data.Limit {
		memories = memories[:data.Limit]
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"memories":   memories,
		"start_date": startTime.Format(time.RFC3339),
		"end_date":   endTime.Format(time.RFC3339),
		"count":      len(memories),
	})
}

// GetMemoryDetails gets detailed information about a memory
func GetMemoryDetails(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	memoryId := e.Request.URL.Query().Get("id")
	if memoryId == "" {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"message": "Memory ID is required",
		})
	}

	memory, err := query.FindById[*models.Memory](memoryId)
	if err != nil {
		return e.JSON(http.StatusNotFound, map[string]interface{}{
			"message": "Memory not found",
		})
	}

	if memory.User != userId {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Unauthorized access to memory",
		})
	}

	connections, err := memSystem.GetMemoryConnections(userId, memoryId)
	if err != nil {
		logger.LogError("Error retrieving memory connections:", err)
	}

	memory.AccessCount++
	memory.LastAccessed = types.NowDateTime()
	if err := query.SaveRecord(memory); err != nil {
		logger.LogError("Error updating memory access:", err)
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"memory":      memory,
		"connections": connections,
	})
}

// ConsolidateMemories triggers memory consolidation
func ConsolidateMemories(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	data := &MemoryProcessRequest{}
	if err := e.BindBody(data); err != nil {
		data.ProcessType = "consolidation"
	}

	if data.ProcessType != "consolidation" {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"message": "Unsupported process type",
		})
	}

	go func() {
		if err := memSystem.ConsolidateMemories(userId); err != nil {
			logger.LogError("Memory consolidation failed:", err)
		}
	}()

	return e.JSON(http.StatusOK, map[string]interface{}{
		"message": "Memory consolidation process started",
	})
}

// GetEntities retrieves entities for a user
func GetEntities(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	limitStr := e.Request.URL.Query().Get("limit")
	limit := 20
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	entityType := e.Request.URL.Query().Get("type")
	filter := map[string]interface{}{
		"user": userId,
	}
	if entityType != "" {
		filter["entity_type"] = entityType
	}

	entities, err := query.FindAllByFilter[*models.Entity](filter)
	if err != nil {
		logger.LogError("Error retrieving entities:", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to retrieve entities",
		})
	}

	sortByInteractionCount(entities)

	if len(entities) > limit {
		entities = entities[:limit]
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"entities": entities,
	})
}

// GetEntityDetails gets detailed information about an entity
func GetEntityDetails(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	entityId := e.Request.URL.Query().Get("id")
	if entityId == "" {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"message": "Entity ID is required",
		})
	}

	entity, err := query.FindById[*models.Entity](entityId)
	if err != nil {
		return e.JSON(http.StatusNotFound, map[string]interface{}{
			"message": "Entity not found",
		})
	}

	if entity.User != userId {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Unauthorized access to entity",
		})
	}

	connections, err := memSystem.GetEntityConnections(userId, entityId)
	if err != nil {
		logger.LogError("Error retrieving entity connections:", err)
	}

	var relatedMemories []*models.Memory
	for _, connection := range connections {
		var memoryId string
		if connection.SourceType == "memory" {
			memoryId = connection.SourceID
		} else if connection.TargetType == "memory" {
			memoryId = connection.TargetID
		} else {
			continue
		}

		memory, err := query.FindById[*models.Memory](memoryId)
		if err != nil {
			continue
		}

		relatedMemories = append(relatedMemories, memory)
	}

	entity.InteractionCount++
	entity.LastSeen = types.NowDateTime()
	if err := query.SaveRecord(entity); err != nil {
		logger.LogError("Error updating entity:", err)
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"entity":           entity,
		"connections":      connections,
		"related_memories": relatedMemories,
	})
}

// GetInsights retrieves insights for a user
func GetInsights(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	limitStr := e.Request.URL.Query().Get("limit")
	limit := 10 // Default limit
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	category := e.Request.URL.Query().Get("category")

	filter := map[string]interface{}{
		"user": userId,
	}
	if category != "" {
		filter["category"] = category
	}

	insights, err := query.FindAllByFilter[*models.Insight](filter)
	if err != nil {
		logger.LogError("Error retrieving insights:", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to retrieve insights",
		})
	}

	sortByConfidence(insights)

	if len(insights) > limit {
		insights = insights[:limit]
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"insights": insights,
	})
}

// GetInsightDetails gets detailed information about an insight
func GetInsightDetails(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	insightId := e.Request.URL.Query().Get("id")
	if insightId == "" {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"message": "Insight ID is required",
		})
	}

	insight, err := query.FindById[*models.Insight](insightId)
	if err != nil {
		return e.JSON(http.StatusNotFound, map[string]interface{}{
			"message": "Insight not found",
		})
	}

	if insight.User != userId {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Unauthorized access to insight",
		})
	}

	var sourceMemories []*models.Memory
	if insight.SourceMemories != nil {
		var sourceMemoryIds []string
		if err := json.Unmarshal(insight.SourceMemories, &sourceMemoryIds); err == nil {
			for _, memoryId := range sourceMemoryIds {
				memory, err := query.FindById[*models.Memory](memoryId)
				if err != nil {
					continue
				}
				sourceMemories = append(sourceMemories, memory)
			}
		}
	}

	var relatedEntities []*models.Entity
	if insight.RelatedEntities != nil {
		var entityIds []string
		if err := json.Unmarshal(insight.RelatedEntities, &entityIds); err == nil {
			for _, entityId := range entityIds {
				entity, err := query.FindById[*models.Entity](entityId)
				if err != nil {
					continue
				}
				relatedEntities = append(relatedEntities, entity)
			}
		}
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"insight":          insight,
		"source_memories":  sourceMemories,
		"related_entities": relatedEntities,
	})
}

// RateInsight allows users to rate an insight
func RateInsight(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	insightId := e.Request.URL.Query().Get("id")
	if insightId == "" {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"message": "Insight ID is required",
		})
	}

	data := &RateInsightRequest{}
	if err := e.BindBody(data); err != nil {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"message": "Invalid request data",
		})
	}

	if err := memSystem.RateInsight(userId, insightId, data.Rating); err != nil {
		logger.LogError("Error rating insight:", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to rate insight",
		})
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"message": "Insight rated successfully",
	})
}

// CreateMemory creates a new memory
func CreateMemory(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	data := &CreateMemoryRequest{}
	if err := e.BindBody(data); err != nil {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"message": "Invalid request data",
		})
	}

	if data.Title == "" || data.Content == "" {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"message": "Title and content are required",
		})
	}

	input := memorysystem.MemoryInput{
		UserId:           userId,
		MemoryType:       data.MemoryType,
		Title:            data.Title,
		Content:          data.Content,
		SourceId:         data.SourceId,
		SourceCollection: data.SourceCollection,
		Entities:         data.Entities,
		Metadata:         data.Metadata,
		Tags:             data.Tags,
		Importance:       data.Importance,
	}

	memory, err := memSystem.CreateMemory(input)
	if err != nil {
		logger.LogError("Error creating memory:", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to create memory",
		})
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"message": "Memory created successfully",
		"memory":  memory,
	})
}

// CreateEntity creates a new entity
// func CreateEntity(e *core.RequestEvent) error {
// 	// Extract user ID from token
// 	token := e.Request.Header.Get("Authorization")
// 	userId, err := util.GetUserId(token)
// 	if err != nil {
// 		return e.JSON(http.StatusForbidden, map[string]interface{}{
// 			"message": "Failed to authenticate user",
// 		})
// 	}

// 	// Parse request
// 	data := &CreateEntityRequest{}
// 	if err := e.BindBody(data); err != nil {
// 		return e.JSON(http.StatusBadRequest, map[string]interface{}{
// 			"message": "Invalid request data",
// 		})
// 	}

// 	// Validate required fields
// 	if data.Name == "" || data.EntityType == "" {
// 		return e.JSON(http.StatusBadRequest, map[string]interface{}{
// 			"message": "Name and entity type are required",
// 		})
// 	}

// 	// Create or get the entity
// 	entity, err := memSystem.GetOrCreateEntity(userId, data.EntityType, data.Name, data.Description)
// 	if err != nil {
// 		logger.LogError("Error creating entity:", err)
// 		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
// 			"message": "Failed to create entity",
// 		})
// 	}

// 	// Update attributes if provided
// 	if data.Attributes != nil && len(data.Attributes) > 0 {
// 		attributesJSON, err := json.Marshal(data.Attributes)
// 		if err == nil {
// 			var attributes pbtypes.JSONRaw
// 			if err := attributes.Scan(attributesJSON); err != nil {
// 				logger.Error.Printf("Failed to scan attributes: %s", err)
// 			} else {
// 				entity.Attributes = attributes
// 			}
// 		}
// 	}

// 	// Update source records if provided
// 	if data.SourceRecords != nil && len(data.SourceRecords) > 0 {
// 		sourceRecordsJSON, err := json.Marshal(data.SourceRecords)
// 		if err == nil {
// 			var sourceRecords pbtypes.JSONRaw
// 			if err := sourceRecords.Scan(sourceRecordsJSON); err != nil {
// 				logger.Error.Printf("Failed to scan source records: %s", err)
// 			} else {
// 				entity.SourceRecords = sourceRecords
// 			}
// 		}
// 	}

// 	// Save the entity
// 	if err := query.SaveRecord(entity); err != nil {
// 		logger.LogError("Error saving entity:", err)
// 		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
// 			"message": "Failed to save entity",
// 		})
// 	}

// 	return e.JSON(http.StatusOK, map[string]interface{}{
// 		"message": "Entity created successfully",
// 		"entity":  entity,
// 	})
// }

// CreateConnection creates a new connection between memories and/or entities
func CreateConnection(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	data := &CreateConnectionRequest{}
	if err := e.BindBody(data); err != nil {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"message": "Invalid request data",
		})
	}

	if data.SourceId == "" || data.TargetId == "" || data.SourceType == "" || data.TargetType == "" {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"message": "Source ID, target ID, source type, and target type are required",
		})
	}

	err = memSystem.CreateConnection(userId, data.SourceType, data.SourceId, data.TargetType, data.TargetId, data.ConnectionType, data.Strength)
	if err != nil {
		logger.LogError("Error creating connection:", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to create connection",
		})
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"message": "Connection created successfully",
	})
}

// GetMemorySystemStatus gets the status of the memory system
func GetMemorySystemStatus(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	memories, err := query.FindAllByFilter[*models.Memory](map[string]interface{}{
		"user": userId,
	})
	if err != nil {
		logger.LogError("Error retrieving memories:", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to retrieve memories",
		})
	}

	entities, err := query.FindAllByFilter[*models.Entity](map[string]interface{}{
		"user": userId,
	})
	if err != nil {
		logger.LogError("Error retrieving entities:", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to retrieve entities",
		})
	}

	connections, err := query.FindAllByFilter[*models.MemoryConnection](map[string]interface{}{
		"user": userId,
	})
	if err != nil {
		logger.LogError("Error retrieving connections:", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to retrieve connections",
		})
	}

	insights, err := query.FindAllByFilter[*models.Insight](map[string]interface{}{
		"user": userId,
	})
	if err != nil {
		logger.LogError("Error retrieving insights:", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to retrieve insights",
		})
	}

	episodicCount := 0
	semanticCount := 0
	proceduralCount := 0

	for _, memory := range memories {
		switch memory.MemoryType {
		case "episodic":
			episodicCount++
		case "semantic":
			semanticCount++
		case "procedural":
			proceduralCount++
		}
	}

	entityTypes := make(map[string]int)
	for _, entity := range entities {
		entityTypes[entity.EntityType]++
	}

	processes, err := query.FindAllByFilter[*models.MemoryProcess](map[string]interface{}{
		"user":         userId,
		"process_type": "consolidation",
	})
	if err != nil {
		logger.LogError("Error retrieving processes:", err)
	}

	var lastConsolidation *models.MemoryProcess
	if len(processes) > 0 {
		sortProcessesByStartTime(processes)
		lastConsolidation = processes[0]
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"status":           "active",
		"memory_count":     len(memories),
		"entity_count":     len(entities),
		"connection_count": len(connections),
		"insight_count":    len(insights),
		"memory_types": map[string]int{
			"episodic":   episodicCount,
			"semantic":   semanticCount,
			"procedural": proceduralCount,
		},
		"entity_types":       entityTypes,
		"last_consolidation": lastConsolidation,
	})
}

// CreateInsight manually creates a new insight
func CreateInsight(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	data := &CreateInsightRequest{}
	if err := e.BindBody(data); err != nil {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"message": "Invalid request data",
		})
	}

	if data.Title == "" || data.Content == "" {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"message": "Title and content are required",
		})
	}

	insight := &models.Insight{
		User:          userId,
		Title:         data.Title,
		Content:       data.Content,
		Category:      data.Category,
		Confidence:    data.Confidence,
		IsHighlighted: data.IsHighlighted,
	}

	if data.SourceMemories != nil && len(data.SourceMemories) > 0 {
		sourceMemoriesJSON, err := json.Marshal(data.SourceMemories)
		if err == nil {
			var sourceMemories pbtypes.JSONRaw
			if err := sourceMemories.Scan(sourceMemoriesJSON); err != nil {
				logger.Error.Printf("Failed to scan source memories: %s", err)
			} else {
				insight.SourceMemories = sourceMemories
			}
		}
	}

	if data.RelatedEntities != nil && len(data.RelatedEntities) > 0 {
		relatedEntitiesJSON, err := json.Marshal(data.RelatedEntities)
		if err == nil {
			var relatedEntities pbtypes.JSONRaw
			if err := relatedEntities.Scan(relatedEntitiesJSON); err != nil {
				logger.Error.Printf("Failed to scan related entities: %s", err)
			} else {
				insight.RelatedEntities = relatedEntities
			}
		}
	}

	if err := memSystem.CreateInsight(insight); err != nil {
		logger.LogError("Error creating insight:", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to create insight",
		})
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"message": "Insight created successfully",
		"insight": insight,
	})
}

// GetMemoryTags gets all unique tags used in memories
func GetMemoryTags(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	memories, err := query.FindAllByFilter[*models.Memory](map[string]interface{}{
		"user": userId,
	})
	if err != nil {
		logger.LogError("Error retrieving memories:", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to retrieve memories",
		})
	}

	tagMap := make(map[string]int)

	for _, memory := range memories {
		if memory.Tags != nil {
			var tags []string
			if err := json.Unmarshal(memory.Tags, &tags); err != nil {
				continue
			}

			for _, tag := range tags {
				tagMap[tag]++
			}
		}
	}

	type TagCount struct {
		Tag   string `json:"tag"`
		Count int    `json:"count"`
	}

	var tagCounts []TagCount
	for tag, count := range tagMap {
		tagCounts = append(tagCounts, TagCount{
			Tag:   tag,
			Count: count,
		})
	}

	sort.Slice(tagCounts, func(i, j int) bool {
		return tagCounts[i].Count > tagCounts[j].Count
	})

	return e.JSON(http.StatusOK, map[string]interface{}{
		"tags": tagCounts,
	})
}

// GetMemoriesByTag gets memories with a specific tag
func GetMemoriesByTag(e *core.RequestEvent) error {
	token := e.Request.Header.Get("Authorization")
	userId, err := util.GetUserId(token)
	if err != nil {
		return e.JSON(http.StatusForbidden, map[string]interface{}{
			"message": "Failed to authenticate user",
		})
	}

	tag := e.Request.URL.Query().Get("tag")
	if tag == "" {
		return e.JSON(http.StatusBadRequest, map[string]interface{}{
			"message": "Tag is required",
		})
	}

	limitStr := e.Request.URL.Query().Get("limit")
	limit := 20
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	memories, err := memSystem.GetRecentMemoriesByTags(userId, []string{tag}, limit)
	if err != nil {
		logger.LogError("Error retrieving memories by tag:", err)
		return e.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": "Failed to retrieve memories",
		})
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"memories": memories,
		"count":    len(memories),
		"tag":      tag,
	})
}

// RecordHookHandler handles record events for memory system
func RecordHookHandler(e *core.RecordEvent) error {
	if memSystem == nil {
		InitMemorySystem()
	}

	userId := e.Record.GetString("user")
	if userId == "" {
		return e.Next()
	}

	go func() {
		record := *e.Record
		
		if err := memSystem.ProcessRecord(e.Record.Collection().Name, record); err != nil {
			logger.Error.Printf("Error processing record for memory system: %s", err)
		}
	}()

	return e.Next()
}


func sortByCreationTime(memories []*models.Memory, ascending bool) {
	if ascending {
		sort.Slice(memories, func(i, j int) bool {
			return memories[i].Created.Before(memories[j].Created)
		})
	} else {
		sort.Slice(memories, func(i, j int) bool {
			return memories[i].Created.After(memories[j].Created)
		})
	}
}

func sortByInteractionCount(entities []*models.Entity) {
	sort.Slice(entities, func(i, j int) bool {
		return entities[i].InteractionCount > entities[j].InteractionCount
	})
}

func sortByConfidence(insights []*models.Insight) {
	sort.Slice(insights, func(i, j int) bool {
		return insights[i].Confidence > insights[j].Confidence
	})
}

func sortProcessesByStartTime(processes []*models.MemoryProcess) {
	sort.Slice(processes, func(i, j int) bool {
		return processes[i].StartTime.After(processes[j].StartTime)
	})
}

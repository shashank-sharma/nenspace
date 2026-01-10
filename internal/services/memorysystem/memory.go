package memorysystem

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/util"
)

// Memory represents a memory for the purpose of consolidation and processing
type Memory struct {
	*models.Memory
	EmbeddingVector []float64  			   // Cached embedding for performance
	ContextualData map[string]interface{}  // Contextual metadata for this memory
}

// MemorySystem encapsulates the memory functionality
type MemorySystem struct {
	config MemoryConfig
	entitySystem *EntityRecognitionSystem
	embeddingSystem *EmbeddingSystem
	mutex sync.RWMutex
	memoryCache map[string]map[string]*Memory // userId -> memoryId -> Memory
	lastConsolidation map[string]time.Time
}

// MemoryConfig holds memory system configuration
type MemoryConfig struct {
	DecayRate float64  // Memory decay rate (daily)
	MinStrengthThreshold float64  // Minimum strength threshold for memories (below this, memories are archived)
	MaxSearchResults int  // Maximum number of memories to return in searches
	RecentDaysThreshold int  // Number of days to consider "recent" for working memory
	MinSimilarityThreshold float64  // Minimum similarity threshold for memories to be considered related
	EnableInsightGeneration bool  // Enable insight generation during consolidation
	MaxInsightsPerConsolidation int  // Maximum insights to generate per consolidation
	EnableContentAnalysis bool  // Enable detailed content analysis
	ConceptFrequencyThreshold int  // Minimum frequency for a concept to be extracted
	HighlightImportanceThreshold float64  // Minimum importance threshold for highlighting memories
	ConsolidationIntervalHours int  // Consolidation interval in hours
	MaxMemoriesPerConsolidation int  // Maximum memories to process per consolidation
	EnableSemanticClustering bool  // Enable semantic clustering during consolidation
	SemanticClusterCount int  // Number of clusters to form during semantic clustering
}

// DefaultConfig returns the default memory system configuration
func DefaultConfig() MemoryConfig {
	return MemoryConfig{
		DecayRate:                   0.05,
		MinStrengthThreshold:        0.2,
		MaxSearchResults:            50,
		RecentDaysThreshold:         3,
		MinSimilarityThreshold:      0.7,
		EnableInsightGeneration:     true,
		MaxInsightsPerConsolidation: 5,
		EnableContentAnalysis:       true,
		ConceptFrequencyThreshold:   3,
		HighlightImportanceThreshold: 0.8,
		ConsolidationIntervalHours:  24,
		MaxMemoriesPerConsolidation: 500,
		EnableSemanticClustering:    true,
		SemanticClusterCount:        10,
	}
}

// New creates a new MemorySystem with default configuration
func New() *MemorySystem {
	return NewWithConfig(DefaultConfig())
}

// NewWithConfig creates a new MemorySystem with custom configuration
func NewWithConfig(config MemoryConfig) *MemorySystem {
	// Initialize embedding system
	embeddingSystem := NewEmbeddingSystem(EmbeddingConfig{
		UseExternalAPI:  true,
		UseFallback:     true,
		CacheTTL:        86400,
		TokensPerMinute: 10000,
		Dimensions:      1536,
	})

	// Initialize entity recognition system
	entitySystem := NewEntityRecognitionSystem(embeddingSystem)

	return &MemorySystem{
		config:            config,
		entitySystem:      entitySystem,
		embeddingSystem:   embeddingSystem,
		memoryCache:       make(map[string]map[string]*Memory),
		lastConsolidation: make(map[string]time.Time),
	}
}

// MemoryInput represents the generic input for memory creation
type MemoryInput struct {
	UserId string
	MemoryType string
	Title string
	Content string
	SourceId string
	SourceCollection string
	Entities []string
	Metadata map[string]interface{}
	Tags []string
	Importance *float64
}

// ProcessRecord processes a record into the memory system
func (ms *MemorySystem) ProcessRecord(collectionName string, record core.Record) error {
	userId := record.GetString("user")
	if userId == "" {
		return fmt.Errorf("record has no user field")
	}

	// Process different collection types
	switch collectionName {
	case "tasks":
		return ms.ProcessTask(userId, record)
	case "habits":
		return ms.ProcessHabit(userId, record)
	case "daily_log":
		return ms.ProcessDailyLog(userId, record)
	case "life_balance":
		return ms.ProcessLifeBalance(userId, record)
	case "track_items":
		return ms.ProcessTrackItems(userId, record)
	case "track_focus":
		return ms.ProcessTrackFocus(userId, record)
	default:
		logger.LogDebug("Skipping unsupported collection: %s", collectionName)
		return nil
	}
}

// ProcessTask processes a task record into the memory system
func (ms *MemorySystem) ProcessTask(userId string, record core.Record) error {
	logger.LogDebug("Processing task for memory system: %s", record.Id)

	title := record.GetString("title")
	description := record.GetString("description")
	project := record.GetString("project")
	category := record.GetString("category")
	dueDate := record.GetString("due")

	if title == "" {
		return nil
	}

	metadata := map[string]interface{}{
		"task_id":     record.Id,
		"title":       title,
		"description": description,
	}

	if project != "" {
		metadata["project"] = project
	}

	if category != "" {
		metadata["category"] = category
	}

	if dueDate != "" {
		parsedDate, err := time.Parse(time.RFC3339, dueDate)
		if err == nil {
			metadata["due_date"] = parsedDate
			
			// Set importance based on due date proximity
			daysUntil := int(time.Until(parsedDate).Hours() / 24)
			var importance float64
			
			if daysUntil < 0 {
				importance = 0.9
			} else if daysUntil == 0 {
				importance = 0.85
			} else if daysUntil <= 2 {
				importance = 0.8
			} else if daysUntil <= 7 {
				importance = 0.75
			} else {
				importance = 0.7
			}
			
			tags := []string{"task"}
			if category != "" {
				tags = append(tags, category)
			}
			
			if daysUntil < 0 {
				tags = append(tags, "overdue")
			} else if daysUntil == 0 {
				tags = append(tags, "due-today")
			} else if daysUntil <= 2 {
				tags = append(tags, "due-soon")
			} else if daysUntil <= 7 {
				tags = append(tags, "due-this-week")
			} else {
				tags = append(tags, "future")
			}
			
			// Create episodic memory for the task
			episodicContent := fmt.Sprintf("Created a task titled '%s'", title)
			if description != "" {
				episodicContent += fmt.Sprintf(" with description: %s", description)
			}
			
			if daysUntil < 0 {
				episodicContent += fmt.Sprintf(" The task is overdue by %d days.", -daysUntil)
			} else if daysUntil == 0 {
				episodicContent += " The task is due today."
			} else if daysUntil == 1 {
				episodicContent += " The task is due tomorrow."
			} else {
				episodicContent += fmt.Sprintf(" The task is due in %d days.", daysUntil)
			}
			
			episodicInput := MemoryInput{
				UserId:           userId,
				MemoryType:       "episodic",
				Title:            fmt.Sprintf("Task: %s", title),
				Content:          episodicContent,
				SourceId:         record.Id,
				SourceCollection: "tasks",
				Metadata:         metadata,
				Tags:             tags,
				Importance:       &importance,
			}
			
			// Extract entities from title and description
			extractedEntities, err := ms.entitySystem.ExtractEntities(userId, title+" "+description)
			if err == nil && len(extractedEntities) > 0 {
				for _, entity := range extractedEntities {
					episodicInput.Entities = append(episodicInput.Entities, entity.Id)
				}
			}
			
			// Create the memory
			episodicMemory, err := ms.CreateMemory(episodicInput)
			if err != nil {
				return fmt.Errorf("failed to create task memory: %w", err)
			}
			
			// Create project entity and procedural memory if project specified
			if project != "" {
				projectEntity, err := ms.entitySystem.GetOrCreateEntity(userId, "project", project, fmt.Sprintf("A project containing tasks like: %s", title))
				if err == nil {
					// Create connection between memory and project entity
					if err := ms.CreateConnection(userId, "memory", episodicMemory.Id, "entity", projectEntity.Id, "belongs_to_project", 0.9); err != nil {
						logger.LogError("Failed to create connection to project entity", err)
					}
					
					// Look for existing procedural memory about this project
					projectMemories, err := ms.RetrieveMemories(userId, "project "+project, 1)
					if err == nil && len(projectMemories) > 0 && projectMemories[0].MemoryType == "procedural" {
						// Update existing procedural memory
						projectMemory := projectMemories[0]
						projectMemory.Content += fmt.Sprintf(" Added new task: %s.", title)
						
						// Add connection to this new memory
						if err := ms.CreateConnection(userId, "memory", episodicMemory.Id, "memory", projectMemory.Id, "contributes_to", 0.8); err != nil {
							logger.LogError("Failed to create memory connection", err)
						}
						
						if err := query.SaveRecord(projectMemory); err != nil {
							logger.LogError("Failed to update project memory", err)
						}
					} else {
						projectInput := MemoryInput{
							UserId:           userId,
							MemoryType:       "procedural",
							Title:            fmt.Sprintf("Working on project: %s", project),
							Content:          fmt.Sprintf("The project %s involves tasks including: %s", project, title),
							SourceId:         record.Id,
							SourceCollection: "tasks",
							Tags:             []string{"project", "workflow", project},
							Entities:         []string{projectEntity.Id},
						}
						
						projectMemory, err := ms.CreateMemory(projectInput)
						if err != nil {
							logger.LogError("Failed to create project memory", err)
						} else {
							// Create connection between task memory and project memory
							if err := ms.CreateConnection(userId, "memory", episodicMemory.Id, "memory", projectMemory.Id, "contributes_to", 0.8); err != nil {
								logger.LogError("Failed to create memory connection", err)
							}
						}
					}
				}
			}
			
			logger.LogDebug("Successfully created memory for task: %s", record.Id)
			return nil
		}
	}
	
	tags := []string{"task"}
	if category != "" {
		tags = append(tags, category)
	}

	if description != "" {
		description = " with description: " + description
	}
	
	episodicInput := MemoryInput{
		UserId:           userId,
		MemoryType:       "episodic",
		Title:            fmt.Sprintf("Task: %s", title),
		Content:          fmt.Sprintf("Created a task titled '%s'%s", title, description),
		SourceId:         record.Id,
		SourceCollection: "tasks",
		Metadata:         metadata,
		Tags:             tags,
	}
	
	// Extract entities from title and description
	extractedEntities, err := ms.entitySystem.ExtractEntities(userId, title+" "+description)
	if err == nil && len(extractedEntities) > 0 {
		for _, entity := range extractedEntities {
			episodicInput.Entities = append(episodicInput.Entities, entity.Id)
		}
	}
	
	_, err = ms.CreateMemory(episodicInput)
	if err != nil {
		return fmt.Errorf("failed to create task memory: %w", err)
	}
	
	logger.LogDebug("Successfully created memory for task: %s", record.Id)
	return nil
}

// ProcessHabit processes a habit record into the memory system
func (ms *MemorySystem) ProcessHabit(userId string, record core.Record) error {
	logger.LogDebug("Processing habit for memory system: %s", record.Id)

	name := record.GetString("name")
	habitType := record.GetString("type")
	status := record.GetString("status")
	streak := int(record.GetInt("streak"))
	priority := int(record.GetInt("priority"))

	if name == "" {
		return nil
	}

	metadata := map[string]interface{}{
		"habit_id":  record.Id,
		"habit_name": name,
		"type":      habitType,
		"status":    status,
		"streak":    streak,
		"priority":  priority,
	}

	tags := []string{"habit", habitType}
	if status != "" {
		tags = append(tags, status)
	}

	// Calculate importance based on priority and streak
	importance := math.Min(0.5+(float64(priority)*0.1)+(float64(streak)*0.02), 0.95)

	content := fmt.Sprintf("Tracking habit '%s' of type '%s' with status '%s'", name, habitType, status)
	if streak > 0 {
		content += fmt.Sprintf(" Current streak: %d days.", streak)
		if streak >= 7 {
			content += " This is a significant streak!"
		}
	}

	episodicInput := MemoryInput{
		UserId:           userId,
		MemoryType:       "episodic",
		Title:            fmt.Sprintf("Habit: %s", name),
		Content:          content,
		SourceId:         record.Id,
		SourceCollection: "habits",
		Metadata:         metadata,
		Tags:             tags,
		Importance:       &importance,
	}

	habitMemory, err := ms.CreateMemory(episodicInput)
	if err != nil {
		return fmt.Errorf("failed to create habit memory: %w", err)
	}

	// For habits with significant streaks, create or update a procedural memory
	if streak >= 7 {
		// Look for existing procedural memory about habit formation
		habitMemories, err := ms.RetrieveMemories(userId, "habit formation pattern", 1)
		if err == nil && len(habitMemories) > 0 && habitMemories[0].MemoryType == "procedural" {
			procedural := habitMemories[0]
			
			// Check if this habit is already mentioned
			if !strings.Contains(procedural.Content, name) {
				procedural.Content += fmt.Sprintf(" The habit '%s' has been maintained for %d days, showing consistent behavior.", name, streak)
				
				if err := query.SaveRecord(procedural); err != nil {
					logger.LogError("Failed to update procedural memory", err)
				} else {
					if err := ms.CreateConnection(userId, "memory", habitMemory.Id, "memory", procedural.Id, "reinforces_pattern", 0.8); err != nil {
						logger.LogError("Failed to create memory connection", err)
					}
				}
			}
		} else {
			proceduralInput := MemoryInput{
				UserId:           userId,
				MemoryType:       "procedural",
				Title:            "Habit formation patterns",
				Content:          fmt.Sprintf("Regular habits like '%s' of type '%s' with a streak of %d days demonstrate consistent behavior patterns.", name, habitType, streak),
				SourceId:         record.Id,
				SourceCollection: "habits",
				Tags:             []string{"habit", "pattern", "consistency", habitType},
			}
			
			proceduralMemory, err := ms.CreateMemory(proceduralInput)
			if err != nil {
				logger.LogError("Failed to create procedural memory", err)
			} else {
				if err := ms.CreateConnection(userId, "memory", habitMemory.Id, "memory", proceduralMemory.Id, "demonstrates_pattern", 0.8); err != nil {
					logger.LogError("Failed to create memory connection", err)
				}
			}
		}
	}

	logger.LogDebug("Successfully created memory for habit: %s", record.Id)
	return nil
}

// ProcessDailyLog processes a daily log record into the memory system
func (ms *MemorySystem) ProcessDailyLog(userId string, record core.Record) error {
	logger.LogDebug("Processing daily log for memory system: %s", record.Id)

	summary := record.GetString("summary")
	score := record.GetInt("score")
	date := record.GetString("date")
	feeling := record.GetString("feeling")
	bath := record.GetBool("bath")

	if summary == "" && feeling == "" {
		return nil
	}

	var logDate time.Time
	var dateErr error
	if date != "" {
		logDate, dateErr = time.Parse("2006-01-02", date)
		if dateErr != nil {
			logDate = time.Now()
		}
	} else {
		logDate = time.Now()
	}

	metadata := map[string]interface{}{
		"log_id":  record.Id,
		"date":    logDate,
		"score":   score,
		"feeling": feeling,
		"bath":    bath,
	}

	tags := []string{"daily_log"}
	if feeling != "" {
		tags = append(tags, "feeling", feeling)
	}
	if bath {
		tags = append(tags, "bath")
	}
	if score > 0 {
		if score >= 4 {
			tags = append(tags, "good-day")
		} else if score <= 2 {
			tags = append(tags, "challenging-day")
		}
	}

	// Calculate importance based on emotional content and score
	var importance float64 = 0.6 // Base importance for daily logs
	
	// Score affects importance
	if score > 0 {
		if score >= 4 || score <= 2 {
			importance += 0.15 // Exceptional days are more important
		}
	}
	
	// Emotional language increases importance
	// TODO: Add more emotional keywords
	emotionalKeywords := []string{
		"amazing", "terrible", "awful", "wonderful", "excited", "sad", "angry", "happy", 
		"thrilled", "depressed", "frustrated", "anxious", "proud", "disappointed",
		"grateful", "overwhelmed", "exhausted", "energized", "inspired", "stressed",
	}
	
	lowercaseSummary := strings.ToLower(summary)
	for _, keyword := range emotionalKeywords {
		if strings.Contains(lowercaseSummary, keyword) {
			importance += 0.1
			break
		}
	}
	
	// Cap at 0.95
	if importance > 0.95 {
		importance = 0.95
	}

	content := fmt.Sprintf("Daily reflection for %s", logDate.Format("January 2, 2006"))
	if feeling != "" {
		content += fmt.Sprintf(". Feeling: %s", feeling)
	}
	if score > 0 {
		content += fmt.Sprintf(". Day rated %d/5", score)
	}
	if bath {
		content += ". Took a bath today"
	}
	if summary != "" {
		content += fmt.Sprintf(". %s", summary)
	}

	episodicInput := MemoryInput{
		UserId:           userId,
		MemoryType:       "episodic",
		Title:            fmt.Sprintf("Daily Log: %s", logDate.Format("Jan 2, 2006")),
		Content:          content,
		SourceId:         record.Id,
		SourceCollection: "daily_log",
		Metadata:         metadata,
		Tags:             tags,
		Importance:       &importance,
	}

	// Extract entities from summary
	if summary != "" {
		extractedEntities, err := ms.entitySystem.ExtractEntities(userId, summary)
		if err == nil && len(extractedEntities) > 0 {
			for _, entity := range extractedEntities {
				episodicInput.Entities = append(episodicInput.Entities, entity.Id)
			}
		}
	}

	dailyLogMemory, err := ms.CreateMemory(episodicInput)
	if err != nil {
		return fmt.Errorf("failed to create daily log memory: %w", err)
	}

	// If there's a feeling, check for patterns
	if feeling != "" {
		// Get recent memories with the same feeling
		recentFeelingMemories, err := ms.GetRecentMemoriesByTags(userId, []string{"feeling", feeling}, 10)
		if err == nil && len(recentFeelingMemories) >= 3 {
			// There seems to be a pattern of this feeling
			semanticInput := MemoryInput{
				UserId:           userId,
				MemoryType:       "semantic",
				Title:            fmt.Sprintf("Pattern of feeling: %s", feeling),
				Content:          fmt.Sprintf("There appears to be a pattern of feeling '%s' across multiple days recently.", feeling),
				SourceId:         record.Id,
				SourceCollection: "daily_log",
				Tags:             []string{"pattern", "feeling", feeling},
			}
			
			feelingPatternMemory, err := ms.CreateOrUpdateSemanticMemory(semanticInput)
			if err == nil {
				if err := ms.CreateConnection(userId, "memory", dailyLogMemory.Id, "memory", feelingPatternMemory.Id, "contributes_to_pattern", 0.75); err != nil {
					logger.LogError("Failed to create memory connection", err)
				}
			}
		}
	}

	// If there's a high or low score, check for patterns
	if score >= 4 || score <= 2 {
		// Tag to look for
		scoreTag := "good-day"
		if score <= 2 {
			scoreTag = "challenging-day"
		}
		
		// Get recent memories with the same score pattern
		recentScoreMemories, err := ms.GetRecentMemoriesByTags(userId, []string{"daily_log", scoreTag}, 10)
		if err == nil && len(recentScoreMemories) >= 3 {
			// There seems to be a pattern of good/bad days
			patternType := "positive"
			if score <= 2 {
				patternType = "challenging"
			}
			
			semanticInput := MemoryInput{
				UserId:           userId,
				MemoryType:       "semantic",
				Title:            fmt.Sprintf("Pattern of %s days", patternType),
				Content:          fmt.Sprintf("There appears to be a pattern of %s days recently.", patternType),
				SourceId:         record.Id,
				SourceCollection: "daily_log",
				Tags:             []string{"pattern", "day-quality", scoreTag},
			}
			
			scorePatternMemory, err := ms.CreateOrUpdateSemanticMemory(semanticInput)
			if err == nil {
				if err := ms.CreateConnection(userId, "memory", dailyLogMemory.Id, "memory", scorePatternMemory.Id, "contributes_to_pattern", 0.75); err != nil {
					logger.LogError("Failed to create memory connection", err)
				}
			}
		}
	}

	logger.LogDebug("Successfully created memory for daily log: %s", record.Id)
	return nil
}

// ProcessLifeBalance processes a life balance record into the memory system
func (ms *MemorySystem) ProcessLifeBalance(userId string, record core.Record) error {
	logger.LogDebug("Processing life balance for memory system: %s", record.Id)

	date := record.GetString("date")
	relationship := int(record.GetInt("relationship"))
	health := int(record.GetInt("health"))
	career := int(record.GetInt("career"))
	growth := int(record.GetInt("growth"))
	life := int(record.GetInt("life"))
	social := int(record.GetInt("social"))
	hobby := int(record.GetInt("hobby"))
	finance := int(record.GetInt("finance"))

	var balanceDate time.Time
	var dateErr error
	if date != "" {
		balanceDate, dateErr = time.Parse("2006-01-02", date)
		if dateErr != nil {
			balanceDate = time.Now()
		}
	} else {
		balanceDate = time.Now()
	}

	scores := map[string]int{
		"relationship": relationship,
		"health":       health,
		"career":       career,
		"growth":       growth,
		"life":         life,
		"social":       social,
		"hobby":        hobby,
		"finance":      finance,
	}

	validScores := make(map[string]int)
	for area, score := range scores {
		if score > 0 {
			validScores[area] = score
		}
	}

	// Skip if we don't have enough data
	if len(validScores) < 3 {
		logger.LogDebug("Not enough valid scores in life balance record: %s", record.Id)
		return nil
	}

	metadata := map[string]interface{}{
		"balance_id": record.Id,
		"date":       balanceDate,
	}
	for area, score := range validScores {
		metadata[area] = score
	}

	tags := []string{"life_balance", "assessment"}

	// Find highest and lowest areas
	var highestArea, lowestArea string
	var highestScore, lowestScore int

	for area, score := range validScores {
		if highestArea == "" || score > highestScore {
			highestArea = area
			highestScore = score
		}

		if lowestArea == "" || score < lowestScore {
			lowestArea = area
			lowestScore = score
		}
	}

	// Add tags for highest and lowest areas
	if highestArea != "" {
		tags = append(tags, "strength-"+highestArea)
	}
	if lowestArea != "" {
		tags = append(tags, "challenge-"+lowestArea)
	}

	// Calculate average score for importance
	var totalScore int
	for _, score := range validScores {
		totalScore += score
	}
	avgScore := float64(totalScore) / float64(len(validScores))
	
	// Calculate importance - higher for extreme assessments
	importance := 0.6 // Base importance
	if avgScore >= 8.0 || avgScore <= 3.0 {
		importance += 0.2 // More extreme scores are more important
	}
	
	// Also consider if there are very high or low individual scores
	hasExtremeScore := false
	for _, score := range validScores {
		if score >= 9 || score <= 2 {
			hasExtremeScore = true
			break
		}
	}
	
	if hasExtremeScore {
		importance += 0.1
	}

	content := fmt.Sprintf("Life balance assessment for %s. ", balanceDate.Format("January 2, 2006"))

	for area, score := range validScores {
		content += fmt.Sprintf("%s: %d/10. ", strings.Title(area), score)
	}

	if highestArea != "" && lowestArea != "" {
		content += fmt.Sprintf("Strongest area is %s (%d/10) and the area needing most improvement is %s (%d/10).", 
			strings.Title(highestArea), highestScore, strings.Title(lowestArea), lowestScore)
	}

	episodicInput := MemoryInput{
		UserId:           userId,
		MemoryType:       "episodic",
		Title:            fmt.Sprintf("Life Balance: %s", balanceDate.Format("Jan 2, 2006")),
		Content:          content,
		SourceId:         record.Id,
		SourceCollection: "life_balance",
		Metadata:         metadata,
		Tags:             tags,
		Importance:       &importance,
	}

	lifeBalanceMemory, err := ms.CreateMemory(episodicInput)
	if err != nil {
		return fmt.Errorf("failed to create life balance memory: %w", err)
	}

	// Create semantic memories for significant areas (very high or very low scores)
	for area, score := range validScores {
		if score >= 8 || score <= 3 {
			sentiment := "positive"
			if score <= 3 {
				sentiment = "negative"
			}

			// Check if we already have a semantic memory for this area
			areaMemories, err := ms.GetRecentMemoriesByTags(userId, []string{"life_balance", area}, 5)
			
			if err == nil && len(areaMemories) > 0 {
				// Update existing memory if found
				var semanticMemory *models.Memory
				for _, mem := range areaMemories {
					if mem.MemoryType == "semantic" {
						semanticMemory = mem
						break
					}
				}
				
				if semanticMemory != nil {
					// Update the existing semantic memory
					semanticMemory.Content = fmt.Sprintf("The %s area of life continues to show a %s pattern with a recent score of %d/10.", 
						area, sentiment, score)
					
					if err := ms.CreateConnection(userId, "memory", lifeBalanceMemory.Id, "memory", semanticMemory.Id, "reinforces_understanding", 0.8); err != nil {
						logger.LogError("Failed to create memory connection", err)
					}
					
					if err := query.SaveRecord(semanticMemory); err != nil {
						logger.LogError("Failed to update semantic memory", err)
					}
					
					continue
				}
			}
			
			semanticInput := MemoryInput{
				UserId:           userId,
				MemoryType:       "semantic",
				Title:            fmt.Sprintf("Understanding of %s area", area),
				Content:          fmt.Sprintf("The %s area of life shows a %s pattern with a score of %d/10.", area, sentiment, score),
				SourceId:         record.Id,
				SourceCollection: "life_balance",
				Tags:             []string{"life_balance", area, sentiment},
			}
			
			semanticMemory, err := ms.CreateMemory(semanticInput)
			if err != nil {
				logger.LogError("Failed to create semantic memory", err)
			} else {
				// Create connection
				if err := ms.CreateConnection(userId, "memory", lifeBalanceMemory.Id, "memory", semanticMemory.Id, "provides_understanding", 0.8); err != nil {
					logger.LogError("Failed to create memory connection", err)
				}
			}
		}
	}

	// Check for trends over time in specific areas
	for area, _ := range validScores {
		// Get the last 5 memories with this area tag
		memories, err := ms.GetRecentMemoriesByTags(userId, []string{"life_balance", area}, 5)
		if err != nil || len(memories) < 3 {
			continue
		}
		
		// Extract scores
		var scores []int
		var memoryIds []string
		
		for _, memory := range memories {
			var metadata map[string]interface{}
			if err := json.Unmarshal(memory.TemporalContext, &metadata); err != nil {
				continue
			}
			
			if score, ok := metadata[area].(float64); ok {
				scores = append(scores, int(score))
				memoryIds = append(memoryIds, memory.Id)
			}
		}
		
		if len(scores) < 3 {
			continue
		}
		
		// Detect trend
		increasing := true
		decreasing := true
		
		for i := 1; i < len(scores); i++ {
			if scores[i] <= scores[i-1] {
				increasing = false
			}
			if scores[i] >= scores[i-1] {
				decreasing = false
			}
		}
		
		var trendType, trendDescription string
		if increasing {
			trendType = "improving"
			trendDescription = "showing improvement over time"
		} else if decreasing {
			trendType = "declining"
			trendDescription = "showing decline over time"
		} else {
			continue // No clear trend
		}
		
		// Create a procedural memory about the trend
		proceduralInput := MemoryInput{
			UserId:           userId,
			MemoryType:       "procedural",
			Title:            fmt.Sprintf("%s trend in %s", strings.Title(trendType), area),
			Content:          fmt.Sprintf("The %s area of life is %s. This trend may indicate underlying factors affecting this life domain.", area, trendDescription),
			SourceId:         record.Id,
			SourceCollection: "life_balance",
			Tags:             []string{"trend", area, trendType},
		}
		
		trendMemory, err := ms.CreateOrUpdateProceduralMemory(proceduralInput)
		if err != nil {
			logger.LogError("Failed to create trend memory", err)
		} else {
			// Create connections to the trend memory
			if err := ms.CreateConnection(userId, "memory", lifeBalanceMemory.Id, "memory", trendMemory.Id, "evidence_of_trend", 0.85); err != nil {
				logger.LogError("Failed to create memory connection", err)
			}
		}
	}

	logger.LogDebug("Successfully created memory for life balance: %s", record.Id)
	return nil
}

// ProcessTrackItems processes track items records (app usage data)
func (ms *MemorySystem) ProcessTrackItems(userId string, record core.Record) error {
	logger.LogDebug("Processing track items for memory system: %s", record.Id)

	// Extract fields
	app := record.GetString("app")
	taskName := record.GetString("task_name")
	title := record.GetString("title")
	deviceId := record.GetString("device")
	beginDateStr := record.GetString("begin_date")
	endDateStr := record.GetString("end_date")

	// Skip if missing critical data
	if app == "" || beginDateStr == "" || endDateStr == "" {
		return nil
	}

	// Parse dates
	beginDate, err1 := time.Parse(time.RFC3339, beginDateStr)
	endDate, err2 := time.Parse(time.RFC3339, endDateStr)
	
	if err1 != nil || err2 != nil {
		logger.LogError("Failed to parse dates in track item", err1)
		return fmt.Errorf("invalid dates in track item")
	}

	// Calculate duration
	duration := endDate.Sub(beginDate)
	
	// Skip very short durations (less than 1 minute)
	if duration < time.Minute {
		return nil
	}

	// Create metadata
	metadata := map[string]interface{}{
		"track_id":   record.Id,
		"app":        app,
		"task_name":  taskName,
		"title":      title,
		"device":     deviceId,
		"begin_date": beginDate,
		"end_date":   endDate,
		"duration":   duration.Minutes(), // in minutes
	}

	// Create tags
	tags := []string{"app_usage", app}
	
	// Categorize apps
	appCategory := categorizeApp(app)
	if appCategory != "" {
		tags = append(tags, appCategory)
	}
	
	// Add tags for time of day
	hour := beginDate.Hour()
	if hour >= 5 && hour < 12 {
		tags = append(tags, "morning")
	} else if hour >= 12 && hour < 17 {
		tags = append(tags, "afternoon")
	} else if hour >= 17 && hour < 21 {
		tags = append(tags, "evening")
	} else {
		tags = append(tags, "night")
	}
	
	// Add tags for duration
	if duration >= 60*time.Minute {
		tags = append(tags, "long-session")
	} else if duration >= 30*time.Minute {
		tags = append(tags, "medium-session")
	} else {
		tags = append(tags, "short-session")
	}

	// Calculate importance based on duration
	importance := 0.3 // Base importance for app usage
	
	// Longer sessions are more important
	if duration >= 60*time.Minute {
		importance += 0.2
	} else if duration >= 30*time.Minute {
		importance += 0.1
	} else if duration >= 15*time.Minute {
		importance += 0.05
	}
	
	// Certain app categories are more important
	if appCategory == "productivity" || appCategory == "development" || appCategory == "creativity" {
		importance += 0.1
	}
	
	// Cap at 0.75 - app usage generally less important than direct user input
	if importance > 0.75 {
		importance = 0.75
	}

	// Create content
	durationText := formatDuration(duration)
	content := fmt.Sprintf("Used %s for %s on %s. ", app, durationText, beginDate.Format("January 2, 2006"))
	
	if title != "" {
		content += fmt.Sprintf("Worked on: %s. ", title)
	}
	
	// Add time of day context
	content += fmt.Sprintf("Session started at %s. ", beginDate.Format("3:04 PM"))

	if title != "" {
		title = "Worked on: " + title
	}

	episodicInput := MemoryInput{
		UserId:           userId,
		MemoryType:       "episodic",
		Title:            fmt.Sprintf("Using %s: %s", app, title),
		Content:          content,
		SourceId:         record.Id,
		SourceCollection: "track_items",
		Metadata:         metadata,
		Tags:             tags,
		Importance:       &importance,
	}

	// Create the memory
	trackMemory, err := ms.CreateMemory(episodicInput)
	if err != nil {
		return fmt.Errorf("failed to create track item memory: %w", err)
	}

	// Get device entity if it exists
	deviceEntity, err := ms.entitySystem.GetOrCreateEntity(userId, "device", "Device "+deviceId, "A device used for activities")
	if err == nil {
		// Create connection between memory and device
		if err := ms.CreateConnection(userId, "memory", trackMemory.Id, "entity", deviceEntity.Id, "used_device", 0.7); err != nil {
			logger.LogError("Failed to create device connection", err)
		}
	}

	// For significant app usage, create/update procedural memory about usage patterns
	if duration >= 30*time.Minute {
		// Look for existing app usage patterns
		appMemories, err := ms.GetRecentMemoriesByTags(userId, []string{"app_usage", app}, 10)
		
		if err == nil && len(appMemories) >= 3 {
			// Check if we already have a procedural memory for this app
			var appPatternMemory *models.Memory
			for _, memory := range appMemories {
				if memory.MemoryType == "procedural" && strings.Contains(memory.Title, "usage pattern") {
					appPatternMemory = memory
					break
				}
			}
			
			if appPatternMemory != nil {
				// Update existing procedural memory
				appPatternMemory.Content = fmt.Sprintf("Regular usage of %s continues, with a recent session of %s.", app, durationText)
				
				// Update memory
				if err := query.SaveRecord(appPatternMemory); err != nil {
					logger.LogError("Failed to update procedural memory", err)
				} else {
					// Create connection
					if err := ms.CreateConnection(userId, "memory", trackMemory.Id, "memory", appPatternMemory.Id, "reinforces_pattern", 0.75); err != nil {
						logger.LogError("Failed to create memory connection", err)
					}
				}
			} else {
				// Create new procedural memory about app usage
				proceduralInput := MemoryInput{
					UserId:           userId,
					MemoryType:       "procedural",
					Title:            fmt.Sprintf("%s usage pattern", app),
					Content:          fmt.Sprintf("Regular usage of %s has been observed, with a recent session of %s.", app, durationText),
					SourceId:         record.Id,
					SourceCollection: "track_items",
					Tags:             []string{"app_usage", "pattern", app},
				}
				
				proceduralMemory, err := ms.CreateMemory(proceduralInput)
				if err != nil {
					logger.LogError("Failed to create procedural memory", err)
				} else {
					// Create connection
					if err := ms.CreateConnection(userId, "memory", trackMemory.Id, "memory", proceduralMemory.Id, "establishes_pattern", 0.75); err != nil {
						logger.LogError("Failed to create memory connection", err)
					}
				}
			}
		}
	}

	logger.LogDebug("Successfully created memory for track item: %s", record.Id)
	return nil
}

// ProcessTrackFocus processes focus tracking data
func (ms *MemorySystem) ProcessTrackFocus(userId string, record core.Record) error {
	logger.LogDebug("Processing track focus for memory system: %s", record.Id)

	// Extract fields
	deviceId := record.GetString("device")
	metadata := record.GetString("metadata")
	beginDateStr := record.GetString("begin_date")
	endDateStr := record.GetString("end_date")
	
	// Extract tags
	var tags []string
	tagsJSON := record.Get("tags")
	if tagsJSON != nil {
		if err := json.Unmarshal([]byte(tagsJSON.(string)), &tags); err != nil {
			logger.LogError("Failed to unmarshal tags", err)
			tags = []string{}
		}
	}

	// Skip if missing critical data
	if beginDateStr == "" || endDateStr == "" {
		return nil
	}

	// Parse dates
	beginDate, err1 := time.Parse(time.RFC3339, beginDateStr)
	endDate, err2 := time.Parse(time.RFC3339, endDateStr)
	
	if err1 != nil || err2 != nil {
		logger.LogError("Failed to parse dates in track focus", err1)
		return fmt.Errorf("invalid dates in track focus")
	}

	// Calculate duration
	duration := endDate.Sub(beginDate)
	
	// Skip very short durations (less than 5 minutes)
	if duration < 5*time.Minute {
		return nil
	}

	// Create memory metadata
	memMetadata := map[string]interface{}{
		"focus_id":   record.Id,
		"device":     deviceId,
		"user_metadata": metadata,
		"begin_date": beginDate,
		"end_date":   endDate,
		"duration":   duration.Minutes(), // in minutes
		"focus_tags": tags,
	}

	// Create memory tags
	memTags := []string{"focus_session"}
	memTags = append(memTags, tags...)
	
	// Add tags for time of day
	hour := beginDate.Hour()
	if hour >= 5 && hour < 12 {
		memTags = append(memTags, "morning")
	} else if hour >= 12 && hour < 17 {
		memTags = append(memTags, "afternoon")
	} else if hour >= 17 && hour < 21 {
		memTags = append(memTags, "evening")
	} else {
		memTags = append(memTags, "night")
	}
	
	// Add tags for duration
	if duration >= 90*time.Minute {
		memTags = append(memTags, "deep-focus")
	} else if duration >= 45*time.Minute {
		memTags = append(memTags, "medium-focus")
	} else {
		memTags = append(memTags, "short-focus")
	}

	// Calculate importance - focus sessions are generally important
	importance := 0.6 // Base importance
	
	// Longer sessions are more important
	if duration >= 90*time.Minute {
		importance += 0.2
	} else if duration >= 45*time.Minute {
		importance += 0.1
	}
	
	// Certain focus categories are more important
	for _, tag := range tags {
		if tag == "creative" || tag == "writing" || tag == "learning" || tag == "work" {
			importance += 0.05
			break
		}
	}
	
	// Cap at 0.9
	if importance > 0.9 {
		importance = 0.9
	}

	// Create content
	durationText := formatDuration(duration)
	content := fmt.Sprintf("Focused for %s on %s. ", durationText, beginDate.Format("January 2, 2006"))
	
	if len(tags) > 0 {
		content += fmt.Sprintf("Focus categories: %s. ", strings.Join(tags, ", "))
	}
	
	if metadata != "" {
		content += fmt.Sprintf("Notes: %s. ", metadata)
	}
	
	content += fmt.Sprintf("Session started at %s and ended at %s.", 
		beginDate.Format("3:04 PM"), endDate.Format("3:04 PM"))

	episodicInput := MemoryInput{
		UserId:           userId,
		MemoryType:       "episodic",
		Title:            fmt.Sprintf("Focus Session: %s", strings.Join(tags, ", ")),
		Content:          content,
		SourceId:         record.Id,
		SourceCollection: "track_focus",
		Metadata:         memMetadata,
		Tags:             memTags,
		Importance:       &importance,
	}

	// Create the memory
	focusMemory, err := ms.CreateMemory(episodicInput)
	if err != nil {
		return fmt.Errorf("failed to create focus memory: %w", err)
	}

	// Get device entity if it exists
	deviceEntity, err := ms.entitySystem.GetOrCreateEntity(userId, "device", "Device "+deviceId, "A device used for activities")
	if err == nil {
		// Create connection between memory and device
		if err := ms.CreateConnection(userId, "memory", focusMemory.Id, "entity", deviceEntity.Id, "used_device", 0.7); err != nil {
			logger.LogError("Failed to create device connection", err)
		}
	}

	// For significant focus sessions, create/update semantic memory about focus patterns
	if duration >= 45*time.Minute {
		// Look for existing focus patterns for the same tags
		for _, tag := range tags {
			focusMemories, err := ms.GetRecentMemoriesByTags(userId, []string{"focus_session", tag}, 5)
			
			if err == nil && len(focusMemories) >= 3 {
				// Check if we already have a semantic memory for this focus type
				var focusPatternMemory *models.Memory
				for _, memory := range focusMemories {
					if memory.MemoryType == "semantic" && strings.Contains(memory.Title, tag) {
						focusPatternMemory = memory
						break
					}
				}
				
				if focusPatternMemory != nil {
					// Update existing semantic memory
					focusPatternMemory.Content = fmt.Sprintf("Regular focus on %s continues, with a recent session of %s.", tag, durationText)
					
					// Update memory
					if err := query.SaveRecord(focusPatternMemory); err != nil {
						logger.LogError("Failed to update semantic memory", err)
					} else {
						// Create connection
						if err := ms.CreateConnection(userId, "memory", focusMemory.Id, "memory", focusPatternMemory.Id, "reinforces_pattern", 0.8); err != nil {
							logger.LogError("Failed to create memory connection", err)
						}
					}
				} else {
					// Create new semantic memory about focus pattern
					semanticInput := MemoryInput{
						UserId:           userId,
						MemoryType:       "semantic",
						Title:            fmt.Sprintf("Focus pattern: %s", tag),
						Content:          fmt.Sprintf("Regular focus on %s has been observed, with a recent session of %s.", tag, durationText),
						SourceId:         record.Id,
						SourceCollection: "track_focus",
						Tags:             []string{"focus_session", "pattern", tag},
					}
					
					semanticMemory, err := ms.CreateMemory(semanticInput)
					if err != nil {
						logger.LogError("Failed to create semantic memory", err)
					} else {
						// Create connection
						if err := ms.CreateConnection(userId, "memory", focusMemory.Id, "memory", semanticMemory.Id, "establishes_pattern", 0.8); err != nil {
							logger.LogError("Failed to create memory connection", err)
						}
					}
				}
			}
		}
	}

	logger.LogDebug("Successfully created memory for focus session: %s", record.Id)
	return nil
}

// CreateMemory creates a new memory from input
func (ms *MemorySystem) CreateMemory(input MemoryInput) (*models.Memory, error) {
	// Validate input
	if input.UserId == "" {
		return nil, fmt.Errorf("user ID is required")
	}
	if input.Title == "" {
		return nil, fmt.Errorf("title is required")
	}
	if input.Content == "" {
		return nil, fmt.Errorf("content is required")
	}
	if input.MemoryType == "" {
		input.MemoryType = "episodic" // Default memory type
	}

	// Create memory model
	memory := &models.Memory{
		User:       input.UserId,
		MemoryType: input.MemoryType,
		Title:      input.Title,
		Content:    input.Content,
		Strength:   1.0, // New memories start with full strength
		AccessCount: 0,
		LastAccessed: types.NowDateTime(),
	}

	// Generate ID
	memory.Id = util.GenerateRandomId()

	// Set importance (or calculate it if not provided)
	if input.Importance != nil {
		memory.Importance = *input.Importance
	} else {
		memory.Importance = ms.calculateImportance(input)
	}

	// Add source record if provided
	if input.SourceId != "" {
		sourceRecords := []string{input.SourceId}
		sourceRecordsJSON, err := json.Marshal(sourceRecords)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal source records: %w", err)
		}
		var srcRecords types.JSONRaw
		if err := srcRecords.Scan(sourceRecordsJSON); err != nil {
			return nil, fmt.Errorf("failed to scan source records: %w", err)
		}
		memory.SourceRecords = srcRecords
	}

	// Add temporal context
	temporalContext := map[string]interface{}{
		"created_at": types.NowDateTime(),
	}
	if input.Metadata != nil {
		for k, v := range input.Metadata {
			temporalContext[k] = v
		}
	}
	temporalContextJSON, err := json.Marshal(temporalContext)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal temporal context: %w", err)
	}
	var tempContext types.JSONRaw
	if err := tempContext.Scan(temporalContextJSON); err != nil {
		return nil, fmt.Errorf("failed to scan temporal context: %w", err)
	}
	memory.TemporalContext = tempContext

	// Add tags
	if len(input.Tags) > 0 {
		tagsJSON, err := json.Marshal(input.Tags)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal tags: %w", err)
		}
		var tags types.JSONRaw
		if err := tags.Scan(tagsJSON); err != nil {
			return nil, fmt.Errorf("failed to scan tags: %w", err)
		}
		memory.Tags = tags
	}

	// Generate embedding
	embedding, err := ms.embeddingSystem.GenerateEmbedding(context.Background(), input.Title + " " + input.Content)
	if err != nil {
		logger.LogError("Failed to generate embedding: %s", err)
	} else {
		if err := ms.embeddingSystem.StoreEmbedding(memory, embedding); err != nil {
			logger.LogError("Failed to store embedding: %s", err)
		}
	}

	// Save the memory
	if err := query.SaveRecord(memory); err != nil {
		return nil, fmt.Errorf("failed to save memory: %w", err)
	}

	// Create connections to entities if provided
	for _, entityId := range input.Entities {
		if err := ms.CreateConnection(input.UserId, "memory", memory.Id, "entity", entityId, "related_to", 0.7); err != nil {
			logger.LogError("Failed to create connection to entity: %s", err)
		}
	}

	// Update memory cache
	ms.cacheMemory(input.UserId, memory)

	return memory, nil
}

// CreateOrUpdateSemanticMemory creates or updates a semantic memory
func (ms *MemorySystem) CreateOrUpdateSemanticMemory(input MemoryInput) (*models.Memory, error) {
	// Check if a similar semantic memory already exists
	existingMemories, err := ms.RetrieveMemories(input.UserId, input.Title, 5)
	if err != nil {
		logger.LogError("Error retrieving memories: %s", err)
	}

	for _, memory := range existingMemories {
		if memory.MemoryType == "semantic" {
			// If we found a similar memory, update it instead of creating a new one
			
			// Update content if needed
			if !strings.Contains(memory.Content, input.Content) {
				memory.Content = memory.Content + " " + input.Content

				// If the memory content changed, update the embedding
				embedding, err := ms.embeddingSystem.GenerateEmbedding(context.Background(), memory.Title + " " + memory.Content)
				if err == nil {
					if err := ms.embeddingSystem.StoreEmbedding(memory, embedding); err != nil {
						logger.LogError("Failed to store updated embedding: %s", err)
					}
				}
			}

			// Update source records if needed
			if input.SourceId != "" {
				var sourceRecords []string
				if err := json.Unmarshal(memory.SourceRecords, &sourceRecords); err != nil {
					sourceRecords = []string{}
				}

				// Check if source record already exists
				exists := false
				for _, src := range sourceRecords {
					if src == input.SourceId {
						exists = true
						break
					}
				}

				if !exists {
					sourceRecords = append(sourceRecords, input.SourceId)
					sourceRecordsJSON, err := json.Marshal(sourceRecords)
					if err == nil {
						var srcRecords types.JSONRaw
						if err := srcRecords.Scan(sourceRecordsJSON); err != nil {
							logger.LogError("Failed to scan source records: %s", err)
						} else {
							memory.SourceRecords = srcRecords
						}
					}
				}
			}

			// Update tags if needed
			if len(input.Tags) > 0 {
				var tags []string
				if err := json.Unmarshal(memory.Tags, &tags); err != nil {
					tags = []string{}
				}

				// Add new tags
				for _, tag := range input.Tags {
					exists := false
					for _, existingTag := range tags {
						if existingTag == tag {
							exists = true
							break
						}
					}

					if !exists {
						tags = append(tags, tag)
					}
				}

				tagsJSON, err := json.Marshal(tags)
				if err == nil {
					var tagsRaw types.JSONRaw
					if err := tagsRaw.Scan(tagsJSON); err != nil {
						logger.LogError("Failed to scan tags: %s", err)
					} else {
						memory.Tags = tagsRaw
					}
				}
			}

			// Update the memory
			if err := query.SaveRecord(memory); err != nil {
				return nil, fmt.Errorf("failed to update semantic memory: %w", err)
			}

			// Update memory cache
			ms.cacheMemory(input.UserId, memory)

			return memory, nil
		}
	}

	// If no similar memory exists, create a new one
	return ms.CreateMemory(input)
}

// CreateOrUpdateProceduralMemory creates or updates a procedural memory
func (ms *MemorySystem) CreateOrUpdateProceduralMemory(input MemoryInput) (*models.Memory, error) {
	// Similar to semantic memory, but for procedural type
	input.MemoryType = "procedural"
	return ms.CreateOrUpdateSemanticMemory(input)
}

// CreateConnection creates a connection between two memory system elements
func (ms *MemorySystem) CreateConnection(userId, sourceType, sourceId, targetType, targetId, connectionType string, strength float64) error {
	// Validate input
	if userId == "" {
		return fmt.Errorf("user ID is required")
	}
	if sourceType == "" || sourceId == "" {
		return fmt.Errorf("source type and ID are required")
	}
	if targetType == "" || targetId == "" {
		return fmt.Errorf("target type and ID are required")
	}
	if connectionType == "" {
		return fmt.Errorf("connection type is required")
	}

	// Check if connection already exists
	existingConnection, err := query.FindByFilter[*models.MemoryConnection](map[string]interface{}{
		"user":            userId,
		"source_type":     sourceType,
		"source_id":       sourceId,
		"target_type":     targetType,
		"target_id":       targetId,
		"connection_type": connectionType,
	})

	if err == nil && existingConnection != nil {
		// Connection exists, update strength if needed
		if strength > existingConnection.Strength {
			existingConnection.Strength = strength
			
			// Update connection
			if err := query.SaveRecord(existingConnection); err != nil {
				return fmt.Errorf("failed to update existing connection: %w", err)
			}
		}
		
		return nil
	}

	// Create new connection
	connection := &models.MemoryConnection{
		User:           userId,
		SourceType:     sourceType,
		SourceID:       sourceId,
		TargetType:     targetType,
		TargetID:       targetId,
		ConnectionType: connectionType,
		Strength:       strength,
	}

	// Generate ID
	connection.Id = util.GenerateRandomId()

	// Add metadata
	metadata := map[string]interface{}{
		"created_at": types.NowDateTime(),
	}
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}
	var metadataRaw types.JSONRaw
	if err := metadataRaw.Scan(metadataJSON); err != nil {
		return fmt.Errorf("failed to scan metadata: %w", err)
	}
	connection.Metadata = metadataRaw

	// Save the connection
	if err := query.SaveRecord(connection); err != nil {
		return fmt.Errorf("failed to save connection: %w", err)
	}

	return nil
}

// ConsolidateMemories performs memory consolidation (during "sleep phase")
func (ms *MemorySystem) ConsolidateMemories(userId string) error {
	logger.LogDebug("Starting memory consolidation for user: %s", userId)

	// Check if consolidation is needed based on last consolidation time
	ms.mutex.RLock()
	lastTime, exists := ms.lastConsolidation[userId]
	ms.mutex.RUnlock()
	
	if exists {
		intervalHours := time.Duration(ms.config.ConsolidationIntervalHours) * time.Hour
		if time.Since(lastTime) < intervalHours {
			logger.LogDebug("Skipping consolidation, last one was %s ago (interval: %s)", 
				time.Since(lastTime), intervalHours)
			return nil
		}
	}

	// Start a memory process record
	process := &models.MemoryProcess{
		User:        userId,
		ProcessType: "consolidation",
		StartTime:   types.NowDateTime(),
		Status:      "in_progress",
	}
	process.Id = util.GenerateRandomId()
	if err := query.SaveRecord(process); err != nil {
		return fmt.Errorf("failed to create process record: %w", err)
	}

	// Track metrics
	itemsProcessed := 0
	itemsCreated := 0
	itemsModified := 0

	// Define the completion function to update the process record
	completeProcess := func(status string, log string) {
		process.EndTime = types.NowDateTime()
		process.Status = status
		process.ItemsProcessed = itemsProcessed
		process.ItemsCreated = itemsCreated
		process.ItemsModified = itemsModified
		process.Log = log

		if err := query.SaveRecord(process); err != nil {
			logger.LogError("Failed to update process record: %s", err)
		}
		
		// Update last consolidation time
		ms.mutex.Lock()
		ms.lastConsolidation[userId] = time.Now()
		ms.mutex.Unlock()
	}

	// Get all memories for the user
	allMemories, err := query.FindAllByFilter[*models.Memory](map[string]interface{}{
		"user": userId,
	})

	if err != nil {
		completeProcess("failed", fmt.Sprintf("Failed to retrieve memories: %s", err))
		return fmt.Errorf("failed to retrieve memories: %w", err)
	}
	
	// Limit the number of memories to process if there are too many
	if len(allMemories) > ms.config.MaxMemoriesPerConsolidation {
		// Sort by recency, process the most recent ones
		sortByRecency(allMemories)
		allMemories = allMemories[:ms.config.MaxMemoriesPerConsolidation]
	}

	// Apply memory decay to all memories
	for _, memory := range allMemories {
		// Calculate time since last access
		timeSinceAccess := time.Since(memory.LastAccessed.Time())
		daysSinceAccess := timeSinceAccess.Hours() / 24

		if daysSinceAccess > 0 {
			// Apply forgetting curve based on memory type
			var decayRate float64
			switch memory.MemoryType {
			case "episodic":
				decayRate = ms.config.DecayRate * 1.2 // Episodic memories decay faster
			case "semantic":
				decayRate = ms.config.DecayRate * 0.7 // Semantic memories decay slower
			case "procedural":
				decayRate = ms.config.DecayRate * 0.5 // Procedural memories decay slowest
			default:
				decayRate = ms.config.DecayRate
			}

			// Stability factor increases with access count and importance
			stabilityFactor := 5.0 + float64(memory.AccessCount) + (memory.Importance * 10.0)

			// Calculate new strength using forgetting curve
			newStrength := memory.Strength * math.Exp(-daysSinceAccess * decayRate / stabilityFactor)

			// Update if strength changed significantly
			if math.Abs(newStrength-memory.Strength) > 0.01 {
				memory.Strength = newStrength

				if err := query.SaveRecord(memory); err != nil {
					logger.LogError("Failed to update memory strength: %s", err)
				} else {
					itemsModified++
				}
			}
		}

		itemsProcessed++
	}

	// Get recent memories (added within recent days threshold)
	recentTime := types.NowDateTime().AddDate(0, 0, -ms.config.RecentDaysThreshold)
	var recentMemories []*models.Memory
	
	for _, memory := range allMemories {
		if !memory.Created.Before(recentTime) {
			recentMemories = append(recentMemories, memory)
		}
	}

	if len(recentMemories) > 0 {
		// Group related memories based on similarity
		groups := ms.groupRelatedMemories(recentMemories)

		// For each group, create connections between memories
		for _, group := range groups {
			if len(group) > 1 {
				// Create connections between all memories in the group
				for i := 0; i < len(group); i++ {
					for j := i + 1; j < len(group); j++ {
						// Create bidirectional connections
						if err := ms.CreateConnection(userId, "memory", group[i].Id, "memory", group[j].Id, "related_to", 0.7); err != nil {
							logger.LogError("Failed to create connection: %s", err)
						} else {
							itemsCreated++
						}
					}
				}
			}
		}
		
		// For significant groups, create semantic memories to represent the group
		for _, group := range groups {
			if len(group) >= 3 {
				// Find common tags across the group
				commonTags := ms.findCommonTags(group)
				
				if len(commonTags) > 0 {
					// Create a semantic memory about this pattern
					semanticTitle := fmt.Sprintf("Pattern: %s", strings.Join(commonTags, ", "))
					semanticContent := "A pattern has been identified across multiple memories. "
					
					// Extract relevant excerpts from memories
					var excerpts []string
					for _, memory := range group[:min(3, len(group))] {
						// Extract a short excerpt
						excerpt := extractExcerpt(memory.Content, 50)
						excerpts = append(excerpts, excerpt)
					}
					
					if len(excerpts) > 0 {
						semanticContent += fmt.Sprintf("Examples include: %s", strings.Join(excerpts, "; "))
					}
					
					semanticMemory := &models.Memory{
						User:         userId,
						MemoryType:   "semantic",
						Title:        semanticTitle,
						Content:      semanticContent,
						Strength:     1.0,
						Importance:   0.7, // Patterns are important
						AccessCount:  0,
						LastAccessed: types.NowDateTime(),
					}
					
					// Generate ID
					semanticMemory.Id = util.GenerateRandomId()
					
					// Add temporal context
					temporalContext := map[string]interface{}{
						"created_at": types.NowDateTime(),
						"pattern_size": len(group),
					}
					
					temporalContextJSON, err := json.Marshal(temporalContext)
					if err == nil {
						var tempContext types.JSONRaw
						if err := tempContext.Scan(temporalContextJSON); err == nil {
							semanticMemory.TemporalContext = tempContext
						}
					}
					
					// Add tags
					tagsToAdd := append([]string{"pattern"}, commonTags...)
					tagsJSON, err := json.Marshal(tagsToAdd)
					if err == nil {
						var tags types.JSONRaw
						if err := tags.Scan(tagsJSON); err == nil {
							semanticMemory.Tags = tags
						}
					}
					
					// Generate embedding
					embedding, err := ms.embeddingSystem.GenerateEmbedding(context.Background(), semanticTitle + " " + semanticContent)
					if err == nil {
						if err := ms.embeddingSystem.StoreEmbedding(semanticMemory, embedding); err != nil {
							logger.LogError("Failed to store embedding: %s", err)
						}
					}
					
					// Save the memory
					if err := query.SaveRecord(semanticMemory); err != nil {
						logger.LogError("Failed to save semantic memory: %s", err)
					} else {
						// Create connections to all memories in the group
						for _, memory := range group {
							if err := ms.CreateConnection(userId, "memory", memory.Id, "memory", semanticMemory.Id, "part_of_pattern", 0.75); err != nil {
								logger.LogError("Failed to create connection: %s", err)
							} else {
								itemsCreated++
							}
						}
						
						itemsCreated++
					}
				}
			}
		}
	}

	// Generate insights if enabled
	if ms.config.EnableInsightGeneration {
		insights, err := ms.generateInsights(userId)
		if err != nil {
			logger.LogError("Failed to generate insights: %s", err)
		} else {
			itemsCreated += len(insights)
		}
	}

	// Complete the process
	completeProcess("completed", "Successfully consolidated memories")
	logger.LogDebug("Completed memory consolidation for user: %s", userId)

	return nil
}

// RetrieveMemories retrieves memories based on a query and performs multi-factor ranking
func (ms *MemorySystem) RetrieveMemories(userId string, queryString string, limit int) ([]*models.Memory, error) {
	// If no limit is specified, use the default
	if limit <= 0 {
		limit = ms.config.MaxSearchResults
	}

	// Get all memories for the user
	allMemories, err := query.FindAllByFilter[*models.Memory](map[string]interface{}{
		"user": userId,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to retrieve memories: %w", err)
	}

	// If query is empty, return recent memories
	if queryString == "" {
		sortByRecency(allMemories)
		if len(allMemories) > limit {
			allMemories = allMemories[:limit]
		}
		return allMemories, nil
	}

	// Generate query embedding
	queryEmbedding, err := ms.embeddingSystem.GenerateEmbedding(context.Background(), queryString)
	
	// Score memories using multi-factor ranking
	type scoredMemory struct {
		memory *models.Memory
		score  float64
	}

	var scoredMemories []scoredMemory

	for _, memory := range allMemories {
		// Skip memories with near-zero strength
		if memory.Strength < ms.config.MinStrengthThreshold {
			continue
		}

		// Calculate multi-factor score
		score := ms.calculateMemoryScore(memory, queryString, queryEmbedding, err == nil)

		// Only include memories with a minimum score
		logger.LogInfo("Memory: %s, Score: %.2f", memory.Title, score)
		if score > 0.5 {
			scoredMemories = append(scoredMemories, scoredMemory{memory, score})
		}
	}

	// Sort by score (descending)
	sort.Slice(scoredMemories, func(i, j int) bool {
		return scoredMemories[i].score > scoredMemories[j].score
	})

	// Extract top memories
	var result []*models.Memory
	for i, sm := range scoredMemories {
		if i >= limit {
			break
		}

		// Update access count and last accessed time
		sm.memory.AccessCount++
		sm.memory.LastAccessed = types.NowDateTime()

		// Save the memory
		if err := query.SaveRecord(sm.memory); err != nil {
			logger.LogError("Failed to update memory access: %s", err)
		}

		result = append(result, sm.memory)
	}

	return result, nil
}

// calculateMemoryScore calculates a comprehensive score for a memory based on multiple factors
func (ms *MemorySystem) calculateMemoryScore(memory *models.Memory, queryString string, queryEmbedding []float64, useEmbedding bool) float64 {
	var score float64 = 0.0
	
	// Factor 1: Semantic similarity (40% weight)
	var semanticScore float64 = 0.1  // Default minimal score
	
	if useEmbedding {
		var memoryEmbedding []float64
		if memory.Embedding != nil {
			if err := json.Unmarshal(memory.Embedding, &memoryEmbedding); err == nil && len(memoryEmbedding) > 0 {
				similarity := cosineSimilarity(queryEmbedding, memoryEmbedding)
				if similarity > 0.3 { // Only consider reasonable matches
					semanticScore = similarity
				}
			}
		}
	}
	
	// Factor 2: Keyword matching (25% weight)
	keywordScore := calculateKeywordScore(memory, queryString)
	
	// Factor 3: Recency factor (15% weight)
	recencyScore := calculateRecencyScore(memory.Created.Time())
	
	// Factor 4: Importance and strength (15% weight)
	importanceStrengthScore := (memory.Importance * 0.7) + (memory.Strength * 0.3)
	
	// Factor 5: Access frequency (5% weight)
	// Memories that are accessed more often are more important
	accessScore := math.Min(float64(memory.AccessCount) / 10.0, 1.0) // Cap at 1.0
	
	// Combine factors with weights
	score = (semanticScore * 0.4) + 
	        (keywordScore * 0.25) + 
	        (recencyScore * 0.15) + 
	        (importanceStrengthScore * 0.15) +
	        (accessScore * 0.05)
	
	return score
}

// GetRecentMemoriesByTags retrieves recent memories with specific tags
func (ms *MemorySystem) GetRecentMemoriesByTags(userId string, tags []string, limit int) ([]*models.Memory, error) {
	// Get all memories for the user
	allMemories, err := query.FindAllByFilter[*models.Memory](map[string]interface{}{
		"user": userId,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to retrieve memories: %w", err)
	}

	if len(tags) == 0 {
		// Sort by recency
		sortByRecency(allMemories)
		if len(allMemories) > limit {
			allMemories = allMemories[:limit]
		}
		return allMemories, nil
	}

	// Filter by tags
	var filtered []*models.Memory
	for _, memory := range allMemories {
		var memoryTags []string
		if err := json.Unmarshal(memory.Tags, &memoryTags); err != nil {
			continue
		}

		matches := 0
		for _, tag := range tags {
			for _, memoryTag := range memoryTags {
				if tag == memoryTag {
					matches++
					break
				}
			}
		}

		// If all tags match or at least one tag matches (depending on requirement)
		if (len(tags) > 1 && matches > 0) || matches == len(tags) {
			filtered = append(filtered, memory)
		}
	}

	// Sort by recency
	sortByRecency(filtered)

	if len(filtered) > limit {
		filtered = filtered[:limit]
	}

	return filtered, nil
}

// GetMemoryConnections retrieves all connections for a memory
func (ms *MemorySystem) GetMemoryConnections(userId, memoryId string) ([]*models.MemoryConnection, error) {
	// Get connections where this memory is the source
	sourceConnections, err := query.FindAllByFilter[*models.MemoryConnection](map[string]interface{}{
		"user":        userId,
		"source_type": "memory",
		"source_id":   memoryId,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to retrieve source connections: %w", err)
	}

	// Get connections where this memory is the target
	targetConnections, err := query.FindAllByFilter[*models.MemoryConnection](map[string]interface{}{
		"user":        userId,
		"target_type": "memory",
		"target_id":   memoryId,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to retrieve target connections: %w", err)
	}

	// Combine connections
	connections := append(sourceConnections, targetConnections...)

	return connections, nil
}

// GetEntityConnections retrieves all connections for an entity
func (ms *MemorySystem) GetEntityConnections(userId, entityId string) ([]*models.MemoryConnection, error) {
	// Get connections where this entity is the source
	sourceConnections, err := query.FindAllByFilter[*models.MemoryConnection](map[string]interface{}{
		"user":        userId,
		"source_type": "entity",
		"source_id":   entityId,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to retrieve source connections: %w", err)
	}

	// Get connections where this entity is the target
	targetConnections, err := query.FindAllByFilter[*models.MemoryConnection](map[string]interface{}{
		"user":        userId,
		"target_type": "entity",
		"target_id":   entityId,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to retrieve target connections: %w", err)
	}

	// Combine connections
	connections := append(sourceConnections, targetConnections...)

	return connections, nil
}

// calculateImportance determines the importance of a memory
func (ms *MemorySystem) calculateImportance(input MemoryInput) float64 {
	importance := 0.5 // Base importance

	// Type-based adjustment
	switch input.MemoryType {
	case "episodic":
		importance += 0.1 // Episodic memories slightly more important by default
	case "semantic":
		importance += 0.0 // Neutral
	case "procedural":
		importance += 0.05 // Slightly more important than semantic
	}

	// Source-based adjustment
	switch input.SourceCollection {
	case "tasks":
		importance += 0.1 // Tasks are important
	case "habits":
		importance += 0.05 // Habits are somewhat important
	case "daily_log":
		importance += 0.05 // Daily logs are somewhat important
	case "life_balance":
		importance += 0.15 // Life balance is very important
	case "track_focus":
		importance += 0.1 // Focus sessions are important
	}

	// Content-based adjustments
	content := strings.ToLower(input.Title + " " + input.Content)

	// Check for emotional content
	emotionalKeywords := []string{
		"amazing", "terrible", "wonderful", "awful", "excited", "happy", "sad", "angry",
		"thrilled", "depressed", "love", "hate", "important", "critical", "urgent",
		"frustrated", "anxious", "proud", "disappointed", "grateful", "overwhelmed", 
		"exhausted", "energized", "inspired", "stressed",
	}

	for _, keyword := range emotionalKeywords {
		if strings.Contains(content, keyword) {
			importance += 0.05
			break
		}
	}

	// Check for temporal markers of importance
	temporalKeywords := []string{
		"tomorrow", "today", "immediately", "urgent", "deadline", "soon", "now",
	}

	for _, keyword := range temporalKeywords {
		if strings.Contains(content, keyword) {
			importance += 0.1
			break
		}
	}

	// Check metadata for due dates
	if input.Metadata != nil {
		if dueDate, ok := input.Metadata["due_date"].(time.Time); ok {
			daysUntilDue := time.Until(dueDate).Hours() / 24
			if daysUntilDue < 0 {
				// Overdue
				importance += 0.3
			} else if daysUntilDue < 1 {
				// Due today
				importance += 0.25
			} else if daysUntilDue < 3 {
				// Due soon
				importance += 0.15
			} else if daysUntilDue < 7 {
				// Due this week
				importance += 0.05
			}
		}
	}

	// Cap importance at 1.0
	if importance > 1.0 {
		importance = 1.0
	}

	return importance
}

// groupRelatedMemories groups memories based on similarity
func (ms *MemorySystem) groupRelatedMemories(memories []*models.Memory) [][]*models.Memory {
	var groups [][]*models.Memory
	processed := make(map[string]bool)

	// Try to group by semantic similarity first
	if ms.config.EnableSemanticClustering {
		// First, collect all valid embeddings
		var memoryEmbeddings [][]float64
		var memoriesWithEmbeddings []*models.Memory
		
		for _, memory := range memories {
			var embedding []float64
			if memory.Embedding != nil && json.Unmarshal(memory.Embedding, &embedding) == nil && len(embedding) > 0 {
				memoryEmbeddings = append(memoryEmbeddings, embedding)
				memoriesWithEmbeddings = append(memoriesWithEmbeddings, memory)
			}
		}
		
		// If we have enough memories with embeddings, use clustering
		if len(memoryEmbeddings) >= 5 {
			// Simple clustering by similarity threshold
			for i := 0; i < len(memoriesWithEmbeddings); i++ {
				if processed[memoriesWithEmbeddings[i].Id] {
					continue
				}
				
				var group []*models.Memory
				group = append(group, memoriesWithEmbeddings[i])
				processed[memoriesWithEmbeddings[i].Id] = true
				
				for j := i + 1; j < len(memoriesWithEmbeddings); j++ {
					if processed[memoriesWithEmbeddings[j].Id] {
						continue
					}
					
					similarity := cosineSimilarity(memoryEmbeddings[i], memoryEmbeddings[j])
					if similarity >= ms.config.MinSimilarityThreshold {
						group = append(group, memoriesWithEmbeddings[j])
						processed[memoriesWithEmbeddings[j].Id] = true
					}
				}
				
				if len(group) > 0 {
					groups = append(groups, group)
				}
			}
		}
	}
	
	// Fallback to tag-based grouping
	// Group by common tags
	tagGroups := make(map[string][]*models.Memory)
	
	for _, memory := range memories {
		if processed[memory.Id] {
			continue
		}
		
		var tags []string
		if err := json.Unmarshal(memory.Tags, &tags); err != nil || len(tags) == 0 {
			continue
		}
		
		for _, tag := range tags {
			if tag == "daily_log" || tag == "app_usage" {
				continue // Skip very common tags
			}
			
			tagGroups[tag] = append(tagGroups[tag], memory)
		}
	}
	
	// Add tag-based groups if they have enough memories
	for _, group := range tagGroups {
		if len(group) >= 3 {
			// Ensure no duplicates
			var uniqueGroup []*models.Memory
			for _, memory := range group {
				if !processed[memory.Id] {
					uniqueGroup = append(uniqueGroup, memory)
					processed[memory.Id] = true
				}
			}
			
			if len(uniqueGroup) >= 2 {
				groups = append(groups, uniqueGroup)
			}
		}
	}
	
	// Simple text-based fallback for remaining memories
	for i, memory1 := range memories {
		if processed[memory1.Id] {
			continue
		}
		
		var group []*models.Memory
		group = append(group, memory1)
		processed[memory1.Id] = true
		
		for j := i + 1; j < len(memories); j++ {
			memory2 := memories[j]
			if processed[memory2.Id] {
				continue
			}
			
			// Calculate text similarity
			similarity := textSimilarity(memory1.Title+" "+memory1.Content, memory2.Title+" "+memory2.Content)
			if similarity >= ms.config.MinSimilarityThreshold {
				group = append(group, memory2)
				processed[memory2.Id] = true
			}
		}
		
		if len(group) > 1 {
			groups = append(groups, group)
		}
	}

	return groups
}

// findCommonTags finds tags that are common across a group of memories
func (ms *MemorySystem) findCommonTags(memories []*models.Memory) []string {
	if len(memories) == 0 {
		return []string{}
	}
	
	// Count tag occurrences
	tagCounts := make(map[string]int)
	
	for _, memory := range memories {
		var tags []string
		if err := json.Unmarshal(memory.Tags, &tags); err != nil {
			continue
		}
		
		// Track unique tags in this memory
		seen := make(map[string]bool)
		for _, tag := range tags {
			if !seen[tag] {
				tagCounts[tag]++
				seen[tag] = true
			}
		}
	}
	
	// Find tags that appear in more than half of the memories
	threshold := len(memories) / 2
	if threshold < 2 {
		threshold = 2
	}
	
	var commonTags []string
	for tag, count := range tagCounts {
		if count >= threshold && tag != "daily_log" && tag != "app_usage" {
			commonTags = append(commonTags, tag)
		}
	}
	
	return commonTags
}

// generateInsights generates insights based on memory patterns
func (ms *MemorySystem) generateInsights(userId string) ([]*models.Insight, error) {
	// Get recent memories
	memories, err := ms.GetRecentMemoriesByTags(userId, []string{}, 100)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve recent memories: %w", err)
	}

	if len(memories) < 5 {
		return nil, fmt.Errorf("not enough memories to generate insights")
	}

	// Get entities
	entities, err := query.FindAllByFilter[*models.Entity](map[string]interface{}{
		"user": userId,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to retrieve entities: %w", err)
	}

	var insights []*models.Insight
	count := 0
	maxInsights := ms.config.MaxInsightsPerConsolidation

	// Find frequently occurring entities
	entityFrequency := make(map[string]int)
	entityToObj := make(map[string]*models.Entity)

	for _, entity := range entities {
		entityFrequency[entity.Id] = 0
		entityToObj[entity.Id] = entity
	}

	// Count entity occurrences in memories
	for _, memory := range memories {
		connections, err := ms.GetMemoryConnections(userId, memory.Id)
		if err != nil {
			continue
		}

		for _, conn := range connections {
			if conn.TargetType == "entity" {
				entityFrequency[conn.TargetID]++
			} else if conn.SourceType == "entity" {
				entityFrequency[conn.SourceID]++
			}
		}
	}

	// Sort entities by frequency
	type entityFreq struct {
		id    string
		count int
	}

	var frequentEntities []*models.Entity
	var entityFreqs []entityFreq

	for id, freq := range entityFrequency {
		if freq >= 3 { // Threshold for "frequent"
			entityFreqs = append(entityFreqs, entityFreq{id, freq})
		}
	}

	sort.Slice(entityFreqs, func(i, j int) bool {
		return entityFreqs[i].count > entityFreqs[j].count
	})

	// Get top entities
	for i := 0; i < len(entityFreqs) && i < 5; i++ {
		frequentEntities = append(frequentEntities, entityToObj[entityFreqs[i].id])
	}

	// For frequent entities
	for _, entity := range frequentEntities {
		if count >= maxInsights {
			break
		}

		// Find memories connected to this entity
		connections, err := ms.GetEntityConnections(userId, entity.Id)
		if err != nil {
			continue
		}

		var relatedMemories []*models.Memory
		var sourceMemoriesIds []string

		for _, conn := range connections {
			if conn.TargetType == "memory" {
				memory, err := query.FindById[*models.Memory](conn.TargetID)
				if err == nil {
					relatedMemories = append(relatedMemories, memory)
					sourceMemoriesIds = append(sourceMemoriesIds, memory.Id)
				}
			} else if conn.SourceType == "memory" {
				memory, err := query.FindById[*models.Memory](conn.SourceID)
				if err == nil {
					relatedMemories = append(relatedMemories, memory)
					sourceMemoriesIds = append(sourceMemoriesIds, memory.Id)
				}
			}
		}

		// Generate an insight about this entity
		var content string

		switch entity.EntityType {
		case "person":
			content = fmt.Sprintf("%s appears in several of your memories. They seem to be a significant person in your life.", entity.Name)
		case "place":
			content = fmt.Sprintf("%s is a location you've referenced multiple times. It seems to be an important place for you.", entity.Name)
		case "project":
			content = fmt.Sprintf("%s is a project you've been working on across multiple entries. It might be significant for your goals.", entity.Name)
		case "concept":
			content = fmt.Sprintf("The concept of '%s' appears frequently in your memories. It might represent an important theme in your thinking.", entity.Name)
		case "organization":
			content = fmt.Sprintf("%s is an organization that appears in multiple memories. It might play a significant role in your activities.", entity.Name)
		case "technology":
			content = fmt.Sprintf("%s is a technology you've mentioned multiple times. It seems to be important in your work or interests.", entity.Name)
		default:
			content = fmt.Sprintf("%s appears frequently in your memories and might be significant.", entity.Name)
		}

		if content != "" {
			insight := &models.Insight{
				User:          userId,
				Title:         fmt.Sprintf("About %s", entity.Name),
				Content:       content,
				Category:      "entity_summary",
				Confidence:    0.8,
				IsHighlighted: false,
				UserRating:    0,
			}

			insight.Id = util.GenerateRandomId()

			// Add source memories
			sourceMemoriesJSON, err := json.Marshal(sourceMemoriesIds)
			if err == nil {
				var sourceMemories types.JSONRaw
				if err := sourceMemories.Scan(sourceMemoriesJSON); err != nil {
					logger.LogError("Failed to scan source memories: %s", err)
				} else {
					insight.SourceMemories = sourceMemories
				}
			}

			// Add related entities
			relatedEntitiesJSON, err := json.Marshal([]string{entity.Id})
			if err == nil {
				var relatedEntities types.JSONRaw
				if err := relatedEntities.Scan(relatedEntitiesJSON); err != nil {
					logger.LogError("Failed to scan related entities: %s", err)
				} else {
					insight.RelatedEntities = relatedEntities
				}
			}

			insights = append(insights, insight)
			count++

			if count >= maxInsights {
				break
			}
		}
	}

	// For memory clusters
	if count < maxInsights {
		// Group related memories
		memoryGroups := ms.groupRelatedMemories(memories)

		for _, group := range memoryGroups {
			if count >= maxInsights {
				break
			}

			if len(group) < 3 {
				continue // Ignore small groups
			}

			// Extract themes from the group
			var titles []string
			var contents []string
			var sourceMemoriesIds []string

			for _, memory := range group {
				titles = append(titles, memory.Title)
				contents = append(contents, memory.Content)
				sourceMemoriesIds = append(sourceMemoriesIds, memory.Id)
			}

			// Generate an insight based on the pattern
			title := "Pattern Found"
			var content string

			// Check if temporal pattern (e.g., recurring events)
			temporalPattern := true
			var typeCount = make(map[string]int)

			for _, memory := range group {
				typeCount[memory.MemoryType]++
			}

			if typeCount["episodic"] > len(group)/2 {
				content = fmt.Sprintf("You have several related memories about similar events. This might indicate a recurring theme or pattern in your experiences.")
			} else if typeCount["semantic"] > len(group)/2 {
				content = fmt.Sprintf("You've recorded several related semantic memories. This might represent an area of knowledge or interest that's important to you.")
			} else if typeCount["procedural"] > len(group)/2 {
				content = fmt.Sprintf("You have several procedural memories with similar patterns. This might represent a workflow or process you've been refining.")
			} else {
				content = fmt.Sprintf("A pattern has been detected across different types of memories. This might represent a multi-faceted interest or focus area.")
				temporalPattern = false
			}

			// Create the insight
			insight := &models.Insight{
				User:          userId,
				Title:         title,
				Content:       content,
				Category:      func() string {
					if temporalPattern {
						return "temporal_pattern"
					}
					return "thematic_pattern"
				}(),
				Confidence:    0.7,
				IsHighlighted: false,
				UserRating:    0,
			}

			insight.Id = util.GenerateRandomId()

			// Add source memories
			sourceMemoriesJSON, err := json.Marshal(sourceMemoriesIds)
			if err == nil {
				var sourceMemories types.JSONRaw
				if err := sourceMemories.Scan(sourceMemoriesJSON); err != nil {
					logger.LogError("Failed to scan source memories: %s", err)
				} else {
					insight.SourceMemories = sourceMemories
				}
			}

			insights = append(insights, insight)
			count++
		}
	}

	// For topical trends
	if count < maxInsights {
		// Analyze topic trends
		topicTrends := make(map[string][]string)

		for _, memory := range memories {
			var memoryTags []string
			if err := json.Unmarshal(memory.Tags, &memoryTags); err == nil {
				for _, tag := range memoryTags {
					if tag != "life_balance" && !strings.Contains(tag, "_") {
						topicTrends[tag] = append(topicTrends[tag], memory.Id)
					}
				}
			}
		}

		// Find trending topics
		for topic, memoryIds := range topicTrends {
			if count >= maxInsights {
				break
			}

			if len(memoryIds) >= 3 {
				// Create insight
				titleTopic := topic
				if len(topic) > 0 {
					// Capitalize first letter
					titleTopic = strings.ToUpper(topic[:1]) + topic[1:]
				}
				
				insight := &models.Insight{
					User:          userId,
					Title:         fmt.Sprintf("Interest in %s", titleTopic),
					Content:       fmt.Sprintf("You have been recording memories related to '%s' frequently. This may indicate a current interest or focus area.", topic),
					Category:      "topic_trend",
					Confidence:    0.75,
					IsHighlighted: false,
					UserRating:    0,
				}

				insight.Id = util.GenerateRandomId()

				// Add source memories
				sourceMemoriesJSON, err := json.Marshal(memoryIds)
				if err == nil {
					var sourceMemories types.JSONRaw
					if err := sourceMemories.Scan(sourceMemoriesJSON); err != nil {
						logger.LogError("Failed to scan source memories: %s", err)
					} else {
						insight.SourceMemories = sourceMemories
					}
				}

				insights = append(insights, insight)
				count++
			}
		}
	}

	// Individual highlight insights
	if count < maxInsights {
		for _, memory := range memories {
			if count >= maxInsights {
				break
			}

			// Only consider high importance memories
			if memory.Importance > ms.config.HighlightImportanceThreshold {
				insight := &models.Insight{
					User:          userId,
					Title:         "Memory Highlight",
					Content:       fmt.Sprintf("This memory about '%s' seems particularly important and might be worth revisiting.", memory.Title),
					Category:      "highlight",
					Confidence:    0.65,
					IsHighlighted: true,
					UserRating:    0,
				}

				insight.Id = util.GenerateRandomId()

				// Add source memories
				sourceMemoriesJSON, err := json.Marshal([]string{memory.Id})
				if err == nil {
					var sourceMemories types.JSONRaw
					if err := sourceMemories.Scan(sourceMemoriesJSON); err != nil {
						logger.LogError("Failed to scan source memories: %s", err)
					} else {
						insight.SourceMemories = sourceMemories
					}
				}

				insights = append(insights, insight)
				count++
			}
		}
	}

	// Save the insights
	for _, insight := range insights {
		if err := ms.CreateInsight(insight); err != nil {
			logger.LogError("Failed to save insight: %s", err)
		}
	}

	return insights, nil
}

// CreateInsight creates a new insight
func (ms *MemorySystem) CreateInsight(insight *models.Insight) error {
	// Validate input
	if insight.User == "" {
		return fmt.Errorf("user is required")
	}
	if insight.Title == "" {
		return fmt.Errorf("title is required")
	}
	if insight.Content == "" {
		return fmt.Errorf("content is required")
	}

	// Generate ID if not provided
	if insight.Id == "" {
		insight.Id = util.GenerateRandomId()
	}

	// Set created timestamp if not set
	if insight.Created.IsZero() {
		insight.Created = types.NowDateTime()
	}

	// Save the insight
	if err := query.SaveRecord(insight); err != nil {
		return fmt.Errorf("failed to save insight: %w", err)
	}

	return nil
}

// RateInsight allows users to rate an insight
func (ms *MemorySystem) RateInsight(userId, insightId string, rating float64) error {
	// Validate rating
	if rating < 1 || rating > 5 {
		return fmt.Errorf("rating must be between 1 and 5")
	}

	// Find the insight
	insight, err := query.FindById[*models.Insight](insightId)
	if err != nil {
		return fmt.Errorf("insight not found: %w", err)
	}

	// Verify the insight belongs to the user
	if insight.User != userId {
		return fmt.Errorf("unauthorized access to insight")
	}

	// Update the rating
	insight.UserRating = rating

	// Save the insight
	if err := query.SaveRecord(insight); err != nil {
		return fmt.Errorf("failed to update insight: %w", err)
	}

	return nil
}

// Helper functions

// cacheMemory caches a memory for faster access
func (ms *MemorySystem) cacheMemory(userId string, memory *models.Memory) {
	ms.mutex.Lock()
	defer ms.mutex.Unlock()
	
	// Initialize user cache if needed
	if _, exists := ms.memoryCache[userId]; !exists {
		ms.memoryCache[userId] = make(map[string]*Memory)
	}
	
	// Extract embedding if present
	var embeddingVector []float64
	if memory.Embedding != nil {
		if err := json.Unmarshal(memory.Embedding, &embeddingVector); err != nil {
			embeddingVector = nil
		}
	}
	
	// Create contextual data map
	contextualData := make(map[string]interface{})
	if memory.TemporalContext != nil {
		if err := json.Unmarshal(memory.TemporalContext, &contextualData); err != nil {
			contextualData = make(map[string]interface{})
		}
	}
	
	// Cache the memory
	ms.memoryCache[userId][memory.Id] = &Memory{
		Memory:          memory,
		EmbeddingVector: embeddingVector,
		ContextualData:  contextualData,
	}
}

// cosineSimilarity calculates the cosine similarity between two vectors
func cosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0.0
	}

	var dotProduct float64
	var normA float64
	var normB float64

	for i := 0; i < len(a); i++ {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 0.0
	}

	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}

// textSimilarity calculates similarity between two text strings
func textSimilarity(text1, text2 string) float64 {
	// Tokenize and normalize
	words1 := strings.Fields(strings.ToLower(text1))
	words2 := strings.Fields(strings.ToLower(text2))

	// Count word frequencies
	freq1 := make(map[string]int)
	freq2 := make(map[string]int)

	for _, word := range words1 {
		word = strings.Trim(word, ".,!?():;\"'")
		if len(word) > 1 && !isStopWord(word) {
			freq1[word]++
		}
	}

	for _, word := range words2 {
		word = strings.Trim(word, ".,!?():;\"'")
		if len(word) > 1 && !isStopWord(word) {
			freq2[word]++
		}
	}

	// Find common words
	commonWords := 0
	for word := range freq1 {
		if freq2[word] > 0 {
			commonWords++
		}
	}

	// Calculate Jaccard similarity
	uniqueWords := len(freq1) + len(freq2) - commonWords
	if uniqueWords == 0 {
		return 0.0
	}

	return float64(commonWords) / float64(uniqueWords)
}

// calculateRecencyScore returns a score based on how recent the time is
func calculateRecencyScore(t time.Time) float64 {
	daysSince := time.Since(t).Hours() / 24
	if daysSince < 0 {
		daysSince = 0 // Handle future dates gracefully
	}
	return math.Exp(-daysSince / 30) // 30-day half-life
}

// calculateKeywordScore calculates a score based on keyword matches
func calculateKeywordScore(memory *models.Memory, query string) float64 {
	content := strings.ToLower(memory.Content)
	title := strings.ToLower(memory.Title)
	queryLower := strings.ToLower(query)

	// Check for exact phrase match
	if strings.Contains(content, queryLower) {
		return 0.9
	}
	if strings.Contains(title, queryLower) {
		return 1.0
	}

	// Check for individual keyword matches
	keywords := strings.Fields(queryLower)
	matchCount := 0

	for _, keyword := range keywords {
		keyword = strings.Trim(keyword, ".,!?():;\"'")
		if len(keyword) <= 2 || isStopWord(keyword) {
			continue // Skip very short words and stop words
		}
		
		if strings.Contains(content, keyword) || strings.Contains(title, keyword) {
			matchCount++
		}
	}

	if len(keywords) > 0 {
		filteredCount := 0
		for _, keyword := range keywords {
			if len(keyword) > 2 && !isStopWord(keyword) {
				filteredCount++
			}
		}
		
		if filteredCount > 0 {
			return float64(matchCount) / float64(filteredCount)
		}
	}

	return 0.0
}

// sortByRecency sorts memories by recency (newest first)
func sortByRecency(memories []*models.Memory) {
	sort.Slice(memories, func(i, j int) bool {
		return memories[i].Created.After(memories[j].Created)
	})
}

// extractExcerpt extracts a short excerpt from text
func extractExcerpt(text string, maxLength int) string {
	if len(text) <= maxLength {
		return text
	}
	
	// Try to find a sentence break
	for i := maxLength; i > 0; i-- {
		if text[i] == '.' || text[i] == '!' || text[i] == '?' {
			return text[:i+1]
		}
	}
	
	// If no sentence break found, just cut at maxLength
	return text[:maxLength] + "..."
}

// categorizeApp categorizes an app by its purpose
func categorizeApp(appName string) string {
	// Convert to lowercase for case-insensitive matching
	appLower := strings.ToLower(appName)
	
	// Productivity apps
	productivityApps := []string{
		"word", "excel", "powerpoint", "notes", "evernote", "notion", "onenote", 
		"docs", "sheets", "slides", "calendar", "reminders", "outlook", "gmail",
		"trello", "asana", "jira", "slack", "teams", "zoom", "meet",
	}
	
	// Development apps
	developmentApps := []string{
		"code", "vscode", "visual studio", "intellij", "pycharm", "android studio",
		"xcode", "sublime", "vim", "emacs", "terminal", "powershell", "command",
		"github", "gitlab", "bitbucket", "sourcetree",
	}
	
	// Creativity apps
	creativityApps := []string{
		"photoshop", "illustrator", "indesign", "lightroom", "premiere", "after effects",
		"figma", "sketch", "canva", "gimp", "blender", "maya", "garageband", "logic",
		"audacity", "protools", "ableton",
	}
	
	// Entertainment apps
	entertainmentApps := []string{
		"netflix", "hulu", "disney", "youtube", "spotify", "apple music", "prime video",
		"hbo", "twitch", "games", "steam", "epic games", "xbox", "playstation",
	}
	
	// Social/communication apps
	socialApps := []string{
		"facebook", "instagram", "twitter", "snapchat", "tiktok", "whatsapp", "telegram",
		"signal", "messenger", "discord", "reddit", "linkedin",
	}
	
	// Check categories
	for _, app := range productivityApps {
		if strings.Contains(appLower, app) {
			return "productivity"
		}
	}
	
	for _, app := range developmentApps {
		if strings.Contains(appLower, app) {
			return "development"
		}
	}
	
	for _, app := range creativityApps {
		if strings.Contains(appLower, app) {
			return "creativity"
		}
	}
	
	for _, app := range entertainmentApps {
		if strings.Contains(appLower, app) {
			return "entertainment"
		}
	}
	
	for _, app := range socialApps {
		if strings.Contains(appLower, app) {
			return "social"
		}
	}
	
	// Web browsers get special handling
	browsers := []string{
		"chrome", "firefox", "safari", "edge", "opera", "brave", "browser",
	}
	
	for _, browser := range browsers {
		if strings.Contains(appLower, browser) {
			return "web-browsing"
		}
	}
	
	return "other"
}

// formatDuration formats a duration in a human-readable way
func formatDuration(d time.Duration) string {
	hours := int(d.Hours())
	minutes := int(d.Minutes()) % 60
	
	if hours > 0 {
		if minutes > 0 {
			return fmt.Sprintf("%d hour%s %d minute%s", 
				hours, pluralS(hours), minutes, pluralS(minutes))
		}
		return fmt.Sprintf("%d hour%s", hours, pluralS(hours))
	}
	
	return fmt.Sprintf("%d minute%s", minutes, pluralS(minutes))
}

// pluralS returns "s" for plural forms
func pluralS(count int) string {
	if count == 1 {
		return ""
	}
	return "s"
}
package memorysystem

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"

	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/shashank-sharma/backend/internal/logger"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/query"
	"github.com/shashank-sharma/backend/internal/util"
)

// EntityRecognitionSystem handles extracting and managing entities
type EntityRecognitionSystem struct {
	mutex sync.Mutex
	knownEntities map[string]map[string]*models.Entity // userId -> entityName -> Entity
	entityPatterns map[string][]*EntityPattern
	commonWords map[string]bool
	embeddingSystem *EmbeddingSystem
}

// EntityPattern defines a context-aware pattern for entity extraction
type EntityPattern struct {
	EntityType string
	Pattern *regexp.Regexp
	ContextWords []string
	Priority int
}

// NewEntityRecognitionSystem creates a new entity recognition system
func NewEntityRecognitionSystem(embeddingSystem *EmbeddingSystem) *EntityRecognitionSystem {
	ers := &EntityRecognitionSystem{
		knownEntities:   make(map[string]map[string]*models.Entity),
		entityPatterns:  make(map[string][]*EntityPattern),
		commonWords:     buildCommonWordsMap(),
		embeddingSystem: embeddingSystem,
	}

	ers.registerDefaultPatterns()

	return ers
}

// RegisterPattern adds a new entity extraction pattern
func (ers *EntityRecognitionSystem) RegisterPattern(entityType string, patternRegex string, contextWords []string, priority int) error {
	pattern, err := regexp.Compile(patternRegex)
	if err != nil {
		return fmt.Errorf("invalid regex pattern %s: %w", patternRegex, err)
	}

	ers.mutex.Lock()
	defer ers.mutex.Unlock()

	ers.entityPatterns[entityType] = append(ers.entityPatterns[entityType], &EntityPattern{
		EntityType:   entityType,
		Pattern:      pattern,
		ContextWords: contextWords,
		Priority:     priority,
	})

	sort.Slice(ers.entityPatterns[entityType], func(i, j int) bool {
		return ers.entityPatterns[entityType][i].Priority > ers.entityPatterns[entityType][j].Priority
	})

	return nil
}

// registerDefaultPatterns sets up the standard entity recognition patterns
func (ers *EntityRecognitionSystem) registerDefaultPatterns() {
	ers.RegisterPattern(
		"person",
		`(?i)\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{1,})?)\b`,
		[]string{"met", "with", "talked", "spoke", "called", "messaged", "visited", "saw", "meeting", "colleague", "friend", "family"},
		100,
	)
	
	ers.RegisterPattern(
		"place",
		`(?i)\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{1,})?)\b`,
		[]string{"at", "in", "to", "from", "near", "visited", "went", "location", "restaurant", "cafe", "park", "building", "street", "avenue", "plaza"},
		90,
	)
	
	ers.RegisterPattern(
		"project",
		`(?i)\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{1,})?|[A-Z]{2,})\b`,
		[]string{"project", "working", "developing", "building", "creating", "planning", "designing", "implementing", "milestone", "deadline", "sprint", "feature"},
		80,
	)
	
	ers.RegisterPattern(
		"organization",
		`(?i)\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{1,})?|[A-Z]{2,})\b`,
		[]string{"company", "organization", "team", "group", "department", "corp", "inc", "llc", "ltd", "corporation", "association", "institute"},
		70,
	)
	
	ers.RegisterPattern(
		"technology",
		`(?i)\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{1,})?|[A-Z][a-zA-Z]*(?:\.[a-zA-Z]+)+)\b`,
		[]string{"using", "learning", "working", "coding", "programming", "technology", "software", "platform", "framework", "language", "library", "tool"},
		60,
	)
	
	ers.RegisterPattern(
		"concept",
		`(?i)\b([a-z]{4,})\b`,
		[]string{"concept", "idea", "theory", "strategy", "approach", "method", "philosophy", "principle", "thought", "insight", "understanding"},
		50,
	)
}

// ExtractEntities analyzes text to extract and create entities
func (ers *EntityRecognitionSystem) ExtractEntities(userId, text string) ([]*models.Entity, error) {
	var extractedEntities []*models.Entity
	
	ers.ensureUserCache(userId)
	
	for entityType, patterns := range ers.entityPatterns {
		entities := ers.extractEntitiesByType(userId, text, entityType, patterns)
		extractedEntities = append(extractedEntities, entities...)
	}
	
	conceptEntities := ers.extractConceptsFromFrequency(userId, text)
	extractedEntities = append(extractedEntities, conceptEntities...)
	
	return ers.deduplicateEntities(extractedEntities), nil
}

// extractEntitiesByType extracts entities of a specific type from text
func (ers *EntityRecognitionSystem) extractEntitiesByType(userId, text, entityType string, patterns []*EntityPattern) []*models.Entity {
	var entities []*models.Entity
	
	for _, pattern := range patterns {
		hasContext := false
		for _, contextWord := range pattern.ContextWords {
			if strings.Contains(strings.ToLower(text), strings.ToLower(contextWord)) {
				hasContext = true
				break
			}
		}
		
		if !hasContext && len(pattern.ContextWords) > 0 {
			continue
		}
		
		matches := pattern.Pattern.FindAllStringSubmatch(text, -1)
		
		for _, match := range matches {
			if len(match) > 1 {
				name := strings.TrimSpace(match[1])
				
				if len(name) < 3 || ers.isCommonWord(name) {
					continue
				}
				
				if entityType == "concept" {
					count := strings.Count(strings.ToLower(text), strings.ToLower(name))
					if count < 2 {
						continue
					}
				}
				
				entity, err := ers.GetOrCreateEntity(userId, entityType, name, ers.generateDescription(entityType, name, text))
				if err != nil {
					logger.LogError("Error creating entity", err)
					continue
				}
				
				entities = append(entities, entity)
			}
		}
	}
	
	return entities
}

// extractConceptsFromFrequency extracts concept entities based on word frequency
func (ers *EntityRecognitionSystem) extractConceptsFromFrequency(userId, text string) []*models.Entity {
	var entities []*models.Entity
	
	words := strings.Fields(strings.ToLower(text))
	wordCount := make(map[string]int)
	
	for _, word := range words {
		word = strings.Trim(word, ".,!?():;\"'")
		if len(word) >= 4 && !ers.isCommonWord(word) {
			wordCount[word]++
		}
	}
	
	for word, count := range wordCount {
		if count >= 3 {
			entity, err := ers.GetOrCreateEntity(userId, "concept", word, fmt.Sprintf("A concept mentioned frequently in content (%d times)", count))
			if err != nil {
				logger.LogError("Error creating concept entity", err)
				continue
			}
			
			entities = append(entities, entity)
		}
	}
	
	return entities
}

// GetOrCreateEntity gets an entity by name or creates it if it doesn't exist
func (ers *EntityRecognitionSystem) GetOrCreateEntity(userId, entityType, name, description string) (*models.Entity, error) {
	ers.mutex.Lock()
	defer ers.mutex.Unlock()
	
	userEntities, userExists := ers.knownEntities[userId]
	if userExists {
		if entity, exists := userEntities[strings.ToLower(name)]; exists {
			entity.InteractionCount++
			entity.LastSeen = types.NowDateTime()
			if description != "" && !strings.Contains(entity.Description, description) {
				entity.Description = strings.TrimSpace(entity.Description + " " + description)
			}
			
			if err := query.SaveRecord(entity); err != nil {
				return nil, fmt.Errorf("failed to update entity: %w", err)
			}
			
			return entity, nil
		}
		
		// Check for similar entities to avoid duplication
		for _, entity := range userEntities {
			if entity.EntityType == entityType && ers.areNamesSimilar(name, entity.Name) {
				// Use the existing entity but note the alias
				if !strings.Contains(entity.Description, name) {
					entity.Description = strings.TrimSpace(entity.Description + " Also known as: " + name)
				}
				
				entity.InteractionCount++
				entity.LastSeen = types.NowDateTime()
				
				// Save the updated entity
				if err := query.SaveRecord(entity); err != nil {
					return nil, fmt.Errorf("failed to update entity: %w", err)
				}
				
				return entity, nil
			}
		}
	} else {
		ers.knownEntities[userId] = make(map[string]*models.Entity)
	}
	
	existingEntity, err := query.FindByFilter[*models.Entity](map[string]interface{}{
		"user":        userId,
		"entity_type": entityType,
		"name":        name,
	})
	
	if err == nil && existingEntity != nil {
		existingEntity.InteractionCount++
		existingEntity.LastSeen = types.NowDateTime()
		
		if description != "" && !strings.Contains(existingEntity.Description, description) {
			existingEntity.Description = strings.TrimSpace(existingEntity.Description + " " + description)
		}
		
		if err := query.SaveRecord(existingEntity); err != nil {
			return nil, fmt.Errorf("failed to update entity: %w", err)
		}
		
		ers.knownEntities[userId][strings.ToLower(name)] = existingEntity
		
		return existingEntity, nil
	}
	
	// Create new entity
	newEntity := &models.Entity{
		User:             userId,
		EntityType:       entityType,
		Name:             name,
		Description:      description,
		Importance:       ers.calculateEntityImportance(entityType),
		FirstSeen:        types.NowDateTime(),
		LastSeen:         types.NowDateTime(),
		InteractionCount: 1,
	}
	
	// Generate ID
	newEntity.Id = util.GenerateRandomId()
	
	// Initialize JSON fields
	sourceRecords := []string{}
	sourceRecordsJSON, err := json.Marshal(sourceRecords)
	if err == nil {
		var srcRecords types.JSONRaw
		if srcRecords.Scan(sourceRecordsJSON) == nil {
			newEntity.SourceRecords = srcRecords
		}
	}
	
	attributes := map[string]interface{}{}
	attributesJSON, err := json.Marshal(attributes)
	if err == nil {
		var attrs types.JSONRaw
		if attrs.Scan(attributesJSON) == nil {
			newEntity.Attributes = attrs
		}
	}
	
	// Generate embedding for entity
	if ers.embeddingSystem != nil {
		embedding, err := ers.embeddingSystem.GenerateEmbedding(name + " " + description)
		if err == nil {
			embeddingJSON, err := json.Marshal(embedding)
			if err == nil {
				var embedRaw types.JSONRaw
				if embedRaw.Scan(embeddingJSON) == nil {
					newEntity.Embedding = embedRaw
				}
			}
		}
	}
	
	if err := query.SaveRecord(newEntity); err != nil {
		return nil, fmt.Errorf("failed to save entity: %w", err)
	}
	
	ers.knownEntities[userId][strings.ToLower(name)] = newEntity
	
	return newEntity, nil
}

// LoadUserEntities preloads entities for a user into the cache
func (ers *EntityRecognitionSystem) LoadUserEntities(userId string) error {
	ers.mutex.Lock()
	defer ers.mutex.Unlock()
	
	ers.knownEntities[userId] = make(map[string]*models.Entity)
	
	entities, err := query.FindAllByFilter[*models.Entity](map[string]interface{}{
		"user": userId,
	})
	
	if err != nil {
		return fmt.Errorf("failed to load entities: %w", err)
	}
	
	for _, entity := range entities {
		ers.knownEntities[userId][strings.ToLower(entity.Name)] = entity
	}
	
	return nil
}

// ensureUserCache ensures the user's entity cache is initialized
func (ers *EntityRecognitionSystem) ensureUserCache(userId string) {
	ers.mutex.Lock()
	defer ers.mutex.Unlock()
	
	if _, exists := ers.knownEntities[userId]; !exists {
		ers.knownEntities[userId] = make(map[string]*models.Entity)
		
		entities, err := query.FindAllByFilter[*models.Entity](map[string]interface{}{
			"user": userId,
		})
		
		if err == nil {
			for _, entity := range entities {
				ers.knownEntities[userId][strings.ToLower(entity.Name)] = entity
			}
		}
	}
}

// generateDescription creates a contextual description for an entity
func (ers *EntityRecognitionSystem) generateDescription(entityType, name, text string) string {
	switch entityType {
	case "person":
		return "A person mentioned in your content"
	case "place":
		return "A location referenced in your content"
	case "project":
		return "A project you've mentioned"
	case "organization":
		return "An organization referenced in your content"
	case "technology":
		return "A technology mentioned in your content"
	case "concept":
		return "A concept that appears in your content"
	default:
		return fmt.Sprintf("A %s entity in your content", entityType)
	}
}

// calculateEntityImportance assigns an initial importance value to entities
func (ers *EntityRecognitionSystem) calculateEntityImportance(entityType string) float64 {
	switch entityType {
	case "person":
		return 0.7 // People are generally important
	case "project":
		return 0.8 // Projects are highly important
	case "place":
		return 0.6
	case "organization":
		return 0.7
	case "technology":
		return 0.6
	case "concept":
		return 0.5 // Base importance for concepts
	default:
		return 0.5 // Default importance
	}
}

// isCommonWord checks if a word is too common to be an entity
func (ers *EntityRecognitionSystem) isCommonWord(word string) bool {
	word = strings.ToLower(word)
	
	if ers.commonWords[word] {
		return true
	}
	
	commonTitles := []string{"mr", "mrs", "ms", "dr", "prof", "miss", "sir", "madam", "lord", "lady"}
	for _, title := range commonTitles {
		if word == title {
			return true
		}
	}
	
	timeWords := []string{"january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", 
		"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
		"good", "great", "bad", "nice", "fine", "new", "old", "big", "small", "high", "low"}
	
	for _, timeWord := range timeWords {
		if word == timeWord {
			return true
		}
	}
	
	return false
}

// areNamesSimilar checks if two entity names are similar enough to be considered the same
func (ers *EntityRecognitionSystem) areNamesSimilar(name1, name2 string) bool {
	name1 = strings.ToLower(name1)
	name2 = strings.ToLower(name2)
	
	if name1 == name2 {
		return true
	}
	
	// Check for one name being a substring of the other
	if strings.Contains(name1, name2) || strings.Contains(name2, name1) {
		// But they should be similar in length
		maxLen := max(len(name1), len(name2))
		minLen := min(len(name1), len(name2))
		
		// If one is much shorter than the other, not a match
		if float64(minLen)/float64(maxLen) < 0.7 {
			return false
		}
		
		return true
	}
	
	// Check Levenshtein distance for similar names
	distance := levenshteinDistance(name1, name2)
	maxLen := max(len(name1), len(name2))
	
	// Allow for some edit distance proportional to length
	return float64(distance)/float64(maxLen) < 0.3
}

// deduplicateEntities removes duplicate entities from a list
func (ers *EntityRecognitionSystem) deduplicateEntities(entities []*models.Entity) []*models.Entity {
	if len(entities) <= 1 {
		return entities
	}
	
	uniqueEntities := make(map[string]*models.Entity)
	for _, entity := range entities {
		uniqueEntities[entity.Id] = entity
	}
	
	result := make([]*models.Entity, 0, len(uniqueEntities))
	for _, entity := range uniqueEntities {
		result = append(result, entity)
	}
	
	return result
}

// buildCommonWordsMap builds the map of common words to avoid as entities
func buildCommonWordsMap() map[string]bool {
	commonWords := []string{
		// Common English words
		"a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "from",
		"by", "for", "with", "about", "against", "between", "into", "through", "during", 
		"before", "after", "above", "below", "to", "of", "in", "out", "on", "off", "over",
		"under", "again", "further", "once", "here", "there", "when", "where", "why", "how",
		"all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no",
		"nor", "not", "only", "own", "same", "so", "than", "too", "very", "this", "that",
		"these", "those", "one", "two", "three", "four", "five", "first", "last", "next",
		"many", "much", "will", "shall", "may", "might", "must", "can", "could", "would",
		"should", "ought", "need", "want", "like", "hate", "love", "think", "know", "feel",
		"see", "hear", "smell", "taste", "touch", "look", "watch", "listen", "say", "tell",
		"make", "create", "build", "break", "read", "write", "speak", "talk", "walk", "run",
		"take", "put", "send", "receive", "buy", "sell", "pay", "cost", "find", "lose",
		"start", "stop", "begin", "end", "open", "close", "show", "hide", "come", "go",
		"move", "stand", "sit", "lie", "rise", "fall", "increase", "decrease", "grow",
		"help", "play", "work", "study", "learn", "teach", "change", "try", "attempt",
		
		// Common terms in tasks and daily notes
		"today", "tomorrow", "yesterday", "week", "month", "year", "morning", "afternoon",
		"evening", "night", "plan", "task", "todo", "meeting", "call", "email", "message",
		"update", "review", "check", "finish", "complete", "done", "pending", "progress",
		"start", "begin", "end", "continue", "follow", "priority", "high", "medium", "low",
		"important", "urgent", "later", "soon", "now", "never", "always", "sometimes",
		"often", "rarely", "regular", "routine", "daily", "weekly", "monthly", "yearly",
		"goal", "target", "deadline", "due", "schedule", "calendar", "appointment", "event",
		
		// Common feelings and states
		"happy", "sad", "angry", "frustrated", "excited", "bored", "tired", "energetic",
		"focused", "distracted", "productive", "unproductive", "motivated", "unmotivated",
		"stressed", "relaxed", "busy", "free", "available", "unavailable", "present", "absent",
		
		// Common action words
		"add", "remove", "edit", "delete", "update", "create", "modify", "change", "adjust",
		"fix", "repair", "improve", "enhance", "optimize", "simplify", "complicate",
	}
	
	result := make(map[string]bool, len(commonWords))
	for _, word := range commonWords {
		result[word] = true
	}
	
	return result
}

// levenshteinDistance calculates the edit distance between two strings
func levenshteinDistance(s1, s2 string) int {
	s1 = strings.ToLower(s1)
	s2 = strings.ToLower(s2)
	
	d := make([][]int, len(s1)+1)
	for i := range d {
		d[i] = make([]int, len(s2)+1)
	}
	
	for i := range d {
		d[i][0] = i
	}
	for j := range d[0] {
		d[0][j] = j
	}
	
	for j := 1; j <= len(s2); j++ {
		for i := 1; i <= len(s1); i++ {
			if s1[i-1] == s2[j-1] {
				d[i][j] = d[i-1][j-1]
			} else {
				d[i][j] = min(
					d[i-1][j]+1,   // Deletion
					d[i][j-1]+1,   // Insertion
					d[i-1][j-1]+1, // Substitution
				)
			}
		}
	}
	
	return d[len(s1)][len(s2)]
}

// min returns the minimum of three integers
func min(a, b int, c ...int) int {
	result := a
	for _, v := range append([]int{b}, c...) {
		if v < result {
			result = v
		}
	}
	return result
}

// max returns the maximum of two integers
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
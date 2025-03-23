package models

import (
	"github.com/pocketbase/pocketbase/tools/types"
)

var _ Model = (*Memory)(nil)
var _ Model = (*Entity)(nil)
var _ Model = (*MemoryConnection)(nil)
var _ Model = (*Insight)(nil)
var _ Model = (*MemoryProcess)(nil)

// Memory represents a memory entry in the system
type Memory struct {
	BaseModel

	User            string          `db:"user" json:"user"`                         // Foreign key to users
	MemoryType      string          `db:"memory_type" json:"memory_type"`           // episodic, semantic, procedural
	Title           string          `db:"title" json:"title"`                       // Brief summary
	Content         string          `db:"content" json:"content"`                   // Detailed content
	Embedding       types.JSONRaw   `db:"embedding" json:"embedding"`               // Vector representation
	Importance      float64         `db:"importance" json:"importance"`             // 0.0-1.0 score
	Strength        float64         `db:"strength" json:"strength"`                 // Current strength (affected by decay)
	AccessCount     int             `db:"access_count" json:"access_count"`         // Times retrieved
	LastAccessed    types.DateTime        `db:"last_accessed" json:"last_accessed"`       // Last retrieval
	SourceRecords   types.JSONRaw   `db:"source_records" json:"source_records"`     // Original record IDs
	TemporalContext types.JSONRaw   `db:"temporal_context" json:"temporal_context"` // Time-related metadata
	Tags            types.JSONRaw   `db:"tags" json:"tags"`                         // Categorical tags
}

// Entity represents an important entity extracted from memories
type Entity struct {
	BaseModel

	User             string        `db:"user" json:"user"`                           // Foreign key to users
	EntityType       string        `db:"entity_type" json:"entity_type"`             // person, place, project, concept, device
	Name             string        `db:"name" json:"name"`                           // Entity name
	Description      string        `db:"description" json:"description"`             // Description
	Attributes       types.JSONRaw `db:"attributes" json:"attributes"`               // Additional properties
	Importance       float64       `db:"importance" json:"importance"`               // 0.0-1.0 score
	FirstSeen        types.DateTime      `db:"first_seen" json:"first_seen"`               // First appearance
	LastSeen         types.DateTime      `db:"last_seen" json:"last_seen"`                 // Most recent appearance
	InteractionCount int           `db:"interaction_count" json:"interaction_count"` // Number of interactions
	SourceRecords    types.JSONRaw `db:"source_records" json:"source_records"`       // Original record IDs
	Embedding        types.JSONRaw `db:"embedding" json:"embedding"`                 // Vector representation (optional)
}

// MemoryConnection represents a relationship between memories and/or entities
type MemoryConnection struct {
	BaseModel

	User           string        `db:"user" json:"user"`                       // Foreign key to users
	SourceType     string        `db:"source_type" json:"source_type"`         // memory or entity
	SourceID       string        `db:"source_id" json:"source_id"`             // ID of source
	TargetType     string        `db:"target_type" json:"target_type"`         // memory or entity
	TargetID       string        `db:"target_id" json:"target_id"`             // ID of target
	ConnectionType string        `db:"connection_type" json:"connection_type"` // Relationship type
	Strength       float64       `db:"strength" json:"strength"`               // Connection strength
	Metadata       types.JSONRaw `db:"metadata" json:"metadata"`               // Additional properties
}

// Insight represents a generated insight from memory patterns
type Insight struct {
	BaseModel

	User            string        `db:"user" json:"user"`                         // Foreign key to users
	Title           string        `db:"title" json:"title"`                       // Brief insight title
	Content         string        `db:"content" json:"content"`                   // Detailed insight content
	Category        string        `db:"category" json:"category"`                 // Categorization
	Confidence      float64       `db:"confidence" json:"confidence"`             // Confidence level (0.0-1.0)
	SourceMemories  types.JSONRaw `db:"source_memories" json:"source_memories"`   // Related memory IDs
	RelatedEntities types.JSONRaw `db:"related_entities" json:"related_entities"` // Related entity IDs
	IsHighlighted   bool          `db:"is_highlighted" json:"is_highlighted"`     // Whether to highlight
	UserRating      float64       `db:"user_rating" json:"user_rating"`           // Optional user feedback (1-5)
}

// MemoryProcess tracks memory system processes like consolidation
type MemoryProcess struct {
	BaseModel

	User           string    `db:"user" json:"user"`                       // Foreign key to users
	ProcessType    string    `db:"process_type" json:"process_type"`       // consolidation, decay, etc.
	StartTime      types.DateTime  `db:"start_time" json:"start_time"`           // Process start
	EndTime        types.DateTime  `db:"end_time" json:"end_time"`               // Process end
	Status         string    `db:"status" json:"status"`                   // in_progress, completed, failed
	ItemsProcessed int       `db:"items_processed" json:"items_processed"` // Count of processed items
	ItemsCreated   int       `db:"items_created" json:"items_created"`     // Count of new items
	ItemsModified  int       `db:"items_modified" json:"items_modified"`   // Count of modified items
	Log            string    `db:"log" json:"log"`                         // Process log
}

// TableName returns the name of the memories collection
func (m *Memory) TableName() string {
	return "memories"
}

// TableName returns the name of the entities collection
func (m *Entity) TableName() string {
	return "entities"
}

// TableName returns the name of the memory_connections collection
func (m *MemoryConnection) TableName() string {
	return "memory_connections"
}

// TableName returns the name of the insights collection
func (m *Insight) TableName() string {
	return "insights"
}

// TableName returns the name of the memory_processes collection
func (m *MemoryProcess) TableName() string {
	return "memory_processes"
}

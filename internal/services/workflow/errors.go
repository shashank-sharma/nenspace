package workflow

import (
	"encoding/json"
	"fmt"
	"time"
)

type ErrorCode string

const (
	ErrCodeValidation     ErrorCode = "VALIDATION_ERROR"
	ErrCodeExecution      ErrorCode = "EXECUTION_ERROR"
	ErrCodeSchemaConflict ErrorCode = "SCHEMA_CONFLICT"
	ErrCodeConnector      ErrorCode = "CONNECTOR_ERROR"
	ErrCodeTimeout        ErrorCode = "TIMEOUT_ERROR"
	ErrCodeCancellation   ErrorCode = "CANCELLATION_ERROR"
	ErrCodeConfiguration  ErrorCode = "CONFIGURATION_ERROR"
)

type WorkflowError struct {
	Code      ErrorCode
	Message   string
	NodeID    string
	Cause     error
	Details   map[string]interface{}
	Timestamp time.Time
}

func (e *WorkflowError) Error() string {
	if e.NodeID != "" {
		if e.Cause != nil {
			return fmt.Sprintf("[%s] Node %s: %s: %v", e.Code, e.NodeID, e.Message, e.Cause)
		}
		return fmt.Sprintf("[%s] Node %s: %s", e.Code, e.NodeID, e.Message)
	}
	if e.Cause != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func (e *WorkflowError) Unwrap() error {
	return e.Cause
}

func (e *WorkflowError) ToJSON() string {
	data := map[string]interface{}{
		"code":      e.Code,
		"message":   e.Message,
		"timestamp": e.Timestamp.Format(time.RFC3339),
	}
	if e.NodeID != "" {
		data["node_id"] = e.NodeID
	}
	if e.Cause != nil {
		data["cause"] = e.Cause.Error()
	}
	if e.Details != nil {
		data["details"] = e.Details
	}
	jsonBytes, _ := json.Marshal(data)
	return string(jsonBytes)
}

type ValidationError struct {
	*WorkflowError
}

func NewValidationError(message string, nodeID string) *ValidationError {
	return &ValidationError{
		WorkflowError: &WorkflowError{
			Code:      ErrCodeValidation,
			Message:   message,
			NodeID:    nodeID,
			Details:   make(map[string]interface{}),
			Timestamp: time.Now(),
		},
	}
}

func NewValidationErrorWithDetails(message string, nodeID string, details map[string]interface{}) *ValidationError {
	return &ValidationError{
		WorkflowError: &WorkflowError{
			Code:      ErrCodeValidation,
			Message:   message,
			NodeID:    nodeID,
			Details:   details,
			Timestamp: time.Now(),
		},
	}
}

type ExecutionError struct {
	*WorkflowError
}

func NewExecutionError(message string, nodeID string, err error) *ExecutionError {
	return &ExecutionError{
		WorkflowError: &WorkflowError{
			Code:      ErrCodeExecution,
			Message:   message,
			NodeID:    nodeID,
			Cause:     err,
			Details:   make(map[string]interface{}),
			Timestamp: time.Now(),
		},
	}
}

func NewExecutionErrorWithDetails(message string, nodeID string, err error, details map[string]interface{}) *ExecutionError {
	return &ExecutionError{
		WorkflowError: &WorkflowError{
			Code:      ErrCodeExecution,
			Message:   message,
			NodeID:    nodeID,
			Cause:     err,
			Details:   details,
			Timestamp: time.Now(),
		},
	}
}

type SchemaError struct {
	*WorkflowError
}

func NewSchemaError(message string, nodeID string, err error) *SchemaError {
	return &SchemaError{
		WorkflowError: &WorkflowError{
			Code:      ErrCodeSchemaConflict,
			Message:   message,
			NodeID:    nodeID,
			Cause:     err,
			Details:   make(map[string]interface{}),
			Timestamp: time.Now(),
		},
	}
}

func NewSchemaErrorWithDetails(message string, nodeID string, err error, details map[string]interface{}) *SchemaError {
	return &SchemaError{
		WorkflowError: &WorkflowError{
			Code:      ErrCodeSchemaConflict,
			Message:   message,
			NodeID:    nodeID,
			Cause:     err,
			Details:   details,
			Timestamp: time.Now(),
		},
	}
}

type ConnectorError struct {
	*WorkflowError
	ConnectorType string
}

func NewConnectorError(message string, nodeID string, connectorType string, err error) *ConnectorError {
	return &ConnectorError{
		WorkflowError: &WorkflowError{
			Code:      ErrCodeConnector,
			Message:   message,
			NodeID:    nodeID,
			Cause:     err,
			Details:   map[string]interface{}{"connector_type": connectorType},
			Timestamp: time.Now(),
		},
		ConnectorType: connectorType,
	}
}

type TimeoutError struct {
	*WorkflowError
	TimeoutSeconds int
}

func NewTimeoutError(timeoutSeconds int) *TimeoutError {
	return &TimeoutError{
		WorkflowError: &WorkflowError{
			Code:      ErrCodeTimeout,
			Message:   fmt.Sprintf("workflow execution timed out after %d seconds", timeoutSeconds),
			Details:   map[string]interface{}{"timeout_seconds": timeoutSeconds},
			Timestamp: time.Now(),
		},
		TimeoutSeconds: timeoutSeconds,
	}
}

type CancellationError struct {
	*WorkflowError
}

func NewCancellationError() *CancellationError {
	return &CancellationError{
		WorkflowError: &WorkflowError{
			Code:      ErrCodeCancellation,
			Message:   "workflow execution was cancelled",
			Details:   make(map[string]interface{}),
			Timestamp: time.Now(),
		},
	}
}

type ConfigurationError struct {
	*WorkflowError
	ConfigField string
}

func NewConfigurationError(message string, nodeID string, configField string) *ConfigurationError {
	return &ConfigurationError{
		WorkflowError: &WorkflowError{
			Code:      ErrCodeConfiguration,
			Message:   message,
			NodeID:    nodeID,
			Details:   map[string]interface{}{"config_field": configField},
			Timestamp: time.Now(),
		},
		ConfigField: configField,
	}
}

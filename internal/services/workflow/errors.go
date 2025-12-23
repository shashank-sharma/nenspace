package workflow

import "fmt"

type WorkflowError struct {
	Message string
	Code    string
	Err     error
}

func (e *WorkflowError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

func (e *WorkflowError) Unwrap() error {
	return e.Err
}

type ValidationError struct {
	WorkflowError
	NodeID string
}

func NewValidationError(message string, nodeID string) *ValidationError {
	return &ValidationError{
		WorkflowError: WorkflowError{
			Message: message,
			Code:    "VALIDATION_ERROR",
		},
		NodeID: nodeID,
	}
}

type ExecutionError struct {
	WorkflowError
	NodeID string
}

func NewExecutionError(message string, nodeID string, err error) *ExecutionError {
	return &ExecutionError{
		WorkflowError: WorkflowError{
			Message: message,
			Code:    "EXECUTION_ERROR",
			Err:     err,
		},
		NodeID: nodeID,
	}
}

type TimeoutError struct {
	WorkflowError
	TimeoutSeconds int
}

func NewTimeoutError(timeoutSeconds int) *TimeoutError {
	return &TimeoutError{
		WorkflowError: WorkflowError{
			Message: fmt.Sprintf("workflow execution timed out after %d seconds", timeoutSeconds),
			Code:    "TIMEOUT_ERROR",
		},
		TimeoutSeconds: timeoutSeconds,
	}
}

type CancellationError struct {
	WorkflowError
}

func NewCancellationError() *CancellationError {
	return &CancellationError{
		WorkflowError: WorkflowError{
			Message: "workflow execution was cancelled",
			Code:    "CANCELLATION_ERROR",
		},
	}
}

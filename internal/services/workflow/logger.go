package workflow

import (
	"context"
	"fmt"

	"github.com/shashank-sharma/backend/internal/logger"
)

type WorkflowLogger struct {
	workflowID  string
	executionID string
	nodeID      string
}

func NewWorkflowLogger(workflowID string, executionID string) *WorkflowLogger {
	return &WorkflowLogger{
		workflowID:  workflowID,
		executionID: executionID,
	}
}

func (wl *WorkflowLogger) WithNode(nodeID string) *WorkflowLogger {
	return &WorkflowLogger{
		workflowID:  wl.workflowID,
		executionID: wl.executionID,
		nodeID:      nodeID,
	}
}

func (wl *WorkflowLogger) prefix() string {
	if wl.nodeID != "" {
		return fmt.Sprintf("[workflow:%s][execution:%s][node:%s]", wl.workflowID, wl.executionID, wl.nodeID)
	}
	if wl.executionID != "" {
		return fmt.Sprintf("[workflow:%s][execution:%s]", wl.workflowID, wl.executionID)
	}
	return fmt.Sprintf("[workflow:%s]", wl.workflowID)
}

func (wl *WorkflowLogger) Debug(msg string, fields ...interface{}) {
	logger.Info.Printf("%s DEBUG: %s %v", wl.prefix(), msg, fields)
}

func (wl *WorkflowLogger) Info(msg string, fields ...interface{}) {
	if len(fields) > 0 {
		logger.Info.Printf("%s %s %v", wl.prefix(), msg, fields)
	} else {
		logger.Info.Printf("%s %s", wl.prefix(), msg)
	}
}

func (wl *WorkflowLogger) Warn(msg string, fields ...interface{}) {
	if len(fields) > 0 {
		logger.LogWarning("%s %s %v", wl.prefix(), msg, fields)
	} else {
		logger.LogWarning("%s %s", wl.prefix(), msg)
	}
}

func (wl *WorkflowLogger) Error(msg string, err error, fields ...interface{}) {
	if err != nil {
		if len(fields) > 0 {
			logger.Error.Printf("%s %s: %v %v", wl.prefix(), msg, err, fields)
		} else {
			logger.Error.Printf("%s %s: %v", wl.prefix(), msg, err)
		}
	} else {
		if len(fields) > 0 {
			logger.Error.Printf("%s %s %v", wl.prefix(), msg, fields)
		} else {
			logger.Error.Printf("%s %s", wl.prefix(), msg)
		}
	}
}

func (wl *WorkflowLogger) Fatal(msg string, err error, fields ...interface{}) {
	if err != nil {
		if len(fields) > 0 {
			logger.Error.Fatalf("%s %s: %v %v", wl.prefix(), msg, err, fields)
		} else {
			logger.Error.Fatalf("%s %s: %v", wl.prefix(), msg, err)
		}
	} else {
		if len(fields) > 0 {
			logger.Error.Fatalf("%s %s %v", wl.prefix(), msg, fields)
		} else {
			logger.Error.Fatalf("%s %s", wl.prefix(), msg)
		}
	}
}

type contextKey string

const loggerKey contextKey = "workflow_logger"

func WithLogger(ctx context.Context, wl *WorkflowLogger) context.Context {
	return context.WithValue(ctx, loggerKey, wl)
}

func LoggerFromContext(ctx context.Context) *WorkflowLogger {
	if wl, ok := ctx.Value(loggerKey).(*WorkflowLogger); ok {
		return wl
	}
	return NewWorkflowLogger("unknown", "unknown")
}


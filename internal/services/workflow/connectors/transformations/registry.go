package transformations

func DefaultRegistry() *TransformationRegistry {
	registry := NewTransformationRegistry()

	registry.Register("rename", NewRenameTransformation())
	registry.Register("delete", NewDeleteTransformation())
	registry.Register("add", NewAddTransformation())

	return registry
}

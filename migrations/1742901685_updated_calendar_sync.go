package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("jwn6wr5k0kzlglc")
		if err != nil {
			return err
		}

		// add field
		if err := collection.Fields.AddMarshaledJSONAt(9, []byte(`{
			"autogeneratePattern": "",
			"hidden": false,
			"id": "text3548482499",
			"max": 0,
			"min": 0,
			"name": "sync_status",
			"pattern": "",
			"presentable": false,
			"primaryKey": false,
			"required": false,
			"system": false,
			"type": "text"
		}`)); err != nil {
			return err
		}

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("jwn6wr5k0kzlglc")
		if err != nil {
			return err
		}

		// remove field
		collection.Fields.RemoveById("text3548482499")

		return app.Save(collection)
	})
}

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

		// remove field
		collection.Fields.RemoveById("lo27ux9m")

		// add field
		if err := collection.Fields.AddMarshaledJSONAt(2, []byte(`{
			"cascadeDelete": false,
			"collectionId": "dss10gjy2p47s8t",
			"hidden": false,
			"id": "relation1597481275",
			"maxSelect": 1,
			"minSelect": 0,
			"name": "token",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "relation"
		}`)); err != nil {
			return err
		}

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("jwn6wr5k0kzlglc")
		if err != nil {
			return err
		}

		// add field
		if err := collection.Fields.AddMarshaledJSONAt(2, []byte(`{
			"cascadeDelete": false,
			"collectionId": "wez4w5u1ntn52c1",
			"hidden": false,
			"id": "lo27ux9m",
			"maxSelect": 1,
			"minSelect": 0,
			"name": "token",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "relation"
		}`)); err != nil {
			return err
		}

		// remove field
		collection.Fields.RemoveById("relation1597481275")

		return app.Save(collection)
	})
}

package query

import (
	"fmt"
	"reflect"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/shashank-sharma/backend/internal/models"
	"github.com/shashank-sharma/backend/internal/store"
	"github.com/shashank-sharma/backend/internal/util"
)

func BaseModelQuery[T models.Model](m T) *dbx.SelectQuery {
	return store.GetDao().ModelQuery(m)
}

func FindById[T models.Model](id string) (T, error) {
	var m T
	query := BaseModelQuery(m)
	err := query.
		AndWhere(dbx.HashExp{"id": id}).
		Limit(1).
		One(&m)

	if err != nil {
		var zeroValue T
		return zeroValue, err
	}

	return m, nil
}

func DeleteById[T models.Model](id string) error {
	record, err := FindById[T](id)
	if err != nil {
		return err
	}

	err = store.GetDao().Delete(record)
	if err != nil {
		return err
	}

	return nil
}

func FindByFilter[T models.Model](filterStruct map[string]interface{}) (T, error) {
	var m T
	query := BaseModelQuery(m)
	filter := structToHashExp(filterStruct)

	err := query.
		AndWhere(filter).
		Limit(1).
		One(&m)

	if err != nil {
		var zeroValue T
		return zeroValue, err
	}

	return m, nil
}

func RunInTransaction(fn func(txApp core.App) error) error {
	return store.GetDao().RunInTransaction(fn)
}

// copyModelToRecord copies fields from a model struct to a core.Record using reflection
func copyModelToRecord(model models.Model, record *core.Record) {
	v := reflect.ValueOf(model)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	t := v.Type()

	for i := 0; i < v.NumField(); i++ {
		field := t.Field(i)
		if field.Anonymous {
			continue // Skip embedded BaseModel
		}
		dbTag := field.Tag.Get("db")
		if dbTag == "" || dbTag == "id" {
			continue
		}
		record.Set(dbTag, v.Field(i).Interface())
	}
}

func SaveRecord(model models.Model) error {
	return SaveRecordWithApp(store.GetDao(), model)
}

func SaveRecordWithApp(app core.App, model models.Model) error {
	collection, err := app.FindCollectionByNameOrId(model.TableName())
	if err != nil {
		return fmt.Errorf("collection %s not found: %w", model.TableName(), err)
	}

	var record *core.Record
	if model.IsNew() {
		record = core.NewRecord(collection)
		if !model.HasId() {
			model.SetId(util.GenerateRandomId())
		}
		record.Id = model.GetId()
	} else {
		record, err = app.FindRecordById(collection, model.GetId())
		if err != nil {
			return fmt.Errorf("record not found: %w", err)
		}
	}

	copyModelToRecord(model, record)

	if err := app.Save(record); err != nil {
		return err
	}

	model.SetId(record.Id)
	model.MarkAsNotNew()
	return nil
}

func UpsertRecord[T models.Model](model T, filterStruct map[string]interface{}) error {
	record, err := FindByFilter[T](filterStruct)
	if err == nil {
		model.SetId(record.GetId())
		model.MarkAsNotNew()
		model.SetCreated(record.GetCreated())
	}

	if err := SaveRecord(model); err != nil {
		return err
	}
	return nil
}

func UpdateRecord[T models.Model](filterId string, updateStruct map[string]interface{}) error {
	var m T
	record, err := store.GetDao().FindRecordById(m.TableName(), filterId)
	if err != nil {
		return err
	}

	for key, value := range updateStruct {
		record.Set(key, value)
	}

	if err := store.GetDao().Save(record); err != nil {
		return err
	}
	return nil
}

func FindLatestByColumn[T models.Model](date_field string, filterStruct map[string]interface{}) (T, error) {
	var m T
	query := BaseModelQuery(m)
	filter := structToHashExp(filterStruct)

	err := query.
		AndWhere(filter).
		OrderBy(date_field + " DESC").
		Limit(1).
		One(&m)

	if err != nil {
		return *new(T), err
	}

	return m, nil
}

func FindAllByFilter[T models.Model](filterStruct map[string]interface{}) ([]T, error) {
	var results []T

	var m T
	query := BaseModelQuery(m)

	for field, value := range filterStruct {
		switch v := value.(type) {
		case map[string]interface{}:
			for op, actualVal := range v {
				if op == "gte" {
					paramName := field + "_gte"
					query = query.AndWhere(dbx.NewExp(field+" >= {:"+paramName+"}", dbx.Params{paramName: actualVal}))
				} else if op == "lte" {
					paramName := field + "_lte"
					query = query.AndWhere(dbx.NewExp(field+" <= {:"+paramName+"}", dbx.Params{paramName: actualVal}))
				}
			}
		default:
			query = query.AndWhere(dbx.HashExp{field: value})
		}
	}

	err := query.All(&results)
	if err != nil {
		return nil, err
	}

	return results, nil
}

func FindAllByFilterWithPagination[T models.Model](filterStruct map[string]interface{}, limit int, offset int) ([]T, error) {
	var results []T

	var m T
	query := BaseModelQuery(m)

	for field, value := range filterStruct {
		switch v := value.(type) {
		case map[string]interface{}:
			for op, actualVal := range v {
				if op == "gte" {
					paramName := field + "_gte"
					query = query.AndWhere(dbx.NewExp(field+" >= {:"+paramName+"}", dbx.Params{paramName: actualVal}))
				} else if op == "lte" {
					paramName := field + "_lte"
					query = query.AndWhere(dbx.NewExp(field+" <= {:"+paramName+"}", dbx.Params{paramName: actualVal}))
				}
			}
		default:
			query = query.AndWhere(dbx.HashExp{field: value})
		}
	}

	err := query.Limit(int64(limit)).Offset(int64(offset)).All(&results)
	if err != nil {
		return nil, err
	}

	return results, nil
}

func CountRecords[T models.Model](filterStruct map[string]interface{}) (int64, error) {
	var m T
	var total int64
	query := BaseModelQuery(m)
	filter := structToHashExp(filterStruct)

	q := query.
		AndWhere(filter).
		Select("count(*)")

	err := q.Row(&total)
	if err != nil {
		return 0, err
	}

	return total, nil
}

func BaseQuery[T models.Model]() *dbx.SelectQuery {
	var m T
	return BaseModelQuery(m)
}

func DeleteBatch[T models.Model](filter map[string]interface{}, batchSize int) (int64, error) {
	var m T
	tableName := m.TableName()

	var mock T
	query := BaseModelQuery(mock).Select("id").Limit(int64(batchSize))

	params := dbx.Params{}
	for field, value := range filter {
		switch v := value.(type) {
		case map[string]interface{}:
			for op, actualVal := range v {
				if op == "gte" {
					paramName := field + "_batch_gte"
					query = query.AndWhere(dbx.NewExp(field+" >= {:"+paramName+"}", dbx.Params{paramName: actualVal}))
					params[paramName] = actualVal
				} else if op == "lte" {
					paramName := field + "_batch_lte"
					query = query.AndWhere(dbx.NewExp(field+" <= {:"+paramName+"}", dbx.Params{paramName: actualVal}))
					params[paramName] = actualVal
				}
			}
		default:
			query = query.AndWhere(dbx.HashExp{field: value})
		}
	}

	subQuerySql := query.Build().SQL()
	subQueryParams := query.Build().Params()

	finalSql := fmt.Sprintf("DELETE FROM %s WHERE id IN (%s)", tableName, subQuerySql)
	res, err := store.GetDao().DB().NewQuery(finalSql).Bind(subQueryParams).Execute()
	if err != nil {
		return 0, err
	}

	return res.RowsAffected()
}

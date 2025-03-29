package query

import (
	"github.com/pocketbase/dbx"
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
	if err == nil {
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

func SaveRecord(model models.Model) error {
	if model.IsNew() {
		if !model.HasId() {
			model.SetId(util.GenerateRandomId())
		}
		model.RefreshCreated()
	}

	model.RefreshUpdated()

	if err := store.GetDao().Save(model); err != nil {
		return err
	}
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
					query = query.AndWhere(dbx.NewExp(field+" >= {:" + paramName + "}", dbx.Params{paramName: actualVal}))
				} else if op == "lte" {
					paramName := field + "_lte"
					query = query.AndWhere(dbx.NewExp(field+" <= {:" + paramName + "}", dbx.Params{paramName: actualVal}))
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
					query = query.AndWhere(dbx.NewExp(field+" >= {:" + paramName + "}", dbx.Params{paramName: actualVal}))
				} else if op == "lte" {
					paramName := field + "_lte"
					query = query.AndWhere(dbx.NewExp(field+" <= {:" + paramName + "}", dbx.Params{paramName: actualVal}))
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

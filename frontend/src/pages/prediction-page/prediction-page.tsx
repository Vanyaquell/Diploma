import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Header } from '../../components/header/header';
import {
  CITY_OPTIONS,
  formatUnknownOption,
  getCityOptions,
  getDistrictSelectOptions,
  getRoomOptions,
  getUndergroundSelectOptions,
} from '../../const';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { createPredictionAction, fetchPredictionLocationsAction } from '../../store/api-action';
import {
  addPredictionComparison,
  removePredictionComparison,
  setPredictionComparisons,
  setPredictionDraft,
} from '../../store/action';
import type { PredictionPayload } from '../../types/prediction';

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value))} руб.`;
}

function formatPricePerMeter(value: number): string {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value))} руб./м²`;
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return '—';
  }

  return `${(value * 100).toFixed(2)}%`;
}

function formatRoomsCount(value: number): string {
  if (value === 0) {
    return 'Студия';
  }

  if (value === 1) {
    return '1 комната';
  }

  return `${value} комнаты`;
}

function buildVariantTitle(index: number): string {
  return `Вариант ${index + 1}`;
}

function PredictionPage() {
  const dispatch = useAppDispatch();
  const form = useAppSelector((state) => state.predictionDraft);
  const predictionResult = useAppSelector((state) => state.predictionResult);
  const comparisonVariants = useAppSelector((state) => state.predictionComparisons);
  const predictionLocations = useAppSelector((state) => state.predictionLocations);
  const isPredictionLoading = useAppSelector((state) => state.isPredictionLoading);
  const [formError, setFormError] = useState<string | null>(null);

  const cityOptions = useMemo(
    () => getCityOptions(predictionLocations),
    [predictionLocations]
  );
  const districtOptions = useMemo(
    () => getDistrictSelectOptions(form.city, form.underground, predictionLocations),
    [form.city, form.underground, predictionLocations]
  );
  const undergroundOptions = useMemo(
    () => getUndergroundSelectOptions(form.city, form.district, predictionLocations),
    [form.city, form.district, predictionLocations]
  );
  const roomOptions = useMemo(
    () => getRoomOptions(predictionLocations),
    [predictionLocations]
  );

  const isCurrentVariantInComparison = useMemo(
    () => predictionResult
      ? comparisonVariants.some((variant) => variant.id === predictionResult.predictionId)
      : false,
    [comparisonVariants, predictionResult]
  );

  useEffect(() => {
    dispatch(fetchPredictionLocationsAction());
  }, [dispatch]);

  useEffect(() => {
    const fallbackCity = cityOptions[0] ?? CITY_OPTIONS[0];
    if (!fallbackCity) {
      return;
    }

    let nextForm = form;
    let hasChanges = false;

    if (!cityOptions.includes(nextForm.city)) {
      nextForm = {
        ...nextForm,
        city: fallbackCity,
        district: 'unknown',
        underground: 'unknown',
      };
      hasChanges = true;
    }

    const availableDistrictValues = getDistrictSelectOptions(
      nextForm.city,
      nextForm.underground,
      predictionLocations
    ).map((option) => option.value);

    if (!availableDistrictValues.includes(nextForm.district)) {
      nextForm = {
        ...nextForm,
        district: 'unknown',
      };
      hasChanges = true;
    }

    const availableUndergroundValues = getUndergroundSelectOptions(
      nextForm.city,
      nextForm.district,
      predictionLocations
    ).map((option) => option.value);

    if (!availableUndergroundValues.includes(nextForm.underground)) {
      nextForm = {
        ...nextForm,
        underground: 'unknown',
      };
      hasChanges = true;
    }

    const availableRoomValues = getRoomOptions(predictionLocations).map((option) => option.value);
    if (!availableRoomValues.includes(nextForm.rooms_count)) {
      nextForm = {
        ...nextForm,
        rooms_count: availableRoomValues[0] ?? 0,
      };
      hasChanges = true;
    }

    if (hasChanges) {
      dispatch(setPredictionDraft(nextForm));
    }
  }, [cityOptions, dispatch, form, predictionLocations]);

  const updateField = <K extends keyof PredictionPayload>(field: K, value: PredictionPayload[K]) => {
    setFormError(null);
    dispatch(setPredictionDraft({
      ...form,
      [field]: value,
    }));
  };

  const updateCity = (city: string) => {
    setFormError(null);
    dispatch(setPredictionDraft({
      ...form,
      city,
      district: 'unknown',
      underground: 'unknown',
    }));
  };

  const handleSubmit = (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();

    if (form.floor > form.floors_count) {
      setFormError('Этаж квартиры не может быть больше общего количества этажей в доме.');
      return;
    }

    dispatch(createPredictionAction({
      ...form,
      house_material_type: 'unknown',
      finish_type: 'unknown',
      object_type: 'flat',
    }));
  };

  const handleAddToComparison = () => {
    if (!predictionResult) {
      return;
    }

    dispatch(addPredictionComparison({
      id: predictionResult.predictionId,
      input: { ...predictionResult.input },
      predictedPrice: predictionResult.predictedPrice,
      currency: predictionResult.currency,
      modelName: predictionResult.modelName,
      modelVersion: predictionResult.modelVersion,
      pricePerSquareMeter: predictionResult.pricePerSquareMeter,
      estimatedPriceMin: predictionResult.estimatedPriceMin,
      estimatedPriceMax: predictionResult.estimatedPriceMax,
      confidenceMarginPercent: predictionResult.confidenceMarginPercent,
      createdAt: predictionResult.createdAt,
    }));
  };

  return (
    <div className="page">
      <Header />
      <main className="layout">
        <section className="hero-card">
          <p className="eyebrow">EstatePredict</p>
          <h1>Прогноз стоимости недвижимости</h1>
        </section>

        <section className="panel">
          <div className="section-heading">
            <p className="eyebrow">Параметры квартиры</p>
            <h2>Данные для расчёта</h2>
          </div>

          <form className="form grid-form" onSubmit={handleSubmit} autoComplete="off">
            <label>
              Укажите город
              <select
                name="prediction-city"
                value={form.city}
                onChange={(evt) => updateCity(evt.target.value)}
                autoComplete="off"
              >
                {cityOptions.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </label>

            <label>
              Укажите район
              <select
                name="prediction-district"
                value={form.district}
                onChange={(evt) => updateField('district', evt.target.value)}
                autoComplete="off"
              >
                {districtOptions.map((district) => (
                  <option key={district.value} value={district.value}>{district.label}</option>
                ))}
              </select>
            </label>

            <label>
              Укажите ближайшее метро
              <select
                name="prediction-underground"
                value={form.underground}
                onChange={(evt) => updateField('underground', evt.target.value)}
                autoComplete="off"
              >
                {undergroundOptions.map((underground) => (
                  <option key={underground.value} value={underground.value}>{underground.label}</option>
                ))}
              </select>
            </label>

            <label>
              Укажите общую площадь, м²
              <input
                type="number"
                name="prediction-total-meters"
                min={1}
                max={400}
                value={form.total_meters}
                onChange={(evt) => updateField('total_meters', Number(evt.target.value))}
                autoComplete="off"
                required
              />
            </label>

            <label>
              Укажите количество комнат
              <select
                name="prediction-rooms-count"
                value={form.rooms_count}
                onChange={(evt) => updateField('rooms_count', Number(evt.target.value))}
                autoComplete="off"
              >
                {roomOptions.map((room) => (
                  <option key={room.value} value={room.value}>{room.label}</option>
                ))}
              </select>
            </label>

            <label>
              Укажите этаж квартиры
              <input
                type="number"
                name="prediction-floor"
                min={1}
                max={100}
                value={form.floor}
                onChange={(evt) => updateField('floor', Number(evt.target.value))}
                autoComplete="off"
                required
              />
            </label>

            <label>
              Укажите количество этажей в доме
              <input
                type="number"
                name="prediction-floors-count"
                min={1}
                max={100}
                value={form.floors_count}
                onChange={(evt) => updateField('floors_count', Number(evt.target.value))}
                autoComplete="off"
                required
              />
            </label>

            {formError && <p className="form-error">{formError}</p>}

            <button className="button grid-form__submit" type="submit" disabled={isPredictionLoading}>
              {isPredictionLoading ? 'Считаем...' : 'Рассчитать стоимость'}
            </button>
          </form>
        </section>

        {predictionResult && (
          <section className="result-card result-card--expanded">
            <div className="result-card__header">
              <div>
                <p className="eyebrow">Результат прогноза</p>
                <strong>{formatMoney(predictionResult.predictedPrice)}</strong>
              </div>
              <button
                className={isCurrentVariantInComparison ? 'button button--ghost' : 'button'}
                type="button"
                onClick={handleAddToComparison}
                disabled={isCurrentVariantInComparison}
              >
                {isCurrentVariantInComparison ? 'Уже добавлено в сравнение' : 'Добавить в сравнение'}
              </button>
            </div>

            <div className="result-card__stats">
              <article className="result-stat">
                <span className="result-stat__label">Цена за м²</span>
                <strong>{formatPricePerMeter(predictionResult.pricePerSquareMeter)}</strong>
              </article>
              <article className="result-stat">
                <span className="result-stat__label">Диапазон оценки</span>
                <strong>
                  {formatMoney(predictionResult.estimatedPriceMin)} — {formatMoney(predictionResult.estimatedPriceMax)}
                </strong>
              </article>
              <article className="result-stat">
                <span className="result-stat__label">Ориентировочная погрешность</span>
                <strong>{formatPercent(predictionResult.confidenceMarginPercent)}</strong>
              </article>
            </div>
          </section>
        )}

        {comparisonVariants.length > 0 && (
          <section className="panel">
            <div className="panel-header">
              <div className="section-heading comparison-section__heading">
                <p className="eyebrow">Сравнение объектов</p>
                <h2>Сравнение вариантов</h2>
              </div>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => dispatch(setPredictionComparisons([]))}
              >
                Очистить сравнение
              </button>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Вариант</th>
                    <th>Город</th>
                    <th>Район</th>
                    <th>Площадь</th>
                    <th>Комнаты</th>
                    <th>Прогноз</th>
                    <th>Цена за м²</th>
                    <th>Диапазон</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonVariants.map((variant, index) => (
                    <tr key={variant.id}>
                      <td>{buildVariantTitle(index)}</td>
                      <td>{variant.input.city}</td>
                      <td>{formatUnknownOption(variant.input.district)}</td>
                      <td>{variant.input.total_meters} м²</td>
                      <td>{formatRoomsCount(variant.input.rooms_count)}</td>
                      <td>{formatMoney(variant.predictedPrice)}</td>
                      <td>{formatPricePerMeter(variant.pricePerSquareMeter)}</td>
                      <td>{formatMoney(variant.estimatedPriceMin)} — {formatMoney(variant.estimatedPriceMax)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="button button--danger"
                            type="button"
                            onClick={() => dispatch(removePredictionComparison(variant.id))}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export { PredictionPage };

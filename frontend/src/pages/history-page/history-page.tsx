import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import { Header } from '../../components/header/header';
import { CITY_OPTIONS, formatUnknownOption, getCityOptions } from '../../const';
import { useAppDispatch, useAppSelector } from '../../hooks';
import {
  clearPredictionHistoryAction,
  fetchPredictionLocationsAction,
  fetchPredictionHistoryAction,
  updatePredictionNoteAction,
} from '../../store/api-action';

type HistorySort = 'date_desc' | 'date_asc' | 'price_desc' | 'price_asc' | 'area_desc' | 'area_asc';

function formatRoomsCount(value: number): string {
  if (value === 0) {
    return 'Студия';
  }

  if (value === 1) {
    return '1 комната';
  }

  return `${value} комнаты`;
}

function HistoryPage() {
  const dispatch = useAppDispatch();
  const history = useAppSelector((state) => state.predictionHistory);
  const predictionLocations = useAppSelector((state) => state.predictionLocations);
  const isHistoryLoading = useAppSelector((state) => state.isHistoryLoading);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedPredictionId, setSelectedPredictionId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSavedMessage, setNoteSavedMessage] = useState<string | null>(null);
  const [historySort, setHistorySort] = useState<HistorySort>('date_desc');
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const previousHistoryCityOptionsRef = useRef<string[]>([]);

  const sortedHistory = useMemo(() => {
    const nextHistory = [...history];

    nextHistory.sort((left, right) => {
      switch (historySort) {
        case 'date_asc':
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        case 'price_desc':
          return right.predictedPrice - left.predictedPrice;
        case 'price_asc':
          return left.predictedPrice - right.predictedPrice;
        case 'area_desc':
          return right.input.total_meters - left.input.total_meters;
        case 'area_asc':
          return left.input.total_meters - right.input.total_meters;
        case 'date_desc':
        default:
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
    });

    return nextHistory;
  }, [history, historySort]);

  const filteredHistory = useMemo(
    () => sortedHistory.filter((item) => selectedCities.includes(item.input.city)),
    [selectedCities, sortedHistory]
  );

  const historyCityOptions = useMemo(() => {
    const dynamicCities = getCityOptions(predictionLocations);
    const historyCities = [...new Set(history.map((item) => item.input.city))];
    const sourceCities = predictionLocations?.cities.length
      ? [...new Set([...dynamicCities, ...historyCities])]
      : historyCities;

    return sourceCities.length > 0 ? sourceCities : [...CITY_OPTIONS];
  }, [history, predictionLocations]);

  const selectedPrediction = useMemo(
    () => history.find((item) => item.id === selectedPredictionId) ?? null,
    [history, selectedPredictionId]
  );

  const areAllCitiesSelected = historyCityOptions.length > 0 && selectedCities.length === historyCityOptions.length;

  useEffect(() => {
    dispatch(fetchPredictionHistoryAction());
    dispatch(fetchPredictionLocationsAction());
  }, [dispatch]);

  useEffect(() => {
    const previousHistoryCityOptions = previousHistoryCityOptionsRef.current;

    setSelectedCities((currentCities) => {
      if (historyCityOptions.length === 0) {
        return [];
      }

      if (currentCities.length === 0) {
        return [...historyCityOptions];
      }

      const hadAllPreviousCitiesSelected = previousHistoryCityOptions.length > 0
        && previousHistoryCityOptions.every((city) => currentCities.includes(city));

      if (hadAllPreviousCitiesSelected) {
        return [...historyCityOptions];
      }

      const nextCities = currentCities.filter((city) => historyCityOptions.includes(city));
      return nextCities.length > 0 ? nextCities : [...historyCityOptions];
    });

    previousHistoryCityOptionsRef.current = [...historyCityOptions];
  }, [historyCityOptions]);

  useEffect(() => {
    if (!selectedPrediction) {
      setNoteDraft('');
      setNoteSavedMessage(null);
      return;
    }

    setNoteDraft(selectedPrediction.note ?? '');
    setNoteSavedMessage(null);
  }, [selectedPrediction]);

  useEffect(() => {
    if (!isConfirmModalOpen) {
      return undefined;
    }

    const handleEscKey = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        setIsConfirmModalOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isConfirmModalOpen]);

  const handleOpenConfirmModal = () => {
    setIsConfirmModalOpen(true);
  };

  const handleCloseConfirmModal = () => {
    setIsConfirmModalOpen(false);
  };

  const handleClearHistory = () => {
    dispatch(clearPredictionHistoryAction());
    setIsConfirmModalOpen(false);
    setSelectedPredictionId(null);
  };

  const handleSelectPrediction = (predictionId: string) => {
    setSelectedPredictionId(predictionId);
    setNoteSavedMessage(null);
  };

  const handleCloseDetails = () => {
    setSelectedPredictionId(null);
    setNoteSavedMessage(null);
  };

  const handleHistoryRowKeyDown = (evt: ReactKeyboardEvent<HTMLTableRowElement>, predictionId: string) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      handleSelectPrediction(predictionId);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedPrediction) {
      return;
    }

    try {
      await dispatch(updatePredictionNoteAction({
        predictionId: selectedPrediction.id,
        note: noteDraft,
      })).unwrap();
      setNoteSavedMessage('Заметка сохранена.');
    } catch {
      setNoteSavedMessage(null);
    }
  };

  const handleToggleAllCities = () => {
    setSelectedCities(areAllCitiesSelected ? [] : [...historyCityOptions]);
  };

  const handleToggleCity = (city: string) => {
    setSelectedCities((currentCities) => (
      currentCities.includes(city)
        ? currentCities.filter((item) => item !== city)
        : [...currentCities, city]
    ));
  };

  const isNoteChanged = (selectedPrediction?.note ?? '') !== noteDraft;

  return (
    <div className="page">
      <Header />
      <main className="layout">
        <section className="panel">
          <p className="eyebrow">Сохранённые запросы</p>
          <div className="panel-header">
            <h1>История прогнозов</h1>
            {history.length > 0 && (
              <div className="history-toolbar">
                <label className="history-sort">
                  <span>Сортировка</span>
                  <select
                    className="table-select history-sort__select"
                    value={historySort}
                    onChange={(evt) => setHistorySort(evt.target.value as HistorySort)}
                  >
                    <option value="date_desc">Сначала новые</option>
                    <option value="date_asc">Сначала старые</option>
                    <option value="price_desc">Цена: по убыванию</option>
                    <option value="price_asc">Цена: по возрастанию</option>
                    <option value="area_desc">Площадь: по убыванию</option>
                    <option value="area_asc">Площадь: по возрастанию</option>
                  </select>
                </label>
                <button
                  className="button button--danger"
                  type="button"
                  onClick={handleOpenConfirmModal}
                  disabled={isHistoryLoading}
                >
                  Очистить историю
                </button>
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="history-city-filters">
              <span className="history-city-filters__label">Города</span>
              <label className="history-city-filter">
                <input
                  type="checkbox"
                  checked={areAllCitiesSelected}
                  onChange={handleToggleAllCities}
                />
                <span>Все города</span>
              </label>
              {historyCityOptions.map((city) => (
                <label key={city} className="history-city-filter">
                  <input
                    type="checkbox"
                    checked={selectedCities.includes(city)}
                    onChange={() => handleToggleCity(city)}
                  />
                  <span>{city}</span>
                </label>
              ))}
            </div>
          )}

          {isHistoryLoading ? (
            <p>Загружаем историю...</p>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <p>Прогнозов пока нет.</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="empty-state">
              <p>По выбранным городам записей нет.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Город</th>
                    <th>Площадь</th>
                    <th>Комнаты</th>
                    <th>Прогноз</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item) => (
                    <tr
                      key={item.id}
                      className={selectedPredictionId === item.id ? 'history-row history-row--active' : 'history-row'}
                      tabIndex={0}
                      onClick={() => handleSelectPrediction(item.id)}
                      onKeyDown={(evt) => handleHistoryRowKeyDown(evt, item.id)}
                    >
                      <td>{new Date(item.createdAt).toLocaleString('ru-RU')}</td>
                      <td>{item.input.city}</td>
                      <td>{item.input.total_meters} м²</td>
                      <td>{item.input.rooms_count}</td>
                      <td>{new Intl.NumberFormat('ru-RU').format(Math.round(item.predictedPrice))} руб.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedPrediction && (
            <section className="history-details">
              <div className="panel-header">
                <div className="section-heading history-details__heading">
                  <p className="eyebrow">Детали выбранной записи</p>
                  <h2>Параметры прогноза</h2>
                  <p>
                    Здесь отображаются все параметры, которые были выбраны пользователем при расчёте
                    стоимости квартиры.
                  </p>
                </div>
                <button className="button button--ghost" type="button" onClick={handleCloseDetails}>
                  Скрыть
                </button>
              </div>

              <div className="history-details__summary">
                <strong>{new Intl.NumberFormat('ru-RU').format(Math.round(selectedPrediction.predictedPrice))} руб.</strong>
                <span>{new Date(selectedPrediction.createdAt).toLocaleString('ru-RU')}</span>
              </div>

              <div className="form grid-form">
                <label>
                  Город
                  <input value={selectedPrediction.input.city} readOnly />
                </label>
                <label>
                  Район
                  <input value={formatUnknownOption(selectedPrediction.input.district)} readOnly />
                </label>
                <label>
                  Ближайшее метро
                  <input value={formatUnknownOption(selectedPrediction.input.underground)} readOnly />
                </label>
                <label>
                  Общая площадь, м²
                  <input value={String(selectedPrediction.input.total_meters)} readOnly />
                </label>
                <label>
                  Количество комнат
                  <input value={formatRoomsCount(selectedPrediction.input.rooms_count)} readOnly />
                </label>
                <label>
                  Этаж квартиры
                  <input value={String(selectedPrediction.input.floor)} readOnly />
                </label>
                <label>
                  Количество этажей в доме
                  <input value={String(selectedPrediction.input.floors_count)} readOnly />
                </label>
              </div>

              <label className="history-note">
                Заметка к записи
                <textarea
                  value={noteDraft}
                  onChange={(evt) => {
                    setNoteDraft(evt.target.value);
                    setNoteSavedMessage(null);
                  }}
                  maxLength={500}
                  placeholder="Добавьте комментарий или описание для этой записи..."
                  rows={4}
                  disabled={isHistoryLoading}
                />
              </label>

              <div className="history-details__actions">
                <button
                  className={isHistoryLoading ? 'button button--loading' : 'button'}
                  type="button"
                  onClick={handleSaveNote}
                  disabled={!isNoteChanged || isHistoryLoading}
                >
                  {isHistoryLoading ? 'Сохраняем...' : 'Сохранить заметку'}
                </button>
                {noteSavedMessage && <span className="history-details__status">{noteSavedMessage}</span>}
              </div>
            </section>
          )}
        </section>
      </main>

      {isConfirmModalOpen && (
        <div className="modal-overlay" onMouseDown={handleCloseConfirmModal}>
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-history-title"
            onMouseDown={(evt) => evt.stopPropagation()}
          >
            <p className="eyebrow">Подтверждение действия</p>
            <h2 id="clear-history-title">Очистить историю прогнозов?</h2>
            <p>
              Все сохранённые запросы и результаты прогнозов будут удалены из вашей истории.
              Это действие нельзя отменить.
            </p>
            <div className="confirm-modal__actions">
              <button
                className="button button--ghost"
                type="button"
                onClick={handleCloseConfirmModal}
                disabled={isHistoryLoading}
              >
                Отмена
              </button>
              <button
                className={isHistoryLoading ? 'button button--danger button--loading' : 'button button--danger'}
                type="button"
                onClick={handleClearHistory}
                disabled={isHistoryLoading}
              >
                {isHistoryLoading ? 'Очищаем...' : 'Очистить историю'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export { HistoryPage };

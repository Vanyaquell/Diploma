import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { APIRoute } from '../../const';
import { Header } from '../../components/header/header';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { createAPI } from '../../services/api';
import { clearErrorAction, fetchAdminUsersAction, updateAdminUserAction } from '../../store/api-action';
import { setError } from '../../store/action';
import type { AdminMlDashboard, DatasetVersion, ModelApplication, ModelMetrics, TrainingJob } from '../../types/admin-ml';
import type { UserRole, UserStatus } from '../../types/user';

type UserDraft = {
  role: UserRole;
  status: UserStatus;
};

type AdminSection = 'users' | 'model' | 'datasets' | 'training';

type PendingDeletion = {
  kind: 'dataset' | 'training' | 'model-applications';
  id: string;
  title: string;
  description: string;
};

const adminApi = createAPI();
const ADMIN_SECTION_STORAGE_KEY = 'admin-active-section';
const ADMIN_SECTIONS: AdminSection[] = ['users', 'model', 'datasets', 'training'];

const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Пользователь',
  admin: 'Администратор',
};

const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Активен',
  blocked: 'Заблокирован',
};

const ADMIN_SECTION_LABELS: Record<AdminSection, string> = {
  users: 'Пользователи',
  model: 'Модель',
  datasets: 'Датасет',
  training: 'Переобучение',
};

const DATASET_STATUS_LABELS: Record<string, string> = {
  active: 'Активный',
  ready: 'Готов',
};

const TRAINING_STATUS_LABELS: Record<string, string> = {
  queued: 'В очереди',
  running: 'Выполняется',
  ready: 'Готова к применению',
  applying: 'Применяется',
  applied: 'Применена',
  failed: 'Ошибка',
};

const TRAINING_STAGE_LABELS: Record<string, string> = {
  queued: 'Ожидание',
  validating_dataset: 'Проверка датасета',
  preparing_features: 'Подготовка признаков',
  training_model: 'Обучение модели',
  reloading_model: 'Перезагрузка модели',
  completed: 'Завершено',
  failed: 'Ошибка',
};

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const maybeResponse = error as { response?: { data?: { message?: string } } };
    return maybeResponse.response?.data?.message ?? 'Запрос не выполнен.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Запрос не выполнен.';
}

function formatMetricValue(value: number | null | undefined, kind: 'money' | 'ratio' | 'percent'): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (kind === 'money') {
    return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value))} руб.`;
  }

  if (kind === 'percent') {
    return `${(value * 100).toFixed(2)}%`;
  }

  return value.toFixed(4);
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString('ru-RU');
}

function getDatasetStatusLabel(status: string): string {
  return DATASET_STATUS_LABELS[status] ?? status;
}

function getTrainingStatusLabel(status: string, isActiveModel = false): string {
  if (isActiveModel) {
    return 'Активная';
  }

   if (status === 'applied') {
    return 'Готова к применению';
  }

  return TRAINING_STATUS_LABELS[status] ?? status;
}

function getTrainingStageLabel(stage: string): string {
  return TRAINING_STAGE_LABELS[stage] ?? stage;
}

function getSelectedMetrics(job: TrainingJob): ModelMetrics | null {
  if (!job.metrics || !job.modelName) {
    return null;
  }

  return job.metrics[job.modelName] ?? null;
}

function buildDownloadUrl(datasetVersionId: string): string {
  return APIRoute.AdminUsers.replace('/users', `/datasets/${datasetVersionId}/download`);
}

function buildDatasetDeleteUrl(datasetVersionId: string): string {
  return APIRoute.AdminUsers.replace('/users', `/datasets/${datasetVersionId}`);
}

function buildTrainingDeleteUrl(trainingJobId: string): string {
  return `${APIRoute.AdminTrainingJobs}/${trainingJobId}`;
}

function getInitialAdminSection(): AdminSection {
  if (typeof window === 'undefined') {
    return 'users';
  }

  const savedSection = window.localStorage.getItem(ADMIN_SECTION_STORAGE_KEY);
  return ADMIN_SECTIONS.includes(savedSection as AdminSection) ? (savedSection as AdminSection) : 'users';
}

function extractDownloadFileName(contentDisposition: string | undefined): string | null {
  if (!contentDisposition) {
    return null;
  }

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }

  const basicMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return basicMatch?.[1] ?? null;
}

function AdminPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user);
  const users = useAppSelector((state) => state.users);
  const isAdminLoading = useAppSelector((state) => state.isAdminLoading);

  const [activeSection, setActiveSection] = useState<AdminSection>(getInitialAdminSection);
  const [userDrafts, setUserDrafts] = useState<Record<string, UserDraft>>({});
  const [dashboard, setDashboard] = useState<AdminMlDashboard | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [isMlActionLoading, setIsMlActionLoading] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);
  const [emailFilter, setEmailFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shouldResetDatasetSelectionRef = useRef(false);
  const shouldResetTrainingSelectionRef = useRef(false);

  const showRequestError = (error: unknown) => {
    dispatch(setError(extractErrorMessage(error)));
    dispatch(clearErrorAction());
  };

  const fetchDashboard = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (user?.role !== 'admin') {
      return;
    }

    try {
      if (!silent) {
        setIsDashboardLoading(true);
      }

      const { data } = await adminApi.get<AdminMlDashboard>(APIRoute.AdminMlDashboard);
      setDashboard(data);
    } catch (error) {
      showRequestError(error);
    } finally {
      if (!silent) {
        setIsDashboardLoading(false);
      }
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      dispatch(fetchAdminUsersAction());
      void fetchDashboard();
    }
  }, [dispatch, user?.role]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ADMIN_SECTION_STORAGE_KEY, activeSection);
    }
  }, [activeSection]);

  useEffect(() => {
    if (user?.role !== 'admin') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void fetchDashboard({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user?.role]);

  useEffect(() => {
    const nextDrafts = users.reduce<Record<string, UserDraft>>((accumulator, item) => {
      accumulator[item.id] = {
        role: item.role,
        status: item.status,
      };
      return accumulator;
    }, {});

    setUserDrafts(nextDrafts);
  }, [users]);

  useEffect(() => {
    if (activeSection === 'datasets') {
      shouldResetDatasetSelectionRef.current = true;
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'datasets') {
      return;
    }

    if (!dashboard) {
      setSelectedDatasetId(null);
      return;
    }

    const activeDataset = dashboard.datasetVersions.find((dataset) => dataset.isActive);
    const fallbackDatasetId = activeDataset?.id ?? dashboard.datasetVersions[0]?.id ?? null;

    if (shouldResetDatasetSelectionRef.current) {
      setSelectedDatasetId(fallbackDatasetId);
      shouldResetDatasetSelectionRef.current = false;
      return;
    }

    const hasSelectedDataset = dashboard.datasetVersions.some((dataset) => dataset.id === selectedDatasetId);
    if (!hasSelectedDataset) {
      setSelectedDatasetId(fallbackDatasetId);
    }
  }, [activeSection, dashboard, selectedDatasetId]);

  useEffect(() => {
    if (activeSection === 'training') {
      shouldResetTrainingSelectionRef.current = true;
    }
  }, [activeSection]);

  const selectedDataset = useMemo(
    () => dashboard?.datasetVersions.find((dataset) => dataset.id === selectedDatasetId) ?? null,
    [dashboard, selectedDatasetId]
  );

  const availableModels: TrainingJob[] = dashboard?.availableModels ?? [];
  const modelApplications: ModelApplication[] = dashboard?.modelApplications ?? [];

  const expandedJob = useMemo(
    () => availableModels.find((job) => job.id === expandedJobId) ?? null,
    [availableModels, expandedJobId]
  );

  const modelOverview = dashboard?.modelOverview ?? null;
  const activeModelVersion = modelOverview?.modelVersion ?? null;

  const isActiveTrainingJob = (job: TrainingJob): boolean =>
    Boolean(activeModelVersion && job.modelVersion && job.modelVersion === activeModelVersion);

  useEffect(() => {
    if (activeSection !== 'training' || !dashboard) {
      return;
    }

    const activeTrainingJob = availableModels.find((job) => isActiveTrainingJob(job));
    const fallbackTrainingJobId = activeTrainingJob?.id ?? availableModels[0]?.id ?? null;

    if (shouldResetTrainingSelectionRef.current) {
      setExpandedJobId(fallbackTrainingJobId);
      shouldResetTrainingSelectionRef.current = false;
      return;
    }

    const hasSelectedTrainingJob = availableModels.some((job) => job.id === expandedJobId);
    if (!hasSelectedTrainingJob) {
      setExpandedJobId(fallbackTrainingJobId);
    }
  }, [activeSection, dashboard, expandedJobId, activeModelVersion, availableModels]);

  const filteredUsers = useMemo(() => {
    const normalizedEmailFilter = emailFilter.trim().toLowerCase();
    const normalizedNameFilter = nameFilter.trim().toLowerCase();

    return users.filter((item) => {
      const matchesEmail = normalizedEmailFilter === ''
        || item.email.toLowerCase().includes(normalizedEmailFilter);
      const matchesName = normalizedNameFilter === ''
        || item.fullName.toLowerCase().includes(normalizedNameFilter);
      const matchesRole = roleFilter === 'all' || item.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

      return matchesEmail && matchesName && matchesRole && matchesStatus;
    });
  }, [emailFilter, nameFilter, roleFilter, statusFilter, users]);

  const activeBackgroundTrainingJob = useMemo(
    () => dashboard?.trainingJobs.find((job) => ['queued', 'running', 'applying'].includes(job.status)) ?? null,
    [dashboard]
  );

  const updateDraft = (userId: string, field: keyof UserDraft, value: UserRole | UserStatus) => {
    setUserDrafts((currentDrafts) => ({
      ...currentDrafts,
      [userId]: {
        ...(currentDrafts[userId] ?? { role: 'user', status: 'active' }),
        [field]: value,
      },
    }));
  };

  const handleSaveUser = (userId: string) => {
    const currentDraft = userDrafts[userId];
    if (!currentDraft) {
      return;
    }

    dispatch(updateAdminUserAction({
      userId,
      role: currentDraft.role,
      status: currentDraft.status,
    }));
  };

  const handleFileChange = (evt: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(evt.target.files?.[0] ?? null);
  };

  const handleUploadDataset = async () => {
    if (!selectedFile) {
      return;
    }

    const formData = new FormData();
    formData.append('dataset', selectedFile);

    try {
      setIsMlActionLoading(true);
      await adminApi.post(APIRoute.AdminDatasetsUpload, formData);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await fetchDashboard();
    } catch (error) {
      showRequestError(error);
    } finally {
      setIsMlActionLoading(false);
    }
  };

  const handleStartTraining = async () => {
    if (!selectedDatasetId) {
      return;
    }

    try {
      setIsMlActionLoading(true);
      await adminApi.post(APIRoute.AdminTrainingJobs, {
        datasetVersionId: selectedDatasetId,
      });
      await fetchDashboard();
      setActiveSection('training');
    } catch (error) {
      showRequestError(error);
    } finally {
      setIsMlActionLoading(false);
    }
  };

  const handleApplyTrainingJob = async (trainingJobId: string) => {
    try {
      setIsMlActionLoading(true);
      await adminApi.post(`${APIRoute.AdminTrainingJobs}/${trainingJobId}/apply`);
      await fetchDashboard();
      setActiveSection('model');
    } catch (error) {
      showRequestError(error);
    } finally {
      setIsMlActionLoading(false);
    }
  };

  const handleDownloadDataset = async (datasetVersion: DatasetVersion) => {
    try {
      setIsMlActionLoading(true);
      const response = await adminApi.get(buildDownloadUrl(datasetVersion.id), {
        responseType: 'blob',
      });
      const responseFileName = extractDownloadFileName(response.headers['content-disposition']);
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = responseFileName ?? datasetVersion.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      showRequestError(error);
    } finally {
      setIsMlActionLoading(false);
    }
  };

  const openDatasetDeletion = (datasetVersion: DatasetVersion) => {
    setPendingDeletion({
      kind: 'dataset',
      id: datasetVersion.id,
      title: 'Удалить версию датасета?',
      description: datasetVersion.sourceType === 'system'
        ? 'Системный датасет удалить нельзя. Он нужен как базовая версия, к которой всегда можно вернуться.'
        : datasetVersion.isActive
          ? 'Активную версию датасета удалить нельзя.'
        : `Будет удалена версия ${datasetVersion.fileName} и связанные с ней записи переобучения.`,
    });
  };

  const openTrainingDeletion = (job: TrainingJob) => {
    const isActiveModelJob = isActiveTrainingJob(job);
    setPendingDeletion({
      kind: 'training',
      id: job.id,
      title: 'Удалить сохранённую модель?',
      description: isActiveModelJob
        ? 'Активную модель удалить нельзя.'
        : `Будут удалены запись модели для датасета ${job.datasetFileName} и все связанные файлы этой версии модели на диске. После этого повторно применить её будет нельзя.`,
    });
  };

  const openModelApplicationsClear = () => {
    setPendingDeletion({
      kind: 'model-applications',
      id: 'all',
      title: 'Очистить историю применений моделей?',
      description: 'Будет очищен только журнал применений моделей. Сами сохранённые модели и их файлы останутся в системе.',
    });
  };

  const handleConfirmDeletion = async () => {
    if (!pendingDeletion) {
      return;
    }

    try {
      setIsMlActionLoading(true);

      if (pendingDeletion.kind === 'dataset') {
        await adminApi.delete(buildDatasetDeleteUrl(pendingDeletion.id));
        setSelectedDatasetId((currentId) => currentId === pendingDeletion.id ? null : currentId);
      } else if (pendingDeletion.kind === 'training') {
        await adminApi.delete(buildTrainingDeleteUrl(pendingDeletion.id));
        setExpandedJobId((currentId) => currentId === pendingDeletion.id ? null : currentId);
      } else {
        await adminApi.delete(APIRoute.AdminModelApplications);
      }

      setPendingDeletion(null);
      await fetchDashboard();
    } catch (error) {
      showRequestError(error);
    } finally {
      setIsMlActionLoading(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="page">
        <Header />
        <main className="layout">
          <section className="panel">
            <p className="eyebrow">Панель администратора</p>
            <h1>Доступ ограничен</h1>
            <p>Для просмотра этой страницы нужны права администратора.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <Header />
      <main className="layout">
        <section className="panel">
          <p className="eyebrow">Панель администратора</p>
          <div className="panel-header">
            <div className="section-heading admin-page__heading">
              <h1>Управление системой</h1>
            </div>
          </div>

          <div className="admin-tabs">
            {(Object.keys(ADMIN_SECTION_LABELS) as AdminSection[]).map((section) => (
              <button
                key={section}
                className={activeSection === section ? 'admin-tab admin-tab--active' : 'admin-tab'}
                type="button"
                onClick={() => setActiveSection(section)}
              >
                {ADMIN_SECTION_LABELS[section]}
              </button>
            ))}
          </div>

          {activeSection === 'users' && (
            isAdminLoading ? (
              <p>Загружаем пользователей...</p>
            ) : (
              <>
                <div className="admin-user-filters">
                  <label>
                    Поиск по email
                    <input
                      type="text"
                      value={emailFilter}
                      onChange={(evt) => setEmailFilter(evt.target.value)}
                      placeholder="Введите email..."
                    />
                  </label>
                  <label>
                    Поиск по имени
                    <input
                      type="text"
                      value={nameFilter}
                      onChange={(evt) => setNameFilter(evt.target.value)}
                      placeholder="Введите имя..."
                    />
                  </label>
                  <label>
                    Роль
                    <select value={roleFilter} onChange={(evt) => setRoleFilter(evt.target.value as UserRole | 'all')}>
                      <option value="all">Все роли</option>
                      <option value="user">{ROLE_LABELS.user}</option>
                      <option value="admin">{ROLE_LABELS.admin}</option>
                    </select>
                  </label>
                  <label>
                    Статус
                    <select value={statusFilter} onChange={(evt) => setStatusFilter(evt.target.value as UserStatus | 'all')}>
                      <option value="all">Все статусы</option>
                      <option value="active">{STATUS_LABELS.active}</option>
                      <option value="blocked">{STATUS_LABELS.blocked}</option>
                    </select>
                  </label>
                </div>
                <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Имя</th>
                      <th>Роль</th>
                      <th>Статус</th>
                      <th>Управление</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((item) => {
                      const currentDraft = userDrafts[item.id] ?? {
                        role: item.role,
                        status: item.status,
                      };
                      const isProtectedSystemAdmin = item.isSystemAdmin === true;
                      const hasChanges = !isProtectedSystemAdmin
                        && (currentDraft.role !== item.role || currentDraft.status !== item.status);

                      return (
                        <tr key={item.id}>
                          <td>{item.email}</td>
                          <td>{item.fullName}</td>
                          <td>
                            <select
                              className="table-select"
                              value={currentDraft.role}
                              onChange={(evt) => updateDraft(item.id, 'role', evt.target.value as UserRole)}
                              disabled={isAdminLoading || isProtectedSystemAdmin}
                            >
                              <option value="user">{ROLE_LABELS.user}</option>
                              <option value="admin">{ROLE_LABELS.admin}</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className="table-select"
                              value={currentDraft.status}
                              onChange={(evt) => updateDraft(item.id, 'status', evt.target.value as UserStatus)}
                              disabled={isAdminLoading || isProtectedSystemAdmin}
                            >
                              <option value="active">{STATUS_LABELS.active}</option>
                              <option value="blocked">{STATUS_LABELS.blocked}</option>
                            </select>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                className={
                                  isProtectedSystemAdmin
                                    ? 'button button--ghost'
                                    : isAdminLoading
                                      ? `button ${hasChanges ? 'button--attention ' : 'button--ghost '}button--loading`
                                      : hasChanges
                                        ? 'button button--attention'
                                        : 'button button--ghost'
                                }
                                type="button"
                                onClick={() => handleSaveUser(item.id)}
                                disabled={!hasChanges || isAdminLoading || isProtectedSystemAdmin}
                              >
                                {isAdminLoading ? 'Сохраняем...' : 'Сохранить'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                {filteredUsers.length === 0 && (
                  <div className="empty-state">
                    <p>Пользователи по заданным фильтрам не найдены.</p>
                  </div>
                )}
              </>
            )
          )}

          {activeSection === 'model' && (
            <div className="admin-section-grid">
              {modelOverview ? (
                <>
                  <div className="admin-cards">
                    <article className="admin-card">
                      <span className="admin-card__label">Активная модель</span>
                      <strong>{modelOverview.selectedModel}</strong>
                    </article>
                    <article className="admin-card">
                      <span className="admin-card__label">Версия модели</span>
                      <strong>{modelOverview.modelVersion}</strong>
                    </article>
                    <article className="admin-card">
                      <span className="admin-card__label">Активный датасет</span>
                      <span className="admin-card__filename">{modelOverview.activeDatasetName ?? '—'}</span>
                    </article>
                    <article className="admin-card">
                      <span className="admin-card__label">Количество записей</span>
                      <strong>{modelOverview.activeDatasetRows ?? '—'}</strong>
                    </article>
                  </div>

                  <div className="admin-info-grid">
                    <article className="admin-info-card">
                      <h2>Состояние сервиса</h2>
                      <div className="admin-status-list">
                        <span className={modelOverview.isServiceHealthy ? 'status-badge status-badge--success' : 'status-badge status-badge--error'}>
                          {modelOverview.isServiceHealthy ? 'ML-service доступен' : 'ML-service недоступен'}
                        </span>
                        <span className={modelOverview.isModelLoaded ? 'status-badge status-badge--success' : 'status-badge status-badge--warning'}>
                          {modelOverview.isModelLoaded ? 'Модель загружена' : 'Модель не загружена'}
                        </span>
                      </div>
                      <p><strong>Дата последнего обучения:</strong> {formatDate(modelOverview.trainedAt)}</p>
                      <p>
                        <strong>Путь к модели:</strong>{' '}
                        <span className="admin-info-card__path">{modelOverview.modelPath}</span>
                      </p>
                    </article>

                    <article className="admin-info-card">
                      <h2>Признаки модели</h2>
                      <p><strong>Числовые:</strong> {modelOverview.activeNumericFeatures.join(', ') || '—'}</p>
                      <p><strong>Категориальные:</strong> {modelOverview.activeCategoricalFeatures.join(', ') || '—'}</p>
                    </article>
                  </div>

                  <div className="admin-cards">
                    <article className="admin-card">
                      <span className="admin-card__label">R2</span>
                      <strong>{formatMetricValue(modelOverview.selectedModelMetrics?.r2, 'ratio')}</strong>
                    </article>
                    <article className="admin-card">
                      <span className="admin-card__label">MAE</span>
                      <strong>{formatMetricValue(modelOverview.selectedModelMetrics?.mae, 'money')}</strong>
                    </article>
                    <article className="admin-card">
                      <span className="admin-card__label">MAPE</span>
                      <strong>{formatMetricValue(modelOverview.selectedModelMetrics?.mape, 'percent')}</strong>
                    </article>
                    <article className="admin-card">
                      <span className="admin-card__label">RMSE</span>
                      <strong>{formatMetricValue(modelOverview.selectedModelMetrics?.rmse, 'money')}</strong>
                    </article>
                  </div>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Модель</th>
                          <th>R2</th>
                          <th>MAE</th>
                          <th>MAPE</th>
                          <th>RMSE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(modelOverview.allMetrics).map(([modelName, metrics]) => (
                          <tr key={modelName}>
                            <td>{modelName}</td>
                            <td>{formatMetricValue(metrics.r2, 'ratio')}</td>
                            <td>{formatMetricValue(metrics.mae, 'money')}</td>
                            <td>{formatMetricValue(metrics.mape, 'percent')}</td>
                            <td>{formatMetricValue(metrics.rmse, 'money')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p>Данные о модели пока недоступны.</p>
              )}
            </div>
          )}

          {activeSection === 'datasets' && (
            <div className="admin-section-grid">
              <section className="admin-upload-card">
                <h2>Загрузка новой версии датасета</h2>
                <div className="admin-upload-row">
                  <label className="button button--ghost admin-upload-row__picker" htmlFor="dataset-upload-input">
                    Выберите файл
                  </label>
                  <input
                    ref={fileInputRef}
                    className="admin-upload-row__input"
                    id="dataset-upload-input"
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={handleFileChange}
                  />
                  <span className="admin-upload-row__filename">
                    {selectedFile ? selectedFile.name : 'Файл не выбран'}
                  </span>
                  <button
                    className={isMlActionLoading ? 'button button--loading' : 'button'}
                    type="button"
                    onClick={() => {
                      void handleUploadDataset();
                    }}
                    disabled={!selectedFile || isMlActionLoading}
                  >
                    {isMlActionLoading ? 'Загружаем...' : 'Загрузить файл'}
                  </button>
                </div>
              </section>

              <div className="table-wrapper table-wrapper--datasets">
                <table className="dataset-versions-table">
                  <thead>
                    <tr>
                      <th>Файл</th>
                      <th>Источник</th>
                      <th>Статус</th>
                      <th>Строк</th>
                      <th>Дата</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard?.datasetVersions.map((datasetVersion) => (
                      <tr
                        key={datasetVersion.id}
                        className={selectedDatasetId === datasetVersion.id ? 'history-row history-row--active' : 'history-row'}
                        onClick={() => setSelectedDatasetId(datasetVersion.id)}
                      >
                        <td className="dataset-versions-table__filename">{datasetVersion.fileName}</td>
                        <td>{datasetVersion.sourceType === 'system' ? 'Системный' : 'Загружен администратором'}</td>
                        <td>
                          <span className={datasetVersion.isActive ? 'status-badge status-badge--success' : 'status-badge status-badge--neutral'}>
                            {getDatasetStatusLabel(datasetVersion.status)}
                          </span>
                        </td>
                        <td>{datasetVersion.rowsCount}</td>
                        <td>{formatDate(datasetVersion.createdAt)}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="button button--ghost"
                              type="button"
                              onClick={(evt) => {
                                evt.stopPropagation();
                                void handleDownloadDataset(datasetVersion);
                              }}
                              disabled={isMlActionLoading}
                            >
                              Скачать
                            </button>
                              <button
                                className="button button--danger"
                                type="button"
                                onClick={(evt) => {
                                  evt.stopPropagation();
                                  openDatasetDeletion(datasetVersion);
                                }}
                                disabled={isMlActionLoading || datasetVersion.isActive || datasetVersion.sourceType === 'system'}
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

              {selectedDataset && (
                <div className="admin-info-grid">
                  <article className="admin-info-card">
                    <div className="panel-header">
                      <div>
                        <h2>Сводка по версии</h2>
                        <p>{selectedDataset.fileName}</p>
                      </div>
                      <button
                        className={isMlActionLoading ? 'button button--loading' : 'button'}
                        type="button"
                        onClick={() => {
                          void handleStartTraining();
                        }}
                        disabled={isMlActionLoading}
                      >
                        {isMlActionLoading ? 'Запускаем...' : 'Отправить на переобучение'}
                      </button>
                    </div>
                    <p><strong>Колонки:</strong> {selectedDataset.columns.join(', ')}</p>
                    <p><strong>Города:</strong> {Object.entries(selectedDataset.cityDistribution).map(([city, count]) => `${city}: ${count}`).join(', ') || '—'}</p>
                    <p><strong>Комнаты:</strong> {Object.entries(selectedDataset.roomDistribution).map(([room, count]) => `${room}: ${count}`).join(', ') || '—'}</p>
                  </article>

                  <article className="admin-info-card">
                    <h2>Предпросмотр</h2>
                    {selectedDataset.preview.length > 0 ? (
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              {Object.keys(selectedDataset.preview[0]).map((columnName) => (
                                <th key={columnName}>{columnName}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedDataset.preview.map((row, rowIndex) => (
                              <tr key={`${selectedDataset.id}-${rowIndex}`}>
                                {Object.entries(row).map(([columnName, value]) => (
                                  <td key={`${columnName}-${rowIndex}`}>{value}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p>Предпросмотр пока недоступен.</p>
                    )}
                  </article>
                </div>
              )}
            </div>
          )}

          {activeSection === 'training' && (
            <div className="admin-section-grid">
              <section className="admin-info-card">
                <h2>Сохранённые модели</h2>
                <p>
                  {activeBackgroundTrainingJob
                    ? `Сейчас выполняется задача для датасета ${activeBackgroundTrainingJob.datasetFileName}: ${getTrainingStageLabel(activeBackgroundTrainingJob.stage)}.`
                    : 'Здесь отображаются все сохранённые версии моделей, доступные для повторного применения.'}
                </p>
              </section>

              <div className="table-wrapper table-wrapper--training-models">
                <table className="training-models-table">
                  <thead>
                    <tr>
                      <th>Дата обучения</th>
                      <th>Датасет</th>
                      <th>Статус</th>
                      <th>Этап</th>
                      <th>Модель</th>
                      <th>Версия</th>
                      <th>R2</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableModels.map((job) => {
                      const jobMetrics = getSelectedMetrics(job);
                      const isActiveModelJob = isActiveTrainingJob(job);
                      const canDeleteJob = !isActiveModelJob && !['queued', 'running', 'applying'].includes(job.status);
                      const canApplyJob = !isActiveModelJob && ['ready', 'applied'].includes(job.status);

                      return (
                        <tr
                          key={job.id}
                          className={expandedJobId === job.id ? 'history-row history-row--active' : 'history-row'}
                          onClick={() => setExpandedJobId(job.id)}
                        >
                          <td className="training-models-table__date">{formatDate(job.finishedAt ?? job.createdAt)}</td>
                          <td className="training-models-table__dataset">{job.datasetFileName}</td>
                          <td>
                            <span className={
                              isActiveModelJob
                                ? 'status-badge status-badge--success'
                                : job.status === 'failed'
                                  ? 'status-badge status-badge--error'
                                  : 'status-badge status-badge--neutral'
                            }
                            >
                              {getTrainingStatusLabel(job.status, isActiveModelJob)}
                            </span>
                          </td>
                          <td>{getTrainingStageLabel(job.stage)}</td>
                          <td className="training-models-table__model">{job.modelName ?? '—'}</td>
                          <td className="training-models-table__version">{job.modelVersion ?? '—'}</td>
                          <td className="training-models-table__metric">{formatMetricValue(jobMetrics?.r2, 'ratio')}</td>
                          <td>
                            <div className="table-actions table-actions--training">
                              {canApplyJob && (
                                <button
                                  className={isMlActionLoading ? 'button button--loading' : 'button'}
                                  type="button"
                                  onClick={(evt) => {
                                    evt.stopPropagation();
                                    void handleApplyTrainingJob(job.id);
                                  }}
                                  disabled={isMlActionLoading}
                                >
                                  {isMlActionLoading ? 'Применяем...' : 'Активировать'}
                                </button>
                              )}
                              <button
                                className="button button--danger"
                                type="button"
                                onClick={(evt) => {
                                  evt.stopPropagation();
                                  openTrainingDeletion(job);
                                }}
                                disabled={isMlActionLoading || !canDeleteJob}
                              >
                                Удалить
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {availableModels.length === 0 && (
                <div className="empty-state">
                  <p>Сохранённые модели пока не появились.</p>
                </div>
              )}

              {expandedJob && (
                <div className="admin-info-grid">
                  <article className="admin-info-card">
                    <h2>Детали выбранной модели</h2>
                    <p><strong>Датасет:</strong> {expandedJob.datasetFileName}</p>
                    <p><strong>Статус:</strong> {getTrainingStatusLabel(expandedJob.status, isActiveTrainingJob(expandedJob))}</p>
                    <p><strong>Этап:</strong> {getTrainingStageLabel(expandedJob.stage)}</p>
                    <p><strong>Версия модели:</strong> {expandedJob.modelVersion ?? '—'}</p>
                    <p><strong>Старт:</strong> {formatDate(expandedJob.startedAt)}</p>
                    <p><strong>Завершение:</strong> {formatDate(expandedJob.finishedAt)}</p>
                    <p><strong>Последнее применение:</strong> {formatDate(expandedJob.appliedAt)}</p>
                    {expandedJob.errorMessage && (
                      <p className="form-error">{expandedJob.errorMessage}</p>
                    )}
                  </article>

                  <article className="admin-info-card">
                    <h2>Лог выполнения</h2>
                    <pre className="admin-log">{expandedJob.logOutput || 'Лог пока пуст.'}</pre>
                  </article>
                </div>
              )}

              <section className="admin-info-card">
                <div className="panel-header">
                  <div>
                    <h2>История применений моделей</h2>
                    <p>Здесь отображаются все случаи, когда одна из сохранённых моделей делалась активной для работы сервиса.</p>
                  </div>
                  <button
                    className="button button--danger"
                    type="button"
                    onClick={() => openModelApplicationsClear()}
                    disabled={isMlActionLoading || modelApplications.length === 0}
                  >
                    Очистить историю
                  </button>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Дата применения</th>
                        <th>Датасет</th>
                        <th>Модель</th>
                        <th>Версия</th>
                        <th>ID администратора</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelApplications.length > 0 ? modelApplications.map((application) => (
                        <tr key={application.id}>
                          <td>{formatDate(application.appliedAt)}</td>
                          <td>{application.datasetFileName}</td>
                          <td>{application.modelName ?? '—'}</td>
                          <td>{application.modelVersion ?? '—'}</td>
                          <td>{application.appliedBy ?? '—'}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5}>История применений пока пуста.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </section>
      </main>

      {pendingDeletion && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!isMlActionLoading) {
              setPendingDeletion(null);
            }
          }}
        >
          <div
            className="confirm-modal"
            onClick={(evt) => evt.stopPropagation()}
          >
            <p className="eyebrow">Подтверждение удаления</p>
            <h2>{pendingDeletion.title}</h2>
            <p>{pendingDeletion.description}</p>
            <div className="confirm-modal__actions">
              <button
                className="button button--ghost"
                type="button"
                onClick={() => setPendingDeletion(null)}
                disabled={isMlActionLoading}
              >
                Отмена
              </button>
              <button
                className={isMlActionLoading ? 'button button--danger button--loading' : 'button button--danger'}
                type="button"
                onClick={() => {
                  void handleConfirmDeletion();
                }}
                disabled={isMlActionLoading}
              >
                {isMlActionLoading
                  ? pendingDeletion.kind === 'model-applications' ? 'Очищаем...' : 'Удаляем...'
                  : pendingDeletion.kind === 'model-applications' ? 'Очистить' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { AdminPage };

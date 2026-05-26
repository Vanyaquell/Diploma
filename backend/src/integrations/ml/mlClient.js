const env = require("../../config/env");
const HttpError = require("../../utils/httpError");

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.mlServiceTimeoutMs);

  try {
    const response = await fetch(`${env.mlServiceUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new HttpError(503, `Запрос к ML-сервису завершился ошибкой: ${text || response.statusText}`);
    }

    return response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new HttpError(504, "Время ожидания ответа от ML-сервиса истекло.");
    }
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(503, "ML-сервис недоступен.", { cause: error.message });
  } finally {
    clearTimeout(timeout);
  }
}

async function getHealth() {
  return request("/health", { method: "GET" });
}

async function getModelInfo() {
  return request("/model-info", { method: "GET" });
}

async function predict(payload) {
  return request("/predict", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function reloadModel() {
  return request("/reload-model", {
    method: "POST",
  });
}

module.exports = {
  getHealth,
  getModelInfo,
  predict,
  reloadModel,
};

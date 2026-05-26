const fs = require("node:fs/promises");
const path = require("node:path");

const { parse } = require("csv-parse/sync");
const ExcelJS = require("exceljs");

const EDITABLE_COLUMNS = [
  "city",
  "district",
  "underground",
  "total_meters",
  "living_meters",
  "kitchen_meters",
  "rooms_count",
  "floor",
  "floors_count",
  "house_material_type",
  "finish_type",
  "object_type",
  "year_of_construction",
  "price",
];

const PREVIEW_COLUMNS = [
  "city",
  "district",
  "underground",
  "rooms_count",
  "total_meters",
  "price",
];

const DECIMAL_COLUMNS = new Set([
  "total_meters",
  "living_meters",
  "kitchen_meters",
]);

const INTEGER_COLUMNS = new Set([
  "rooms_count",
  "floor",
  "floors_count",
  "year_of_construction",
  "price",
]);

const MIN_PRICE = 500_000;
const MAX_PRICE = 500_000_000;
const MIN_TOTAL_METERS = 10;
const MAX_TOTAL_METERS = 400;
const MIN_FLOOR = 1;
const MAX_FLOOR = 100;
const MIN_ROOMS = 0;
const MAX_ROOMS = 10;
const MIN_YEAR = 1800;
const MAX_YEAR = 2035;

const COLUMN_WIDTHS = {
  city: 18,
  district: 22,
  underground: 22,
  total_meters: 16,
  living_meters: 16,
  kitchen_meters: 16,
  rooms_count: 14,
  floor: 10,
  floors_count: 12,
  house_material_type: 20,
  finish_type: 18,
  object_type: 14,
  year_of_construction: 20,
  price: 16,
};

function detectDelimiter(content) {
  const firstLine = content.split(/\r?\n/, 1)[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function normalizeRoomKey(value) {
  const numericValue = Number.parseFloat(String(value ?? "").replace(",", "."));
  if (Number.isNaN(numericValue)) {
    return "unknown";
  }

  if (numericValue === 0) {
    return "studio";
  }

  return String(Math.trunc(numericValue));
}

function toPositiveNumber(value) {
  if (value instanceof Date) {
    return null;
  }

  const numericValue = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(numericValue) ? numericValue : null;
}

function isDateLikeValue(value) {
  if (value instanceof Date) {
    return true;
  }

  const normalizedValue = String(value ?? "").trim();
  return /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(normalizedValue);
}

function detectMissingColumns(columns) {
  return EDITABLE_COLUMNS.filter((column) => !columns.includes(column));
}

function normalizeTextValue(value, fallback = "") {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue === "" ? fallback : normalizedValue;
}

function toFiniteNumber(value) {
  if (value instanceof Date || value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number.parseFloat(String(value).trim().replace(",", "."));
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeDatasetRecord(record) {
  return {
    city: normalizeTextValue(record.city, "unknown"),
    district: normalizeTextValue(record.district, "unknown"),
    underground: normalizeTextValue(record.underground, "unknown"),
    total_meters: toFiniteNumber(record.total_meters),
    living_meters: toFiniteNumber(record.living_meters),
    kitchen_meters: toFiniteNumber(record.kitchen_meters),
    rooms_count: toFiniteNumber(record.rooms_count),
    floor: toFiniteNumber(record.floor),
    floors_count: toFiniteNumber(record.floors_count),
    house_material_type: normalizeTextValue(record.house_material_type, "unknown"),
    finish_type: normalizeTextValue(record.finish_type, "unknown"),
    object_type: "flat",
    year_of_construction: toFiniteNumber(record.year_of_construction),
    price: toFiniteNumber(record.price),
  };
}

function buildDuplicateKey(record) {
  const comparableRecord = {};
  for (const column of EDITABLE_COLUMNS) {
    comparableRecord[column] = formatCanonicalValue(column, record[column]);
  }

  return JSON.stringify(comparableRecord);
}

function unwrapSpreadsheetValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) {
      return unwrapSpreadsheetValue(value.result);
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || "").join("");
    }

    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
  }

  return value;
}

function formatCanonicalValue(column, value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const normalizedValue = String(value).trim();
  const numericValue = Number.parseFloat(normalizedValue.replace(",", "."));
  if (!Number.isFinite(numericValue)) {
    return normalizedValue;
  }

  if (DECIMAL_COLUMNS.has(column)) {
    return Number.isInteger(numericValue)
      ? String(numericValue)
      : String(numericValue).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }

  if (INTEGER_COLUMNS.has(column)) {
    return String(Math.round(numericValue));
  }

  return normalizedValue;
}

function formatEditableValue(column, value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (value instanceof Date) {
    return value.toLocaleDateString("ru-RU");
  }

  const normalizedValue = String(value).trim();
  const numericValue = Number.parseFloat(normalizedValue.replace(",", "."));
  if (!Number.isFinite(numericValue)) {
    return normalizedValue;
  }

  if (DECIMAL_COLUMNS.has(column)) {
    const decimalText = Number.isInteger(numericValue)
      ? String(numericValue)
      : String(numericValue).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");

    return decimalText.replace(".", ",");
  }

  if (INTEGER_COLUMNS.has(column)) {
    return String(Math.round(numericValue));
  }

  return normalizedValue;
}

function toEditableRecord(record) {
  const editableRecord = {};

  for (const column of EDITABLE_COLUMNS) {
    editableRecord[column] = formatEditableValue(column, record[column]);
  }

  return editableRecord;
}

function quoteCsvValue(value, delimiter = ",") {
  const normalizedValue = String(value ?? "");
  const escapedValue = normalizedValue.replace(/"/g, "\"\"");
  const escapePattern = new RegExp(`[\"${delimiter}\r\n]`);
  return escapePattern.test(escapedValue) ? `"${escapedValue}"` : escapedValue;
}

async function loadCsvDatasetRecords(filePath) {
  const content = await fs.readFile(filePath, "utf-8");
  const delimiter = detectDelimiter(content);
  return parse(content, {
    bom: true,
    columns: true,
    delimiter,
    skip_empty_lines: true,
    trim: true,
  });
}

async function loadXlsxDatasetRecords(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    const error = new Error("Файл Excel с датасетом пуст.");
    error.statusCode = 400;
    throw error;
  }

  const headerRow = worksheet.getRow(1);
  const columns = EDITABLE_COLUMNS.map((_column, index) => {
    const rawHeader = unwrapSpreadsheetValue(headerRow.getCell(index + 1).value);
    return String(rawHeader ?? "").trim();
  });

  const missingColumns = detectMissingColumns(columns);
  if (missingColumns.length > 0) {
    const error = new Error(`В датасете отсутствуют обязательные столбцы: ${missingColumns.join(", ")}`);
    error.statusCode = 400;
    error.details = { missingColumns };
    throw error;
  }

  const records = [];
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const record = {};
    let hasAnyValue = false;

    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const columnName = columns[columnIndex];
      const rawValue = unwrapSpreadsheetValue(row.getCell(columnIndex + 1).value);
      record[columnName] = rawValue;
      if (rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== "") {
        hasAnyValue = true;
      }
    }

    if (hasAnyValue) {
      records.push(record);
    }
  }

  return records;
}

async function loadDatasetRecords(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  let records;

  if (extension === ".xlsx") {
    records = await loadXlsxDatasetRecords(filePath);
  } else {
    records = await loadCsvDatasetRecords(filePath);
  }

  if (!records.length) {
    const error = new Error("Файл датасета пуст.");
    error.statusCode = 400;
    throw error;
  }

  const columns = Object.keys(records[0]);
  const missingColumns = detectMissingColumns(columns);
  if (missingColumns.length > 0) {
    const error = new Error(`В датасете отсутствуют обязательные столбцы: ${missingColumns.join(", ")}`);
    error.statusCode = 400;
    error.details = { missingColumns };
    throw error;
  }

  return records;
}

function inspectDatasetRecords(records) {
  const cityDistribution = {};
  const roomDistribution = {};

  for (const record of records) {
    const cityKey = String(record.city || "unknown");
    cityDistribution[cityKey] = (cityDistribution[cityKey] || 0) + 1;

    const roomKey = normalizeRoomKey(record.rooms_count);
    roomDistribution[roomKey] = (roomDistribution[roomKey] || 0) + 1;
  }

  const preview = records.slice(0, 8).map((record) => {
    const previewRow = {};

    for (const column of PREVIEW_COLUMNS) {
      previewRow[column] = formatEditableValue(column, record[column]);
    }

    return previewRow;
  });

  const hasInvalidNumericRows = records.some((record) => {
    const totalMeters = toPositiveNumber(record.total_meters);
    const price = toPositiveNumber(record.price);

    if (totalMeters === null || price === null) {
      return true;
    }

    return totalMeters <= 0 || price <= 0;
  });

  const hasDateLikeAreaValues = records.some((record) =>
    [record.total_meters, record.living_meters, record.kitchen_meters].some((value) => value && isDateLikeValue(value))
  );

  if (hasInvalidNumericRows) {
    const error = new Error("В датасете есть некорректные числовые значения в total_meters или price.");
    error.statusCode = 400;
    throw error;
  }

  if (hasDateLikeAreaValues) {
    const error = new Error("В столбцах площади обнаружены значения, похожие на даты. Скачайте файл заново, откройте его в Excel и проверьте, что ячейки площади сохранены как текст или число.");
    error.statusCode = 400;
    throw error;
  }

  return {
    columns: EDITABLE_COLUMNS,
    cityDistribution,
    preview,
    roomDistribution,
    rowsCount: records.length,
  };
}

function cleanDatasetRecords(records) {
  const report = {
    rowsBefore: records.length,
    rowsAfter: 0,
    duplicatesRemoved: 0,
    rowsRemovedInvalidRequiredValues: 0,
    rowsRemovedByNumericFilters: 0,
    rowsRemovedInvalidFloorRelation: 0,
  };

  const cleanedRecords = [];
  const seenRows = new Set();

  for (const rawRecord of records) {
    const record = normalizeDatasetRecord(rawRecord);

    if (record.total_meters === null || record.price === null || record.total_meters <= 0 || record.price <= 0) {
      report.rowsRemovedInvalidRequiredValues += 1;
      continue;
    }

    const numericFiltersPassed =
      record.price >= MIN_PRICE &&
      record.price <= MAX_PRICE &&
      record.total_meters >= MIN_TOTAL_METERS &&
      record.total_meters <= MAX_TOTAL_METERS &&
      (record.floor === null || (record.floor >= MIN_FLOOR && record.floor <= MAX_FLOOR)) &&
      (record.floors_count === null || (record.floors_count >= MIN_FLOOR && record.floors_count <= MAX_FLOOR)) &&
      (record.rooms_count === null || (record.rooms_count >= MIN_ROOMS && record.rooms_count <= MAX_ROOMS)) &&
      (record.year_of_construction === null || (record.year_of_construction >= MIN_YEAR && record.year_of_construction <= MAX_YEAR));

    if (!numericFiltersPassed) {
      report.rowsRemovedByNumericFilters += 1;
      continue;
    }

    if (
      record.floor !== null &&
      record.floors_count !== null &&
      record.floor > record.floors_count
    ) {
      report.rowsRemovedInvalidFloorRelation += 1;
      continue;
    }

    const duplicateKey = buildDuplicateKey(record);
    if (seenRows.has(duplicateKey)) {
      report.duplicatesRemoved += 1;
      continue;
    }

    seenRows.add(duplicateKey);
    cleanedRecords.push(record);
  }

  report.rowsAfter = cleanedRecords.length;
  return {
    records: cleanedRecords,
    report,
  };
}

async function inspectDatasetFile(filePath) {
  const records = await loadDatasetRecords(filePath);
  return inspectDatasetRecords(records);
}

async function saveDatasetRecordsAsCanonicalCsv(records, targetPath) {
  const rows = [
    EDITABLE_COLUMNS.join(","),
    ...records.map((record) =>
      EDITABLE_COLUMNS.map((column) => quoteCsvValue(formatCanonicalValue(column, record[column]))).join(",")
    ),
  ];

  await fs.writeFile(targetPath, rows.join("\n"), "utf-8");
}

async function buildEditableDatasetWorkbookBuffer(filePath) {
  const records = await loadDatasetRecords(filePath);
  const editableRecords = records.map(toEditableRecord);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EstatePredict";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Датасет", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = EDITABLE_COLUMNS.map((column) => ({
    header: column,
    key: column,
    width: COLUMN_WIDTHS[column] || 18,
    style: {
      numFmt: "@",
      alignment: {
        vertical: "middle",
      },
    },
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };

  for (const record of editableRecords) {
    const row = worksheet.addRow(record);
    row.eachCell((cell) => {
      cell.numFmt = "@";
      cell.alignment = { vertical: "middle" };
    });
  }

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, worksheet.rowCount), column: EDITABLE_COLUMNS.length },
  };

  const workbookBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(workbookBuffer) ? workbookBuffer : Buffer.from(workbookBuffer);
}

module.exports = {
  buildEditableDatasetWorkbookBuffer,
  cleanDatasetRecords,
  EDITABLE_COLUMNS,
  inspectDatasetFile,
  inspectDatasetRecords,
  loadDatasetRecords,
  saveDatasetRecordsAsCanonicalCsv,
};

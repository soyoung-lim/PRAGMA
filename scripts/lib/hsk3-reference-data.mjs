import crypto from "node:crypto";
import fs from "node:fs/promises";

export const HSK3_SOURCE_ID = "hsk30_syllabus_2025_11_effective_2026_07";
export const HSK3_TOPIC_DERIVATION_VERSION = "hsk3_topic_derivation_v1";
export const HSK3_TOPIC_MAPPING_VERSION = "pragma_hsk_topic_mapping_legacy_v1";

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

export async function readCsv(filePath) {
  const rows = parseCsv(await fs.readFile(filePath, "utf8"));
  if (rows.length === 0) throw new Error(`Empty CSV: ${filePath}`);
  const headers = rows[0];
  return rows.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(
        `${filePath}: row ${rowIndex + 2} has ${values.length} fields; expected ${headers.length}`,
      );
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function escapeCsv(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function writeCsv(filePath, headers, rows) {
  const output = [headers.join(",")]
    .concat(rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")))
    .join("\n");
  await fs.writeFile(filePath, `${output}\n`, "utf8");
}

export async function sha256File(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(content).digest("hex").toUpperCase();
}

export function boolValue(value, fieldName) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${fieldName}: expected true/false, got ${value}`);
}

export function sqlText(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function sqlBool(value) {
  return value ? "true" : "false";
}

export function pgSmallintArray(value) {
  const trimmed = String(value ?? "").trim();
  if (!/^\{(?:[1-7](?:,[1-7])*)?\}$/.test(trimmed)) {
    throw new Error(`Invalid smallint array: ${value}`);
  }
  return `'${trimmed}'::smallint[]`;
}

export function pgTextArrayFromPipe(value) {
  const items = String(value ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0) return "'{}'::text[]";
  return `ARRAY[${items.map((item) => sqlText(item)).join(",")}]::text[]`;
}

export function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

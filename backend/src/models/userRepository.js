const { query } = require("../database/pool");

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    passwordHash: row.password_hash,
    tokenVersion: Number(row.token_version ?? 0),
    role: row.role,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

async function findAllUsers() {
  const result = await query(
    `
      SELECT id, email, full_name, password_hash, token_version, role, status, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `
  );

  return result.rows.map(mapUser);
}

async function findUserById(userId) {
  const result = await query(
    `
      SELECT id, email, full_name, password_hash, token_version, role, status, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  return mapUser(result.rows[0]);
}

async function findUserByEmail(email) {
  const result = await query(
    `
      SELECT id, email, full_name, password_hash, token_version, role, status, created_at, updated_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email.toLowerCase()]
  );

  return mapUser(result.rows[0]);
}

async function createUser(userPayload) {
  const result = await query(
    `
      INSERT INTO users (id, email, full_name, password_hash, token_version, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, email, full_name, password_hash, token_version, role, status, created_at, updated_at
    `,
    [
      userPayload.id,
      userPayload.email.toLowerCase(),
      userPayload.fullName,
      userPayload.passwordHash,
      userPayload.tokenVersion ?? 0,
      userPayload.role,
      userPayload.status,
      userPayload.createdAt,
      userPayload.updatedAt || null,
    ]
  );

  return mapUser(result.rows[0]);
}

async function updateUser(userId, updates) {
  const columnMap = {
    email: "email",
    fullName: "full_name",
    passwordHash: "password_hash",
    tokenVersion: "token_version",
    role: "role",
    status: "status",
    createdAt: "created_at",
    updatedAt: "updated_at",
  };

  const entries = Object.entries(updates)
    .filter(([key, value]) => columnMap[key] && value !== undefined)
    .map(([key, value]) => [columnMap[key], key === "email" ? String(value).toLowerCase() : value]);

  if (entries.length === 0) {
    return findUserById(userId);
  }

  const assignments = entries.map(([column], index) => `${column} = $${index + 2}`);
  const values = [userId, ...entries.map(([, value]) => value)];
  const result = await query(
    `
      UPDATE users
      SET ${assignments.join(", ")}
      WHERE id = $1
      RETURNING id, email, full_name, password_hash, token_version, role, status, created_at, updated_at
    `,
    values
  );

  return mapUser(result.rows[0]);
}

async function incrementUserTokenVersion(userId) {
  const result = await query(
    `
      UPDATE users
      SET token_version = token_version + 1
      WHERE id = $1
      RETURNING id, email, full_name, password_hash, token_version, role, status, created_at, updated_at
    `,
    [userId]
  );

  return mapUser(result.rows[0]);
}

module.exports = {
  findAllUsers,
  findUserById,
  findUserByEmail,
  createUser,
  incrementUserTokenVersion,
  updateUser,
};

"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true"
    ? { rejectUnauthorized: false }
    : undefined
});

pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error);
});

const DEFAULT_ITEMS = [
  ["Mold Temperature","Cavity","22-32 °C",true],
  ["Mold Temperature","Core","22-32 °C",true],
  ["Cylinder Temperature","N1","210 °C ±10",true],
  ["Cylinder Temperature","N2","210 °C ±10",true],
  ["Cylinder Temperature","C1","220 °C ±10",true],
  ["Cylinder Temperature","C2","210 °C ±10",true],
  ["Cylinder Temperature","C3","200 °C ±10",true],
  ["Cylinder Temperature","C4","190 °C ±10",true],
  ["Cylinder Temperature","C5","ไม่ได้ใช้งาน",false],
  ["Valve Gate","Valve 1","0.5 / 9.0 sec",true],
  ["Valve Gate","Valve 2","0.9 / 9.3 sec",true],
  ["Valve Gate","Valve 3","ไม่ได้ใช้งาน",false],
  ["Valve Gate","Valve 4","ไม่ได้ใช้งาน",false],
  ["Valve Gate","Valve 5","ไม่ได้ใช้งาน",false],
  ["Valve Gate","Valve 6","ไม่ได้ใช้งาน",false],
  ["Injection Pressure","Injection Max","74.3 MPa ±5",true],
  ["Clamp Pressure","Clamp Max","830 ton ±30",true],
  ["Time","Injection Time","3.24 sec ±0.5",true],
  ["Time","Cure / Cooling Time","15 sec ±5",true],
  ["Time","Plast Time","10.59 sec ±3",true],
  ["Time","Cycle Time","41.3 sec ±3",true],
  ["Cushion","Cushion Position","8 mm ±2",true],
  ["Mold Cooling","Cavity Set","24 °C",true],
  ["Mold Cooling","Cavity Display","19-29 °C",true],
  ["Mold Cooling","Core Set","24 °C",true],
  ["Mold Cooling","Core Display","19-29 °C",true],
  ["Mold Temp Control Box","Zone 1","220 °C",true],
  ["Mold Temp Control Box","Zone 2","220 °C",true],
  ["Mold Temp Control Box","Zone 3","220 °C",true],
  ["Hot Runner","Zone 1","210 °C",true],
  ["Hot Runner","Zone 2","210 °C",true],
  ["Hot Runner","Zone 3","210 °C",true],
  ["Hot Runner","Zone 4","210 °C",true],
  ["Hot Runner","Zone 5","210 °C",true],
  ["Hot Runner","Zone 6","210 °C",true],
  ["Dryer","Drying Temperature","90 °C ±10",true],
  ["Material","Recycle Material","ใช้ = 1 / ไม่ใช้ = 0",true]
];

async function initializeDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, "sql", "schema.sql"), "utf8");
  await pool.query(schema);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const model = await client.query(`
      INSERT INTO models (model_code, model_name)
      VALUES ($1, $2)
      ON CONFLICT (model_code)
      DO UPDATE SET model_name = EXCLUDED.model_name, updated_at = NOW()
      RETURNING id
    `, ["RG01", "RG01"]);

    const part = await client.query(`
      INSERT INTO parts (model_id, part_code, part_name, machine_code)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (model_id, part_code)
      DO UPDATE SET
        part_name = EXCLUDED.part_name,
        machine_code = EXCLUDED.machine_code,
        updated_at = NOW()
      RETURNING id
    `, [model.rows[0].id, "MC16-CONDITION", "Check Sheet Condition", "MC16"]);

    const partId = part.rows[0].id;
    const countResult = await client.query(
      "SELECT COUNT(*)::int AS count FROM condition_template_items WHERE part_id = $1",
      [partId]
    );

    if (Number(countResult.rows[0].count) === 0) {
      let itemNo = 0;
      for (const [group, topic, standardValue, isRequired] of DEFAULT_ITEMS) {
        itemNo += 1;
        await client.query(`
          INSERT INTO condition_template_items (
            part_id, item_no, condition_group, topic, standard_value,
            input_type, unit, is_required, is_active
          )
          VALUES ($1, $2, $3, $4, $5, 'text', NULL, $6, TRUE)
        `, [partId, itemNo, group, topic, standardValue, isRequired]);
      }
      console.log(`Database ready: seeded ${DEFAULT_ITEMS.length} Condition items`);
    } else {
      console.log(`Database ready: template already has ${countResult.rows[0].count} items`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const ready = initializeDatabase().catch((error) => {
  console.error("Database initialization failed:", error);
  throw error;
});

async function query(text, params = []) {
  await ready;
  return pool.query(text, params);
}

async function transaction(callback) {
  await ready;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, ready, query, transaction };

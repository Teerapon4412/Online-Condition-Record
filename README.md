# Online Condition Record

Standalone system สำหรับบันทึกค่า Condition ออนไลน์ แยกจาก Factory Online Exam

## Flow

Model → Part → Condition Template → Input Actual Condition → Auto Check OK/NG → PostgreSQL → History → View Detail

## Stack

- Node.js
- Express
- PostgreSQL
- HTML / CSS / JavaScript
- Render Blueprint

## Project Structure

```text
public/
  index.html
  app.js
  styles.css
scripts/
  init-db.js
sql/
  schema.sql
db.js
server.js
package.json
render.yaml
.env.example
```

## Database

- `models`
- `parts`
- `condition_template_items`
- `condition_records`
- `condition_record_items`

ทุกครั้งที่กด Save จะสร้าง Condition Record ใหม่ ไม่เขียนทับ History เดิม

## Default Seed

`npm run db:init` จะสร้างข้อมูลเริ่มต้น:

- Model: `RG01`
- Part: `MC16-CONDITION`
- Machine: `MC16`
- Condition: 37 รายการ

Seed จะเพิ่ม 37 รายการเฉพาะเมื่อ Part นั้นยังไม่มี Condition Template จึงไม่ลบ Standard ที่แก้ไว้ภายหลัง

## Local Setup

```bash
npm install
```

สร้าง `.env` จาก `.env.example` และกำหนด `DATABASE_URL`

```bash
npm run db:init
npm start
```

เปิด `http://localhost:3000`

## Render

Repository มี `render.yaml` สำหรับสร้าง:

- Web Service: `online-condition-record`
- PostgreSQL: `online-condition-db`

ใน Render เลือก **New → Blueprint** แล้วเชื่อม Repository นี้ ระบบจะใช้ `render.yaml` และเชื่อม `DATABASE_URL` ให้อัตโนมัติ

## Main APIs

- `GET /api/health`
- `GET /api/models`
- `POST /api/models`
- `GET /api/models/:id/parts`
- `POST /api/parts`
- `GET /api/parts/:id/template`
- `PUT /api/parts/:id/template`
- `POST /api/records`
- `GET /api/records`
- `GET /api/records/:id`

## Condition Validation

หน้า Condition Record Sheet ตรวจค่าที่กรอกแบบ Real-time และรองรับมาตรฐาน เช่น:

- `22-32 °C`
- `210 °C ±10`
- `74.3 MPa ±5`
- `220 °C`
- `0.5 / 9.0 sec`
- `ใช้ = 1 / ไม่ใช้ = 0`

ถ้าค่าอยู่นอก Standard จะแสดง NG และผู้ใช้ยังสามารถยืนยันเพื่อเก็บ NG ไว้ใน History ได้

# รายงานผลการตรวจสอบคุณภาพและความปลอดภัยของโค้ด (Week 14)

- รายวิชา: 88734065
- กลุ่ม: `<ชื่อกลุ่ม / รหัสนิสิต>`
- โปรเจกต์: ระบบร้านกาแฟ (CRUD + Orders)
- วันที่ตรวจ: 29 ตุลาคม 2026

> **หมายเหตุ:** ร่างนี้เตรียมโครงและประเด็นที่ "น่าจะพบ" จากเอกสาร wk14/wk09 ไว้ให้แล้ว
> ทุกช่องที่มี `<...>` หรือ `[ ]` ต้องตรวจกับโค้ดจริงของกลุ่มและแก้ให้ตรงก่อนส่ง
> ห้ามส่งโดยยังไม่ได้ไล่ตรวจจริง เพราะเกณฑ์ CLO7 ต้องการหลักฐานการตรวจสอบ

---

## 1. รายการ endpoint ที่ตรวจสอบ

Checklist (หัวข้อ 1.2):
1. Input Validation ครบ
2. ป้องกัน IDOR (กรอง `branch_id` ควบคู่กับ `:id`)
3. ป้องกัน SQL Injection (parameterized query)
4. Error Handling สอดคล้อง (`try/catch`, ไม่ส่ง SQL error กลับ client)
5. Race Condition ในจุดอ่านแล้วเขียนต่อเนื่อง

| # | Method | Path | ไฟล์ routes | 1 Validation | 2 IDOR | 3 SQLi | 4 Error | 5 Race | หมายเหตุ |
|---|--------|------|-------------|:---:|:---:|:---:|:---:|:---:|----------|
| 1 | POST | `/orders` | `routes/orderRoutes.js` | [ ] | N/A | [ ] | [ ] | ไม่ผ่าน* | *ถ้ายังไม่มี transaction |
| 2 | GET | `/menu` | `routes/menuRoutes.js` | [ ] | [ ] | [ ] | [ ] | N/A | |
| 3 | POST | `/menu` | `routes/menuRoutes.js` | [ ] | [ ] | [ ] | [ ] | N/A | |
| 4 | PUT | `/menu/:id` | `routes/menuRoutes.js` | [ ] | [ ] | [ ] | [ ] | N/A | ดูข้อ 2.3 (PUT vs partial update) |
| 5 | DELETE | `/menu/:id` | `routes/menuRoutes.js` | [ ] | [ ] | [ ] | [ ] | N/A | |
| 6 | PATCH | `/menu/:id/stock` | `<ถ้ามี>` | [ ] | [ ] | [ ] | [ ] | [ ] | endpoint ที่กลุ่มเพิ่มเอง ตรวจเป็นพิเศษ |
| … | | | | | | | | | เพิ่มให้ครบทุก endpoint ใน routes |

ค่าในตาราง: ผ่าน / ไม่ผ่าน / N/A

---

## 2. จุดที่พบความเสี่ยง

### 2.1 Race condition ที่ `POST /orders` (ยืนยันออเดอร์)

- **ระดับ:** High
- **ตำแหน่ง:** `src/models/orderModel.js` (`createWithItems` หรือฟังก์ชันที่เทียบเท่า)
- **ปัญหา:** เช็คสต็อก (`SELECT`) และตัดสต็อก (`UPDATE`) เป็นคนละคำสั่ง ไม่ได้อยู่ใน transaction เดียวกัน
- **สถานการณ์จริง:** สต็อกเมนูเหลือ 1 หน่วย พนักงานสองคนกดยืนยันออเดอร์เมนูเดียวกันพร้อมกัน
  ทั้งสอง request อ่านได้ `stock_quantity = 1` ผ่านการเช็คทั้งคู่ แล้วตัดสต็อกทั้งคู่ ผลคือสต็อกเหลือ `-1`
- **เหตุที่ E2E ไม่เจอ:** test case ครอบคลุมเฉพาะการสั่งทีละออเดอร์
- **สถานะในโค้ดกลุ่มนี้:** `[ ] พบ  [ ] ไม่พบ (มี transaction + FOR UPDATE อยู่แล้ว)` ← ตรวจแล้วเลือก

### 2.2 IDOR ที่ endpoint ปรับสต็อก (ถ้ากลุ่มมี)

- **ระดับ:** High (ถ้าพบ) / Critical ถ้าลบหรือแก้ข้อมูลข้ามสาขาได้
- **ตำแหน่ง:** `<ไฟล์ / ฟังก์ชัน>`
- **ปัญหา:** query เป็น `UPDATE menu_item SET stock_quantity = ? WHERE menu_id = ?` ไม่มี `AND branch_id = ?`
- **สถานการณ์จริง:** พนักงานสาขา A เรียก `PATCH /menu/57/stock` โดย 57 เป็นเมนูของสาขา B ก็แก้สต็อกได้ เพียงแค่เดาหรือไล่ `menu_id`
- **สถานะในโค้ดกลุ่มนี้:** `[ ] พบ  [ ] ไม่พบ  [ ] ไม่มี endpoint นี้`
- **ที่ตรวจแล้วถูกต้อง:** `menuModel.updateFields` และ `menuModel.remove` กรอง `branch_id` ควบคู่ `menu_id` แล้ว (ยืนยันกับโค้ดจริงอีกครั้ง)

### 2.3 PUT ที่ทำงานเป็น partial update

- **ระดับ:** Low
- **ตำแหน่ง:** `router.put("/:id", ...)` + `updateMenu` ที่ใช้ `COALESCE`
- **ปัญหา:** PUT ตามความหมายมาตรฐานต้องส่งข้อมูลครบทุก field แต่โค้ดรับบาง field ได้ จึงเป็น partial update (ควรเป็น PATCH)
- **ผลกระทบด้านความปลอดภัย:** ไม่มี เป็นเรื่องความสอดคล้องของ interface
- **แนวทาง:** เปลี่ยน route เป็น `PATCH` หรือบังคับให้ PUT ส่งครบทุก field

### 2.4 ประเด็นอื่นที่พบ (เพิ่มเอง)

| ประเด็น | ตำแหน่ง | ระดับ | รายละเอียด |
|---------|---------|-------|------------|
| `<เช่น query ค้นหาแบบ template literal>` | `<ไฟล์:บรรทัด>` | `<...>` | `<...>` |

---

## 3. การแก้ไขที่ทำจริง

**จุดที่เลือกแก้:** 2.1 Race condition ที่ `POST /orders` (ความเสี่ยงสูง และต้องไม่กระทบพฤติกรรมเดิม)

### โค้ดก่อนแก้

```javascript
// <วางโค้ดเดิมของกลุ่มที่นี่ ที่เช็คสต็อกด้วย SELECT แล้ว UPDATE แยกกัน ไม่มี transaction>
```

### โค้ดหลังแก้

```javascript
// src/models/orderModel.js
const db = require("../config/db");

exports.createWithItems = async (branchId, employeeId, paymentMethod, items, menuMap) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [orderResult] = await connection.query(
      "INSERT INTO orders (branch_id, employee_id, payment_method, created_at) VALUES (?, ?, ?, NOW())",
      [branchId, employeeId, paymentMethod],
    );
    const orderId = orderResult.insertId;

    // เรียงตาม menuId เพื่อให้ล็อกแถวลำดับเดียวกันเสมอ ลดโอกาสเกิด deadlock
    const sorted = [...items].sort((a, b) => a.menuId - b.menuId);

    for (const item of sorted) {
      const menu = menuMap.get(item.menuId);

      // ล็อกแถว + กรอง branch_id ด้วย (กัน IDOR ไปในตัว)
      const [rows] = await connection.query(
        "SELECT stock_quantity FROM menu_item WHERE menu_id = ? AND branch_id = ? FOR UPDATE",
        [item.menuId, branchId],
      );
      if (rows.length === 0 || rows[0].stock_quantity < item.quantity) {
        throw new Error(`สต็อกไม่เพียงพอสำหรับเมนู id ${item.menuId}`);
      }

      await connection.query(
        "INSERT INTO order_item (order_id, menu_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
        [orderId, item.menuId, item.quantity, menu.price],
      );
      await connection.query(
        "UPDATE menu_item SET stock_quantity = stock_quantity - ? WHERE menu_id = ? AND branch_id = ?",
        [item.quantity, item.menuId, branchId],
      );
    }

    await connection.commit();
    return orderId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};
```

ประเด็นที่ปรับจากตัวอย่างในเอกสาร: ไม่เรียก `rollback()` ซ้ำสองรอบ (ปล่อยให้ `catch` จัดการที่เดียว), เรียงลำดับ `menuId` เพื่อลด deadlock, และเพิ่มเงื่อนไข `branch_id` ใน query ที่ล็อก/ตัดสต็อก
ควรให้ controller แปลง error "สต็อกไม่เพียงพอ" เป็น HTTP 409/400 โดยไม่ส่งรายละเอียดภายในกลับไป

### การทดสอบหลังแก้

| กรณีทดสอบ | ผลที่คาดหวัง | ผลจริง |
|-----------|--------------|--------|
| สั่งปกติ สต็อกพอ (Acceptance Criteria เดิมสัปดาห์ที่ 4) | สร้างออเดอร์สำเร็จ สต็อกลดถูกต้อง | `<...>` |
| สั่งเกินสต็อก | ถูกปฏิเสธ ไม่มี order/order_item ค้าง สต็อกไม่เปลี่ยน | `<...>` |
| ส่ง 2 request พร้อมกัน สต็อกเหลือ 1 | สำเร็จ 1 ปฏิเสธ 1 สต็อกเป็น 0 ไม่ติดลบ | `<...>` |
| ออเดอร์หลายรายการ รายการหลังสต็อกไม่พอ | rollback ทั้งออเดอร์ | `<...>` |

ตัวอย่างวิธีทดสอบ request พร้อมกัน:

```bash
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" -d '{"items":[{"menuId":1,"quantity":1}]}' &
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" -d '{"items":[{"menuId":1,"quantity":1}]}' &
wait
```

---

## 4. แผนการแก้ไขที่เหลือ (ความเสี่ยงที่ยังไม่ได้แก้)

| ความเสี่ยง | ระดับ | เหตุผลที่ยังไม่แก้ | แนวทางที่ควรทำต่อ |
|-----------|-------|---------------------|-------------------|
| IDOR ที่ `PATCH /menu/:id/stock` | High | `<เช่น หมดเวลา>` | เพิ่ม `AND branch_id = ?` ใน query และดึง `branch_id` จาก token ของพนักงาน ไม่รับจาก client |
| PUT เป็น partial update | Low | ไม่กระทบความปลอดภัย | เปลี่ยนเป็น PATCH หรือบังคับส่งครบทุก field |
| `<รายการอื่น>` | `<...>` | `<...>` | `<...>` |

ความเสี่ยงที่ระบุไว้ข้างต้นยังคงอยู่ในระบบ ณ วันที่ตรวจ ทีมที่รับช่วงต่อต้องไม่ถือว่าปลอดภัยจนกว่าจะแก้ครบ

---

## 5. สรุป

- endpoint ที่ตรวจทั้งหมด: `<N>` รายการ
- ผ่านทุกข้อ: `<n>` รายการ
- ไม่ผ่าน: `<n>` รายการ (Critical `<>` / High `<>` / Medium `<>` / Low `<>`)
- แก้จริงในสัปดาห์นี้: `<...>`
- ค้างไว้: `<...>`

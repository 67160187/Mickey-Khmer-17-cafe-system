// models/orderModel.js — field ตรงกับ column ใน wk07-schema.sql
const db = require('../config/db');

const orderModel = {
  // items: [{ menuId, quantity }] ; ราคา snapshot จาก menu_item.price ตอนสั่ง
  async create({ employeeId, paymentMethod, items }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [o] = await conn.query(
        'INSERT INTO orders (employee_id, payment_method) VALUES (?, ?)', [employeeId, paymentMethod]);
      const orderId = o.insertId;

      const [[emp]] = await conn.query('SELECT branch_id FROM employee WHERE employee_id = ?', [employeeId]);

      for (const { menuId, quantity } of items) {
        const [[m]] = await conn.query('SELECT price FROM menu_item WHERE menu_id = ?', [menuId]);
        await conn.query(
          'INSERT INTO order_item (order_id, menu_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
          [orderId, menuId, quantity, m.price]);
        await conn.query(
          'UPDATE branch_stock SET stock_quantity = stock_quantity - ? WHERE branch_id = ? AND menu_id = ?',
          [quantity, emp.branch_id, menuId]);
        await conn.query(
          'INSERT INTO stock_movement (branch_id, menu_id, quantity_change) VALUES (?, ?, ?)',
          [emp.branch_id, menuId, -quantity]);
      }
      await conn.commit();
      return orderId;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  // total_amount ไม่ถูกเก็บ — คำนวณสดด้วย SUM(quantity * unit_price)
  async findById(orderId) {
    const [rows] = await db.query(
      `SELECT o.order_id, o.employee_id, e.branch_id, o.payment_method, o.created_at,
              COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_amount
         FROM orders o
         JOIN employee e        ON e.employee_id = o.employee_id
         LEFT JOIN order_item oi ON oi.order_id = o.order_id
        WHERE o.order_id = ?
        GROUP BY o.order_id, o.employee_id, e.branch_id, o.payment_method, o.created_at`, [orderId]);
    if (!rows[0]) return null;
    const [items] = await db.query(
      'SELECT order_item_id, order_id, menu_id, quantity, unit_price FROM order_item WHERE order_id = ?', [orderId]);
    return { ...rows[0], items };
  },
};

module.exports = orderModel;

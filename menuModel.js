// models/menuModel.js — field ตรงกับ column ใน wk07-schema.sql
// สมมติว่า ../config/db export mysql2/promise pool (ปรับ path ให้ตรงกับ Sprint 1 ของทีม)
const db = require('../config/db');

const menuModel = {
  // menu_item: menu_id, category_id, name, price  | branch_stock: branch_id, menu_id, stock_quantity
  async findByBranch(branchId) {
    const [rows] = await db.query(
      `SELECT m.menu_id, m.category_id, c.name AS category_name,
              m.name, m.price, s.stock_quantity
         FROM branch_stock s
         JOIN menu_item m ON m.menu_id = s.menu_id
         JOIN category  c ON c.category_id = m.category_id
        WHERE s.branch_id = ?`, [branchId]);
    return rows;
  },

  async findById(menuId) {
    const [rows] = await db.query('SELECT menu_id, category_id, name, price FROM menu_item WHERE menu_id = ?', [menuId]);
    return rows[0] || null;
  },

  async create({ categoryId, name, price }) {
    const [r] = await db.query('INSERT INTO menu_item (category_id, name, price) VALUES (?, ?, ?)', [categoryId, name, price]);
    return r.insertId;
  },

  async updatePrice(menuId, price) {           // แก้ครั้งเดียว มีผลทุกสาขา
    const [r] = await db.query('UPDATE menu_item SET price = ? WHERE menu_id = ?', [price, menuId]);
    return r.affectedRows;
  },
};

module.exports = menuModel;

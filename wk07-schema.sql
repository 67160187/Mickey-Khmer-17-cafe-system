-- wk07-schema.sql : Coffee Shop (3NF)
-- ใช้ได้กับ MySQL 8.x
SET NAMES utf8mb4;

CREATE TABLE category (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE branch (
  branch_id INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  address   VARCHAR(255)
);

CREATE TABLE employee (
  employee_id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id   INT NOT NULL,
  name        VARCHAR(100) NOT NULL,
  role        VARCHAR(20)  NOT NULL,          -- single-table inheritance: BARISTA / CASHIER / MANAGER
  FOREIGN KEY (branch_id) REFERENCES branch(branch_id)
);

-- เมนูเป็นแนวคิดเดียวกันทุกสาขา (ชื่อ/ราคาเก็บครั้งเดียว)
CREATE TABLE menu_item (
  menu_id     INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  name        VARCHAR(100) NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (category_id) REFERENCES category(category_id)
);

-- สต็อกแยกตามสาขา (junction ของ branch กับ menu_item)
CREATE TABLE branch_stock (
  branch_id      INT NOT NULL,
  menu_id        INT NOT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  PRIMARY KEY (branch_id, menu_id),
  FOREIGN KEY (branch_id) REFERENCES branch(branch_id),
  FOREIGN KEY (menu_id)   REFERENCES menu_item(menu_id)
);

-- สาขาของออเดอร์หาได้จาก employee.branch_id จึงไม่เก็บซ้ำ (หลีกเลี่ยง transitive dependency)
CREATE TABLE orders (
  order_id       INT AUTO_INCREMENT PRIMARY KEY,
  employee_id    INT NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employee(employee_id)
);

-- unit_price = snapshot ราคา ณ เวลาสั่งซื้อ (ไม่ใช่ข้อมูลซ้ำ)
CREATE TABLE order_item (
  order_item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id      INT NOT NULL,
  menu_id       INT NOT NULL,
  quantity      INT NOT NULL CHECK (quantity > 0),
  unit_price    DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (menu_id)  REFERENCES menu_item(menu_id)
);

CREATE TABLE stock_movement (
  movement_id     INT AUTO_INCREMENT PRIMARY KEY,
  branch_id       INT NOT NULL,
  menu_id         INT NOT NULL,
  quantity_change INT NOT NULL,
  moved_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id, menu_id) REFERENCES branch_stock(branch_id, menu_id)
);

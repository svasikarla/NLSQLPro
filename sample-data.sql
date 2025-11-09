-- Sample database schema for NLSQL Pro testing
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/yukpehwesgzzktvoswbq/editor

-- Drop existing tables if they exist
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- Customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    city VARCHAR(50),
    country VARCHAR(50) DEFAULT 'India',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    order_date TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending',
    total_amount DECIMAL(10, 2),
    shipping_address TEXT
);

-- Order items table
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- Insert sample customers
INSERT INTO customers (name, email, phone, city, country) VALUES
('Rajesh Kumar', 'rajesh.kumar@example.com', '+91-9876543210', 'Mumbai', 'India'),
('Priya Sharma', 'priya.sharma@example.com', '+91-9876543211', 'Delhi', 'India'),
('Amit Patel', 'amit.patel@example.com', '+91-9876543212', 'Bangalore', 'India'),
('Sneha Reddy', 'sneha.reddy@example.com', '+91-9876543213', 'Hyderabad', 'India'),
('Vikram Singh', 'vikram.singh@example.com', '+91-9876543214', 'Chennai', 'India'),
('Anita Desai', 'anita.desai@example.com', '+91-9876543215', 'Pune', 'India'),
('Karan Mehta', 'karan.mehta@example.com', '+91-9876543216', 'Ahmedabad', 'India'),
('Pooja Verma', 'pooja.verma@example.com', '+91-9876543217', 'Kolkata', 'India');

-- Insert sample products
INSERT INTO products (name, category, price, stock_quantity) VALUES
('iPhone 15 Pro', 'Electronics', 129900.00, 50),
('Samsung Galaxy S24', 'Electronics', 79999.00, 75),
('MacBook Air M3', 'Computers', 114900.00, 30),
('Dell XPS 15', 'Computers', 145900.00, 20),
('Sony WH-1000XM5', 'Audio', 29990.00, 100),
('iPad Air', 'Tablets', 59900.00, 45),
('Nike Air Max', 'Footwear', 12995.00, 150),
('Adidas Ultraboost', 'Footwear', 14999.00, 120),
('Canon EOS R6', 'Cameras', 239900.00, 15),
('Sony A7 IV', 'Cameras', 219900.00, 12);

-- Insert sample orders
INSERT INTO orders (customer_id, order_date, status, total_amount, shipping_address) VALUES
(1, NOW() - INTERVAL '30 days', 'delivered', 129900.00, '123 MG Road, Mumbai, Maharashtra'),
(2, NOW() - INTERVAL '25 days', 'delivered', 79999.00, '456 Connaught Place, Delhi'),
(3, NOW() - INTERVAL '20 days', 'shipped', 144890.00, '789 Brigade Road, Bangalore, Karnataka'),
(1, NOW() - INTERVAL '15 days', 'delivered', 59900.00, '123 MG Road, Mumbai, Maharashtra'),
(4, NOW() - INTERVAL '10 days', 'processing', 42985.00, '321 Hitech City, Hyderabad, Telangana'),
(5, NOW() - INTERVAL '5 days', 'pending', 239900.00, '654 Anna Salai, Chennai, Tamil Nadu'),
(6, NOW() - INTERVAL '3 days', 'processing', 29990.00, '987 Koregaon Park, Pune, Maharashtra'),
(7, NOW() - INTERVAL '2 days', 'pending', 145900.00, '147 CG Road, Ahmedabad, Gujarat');

-- Insert sample order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
-- Order 1
(1, 1, 1, 129900.00),
-- Order 2
(2, 2, 1, 79999.00),
-- Order 3
(3, 3, 1, 114900.00),
(3, 5, 1, 29990.00),
-- Order 4
(4, 6, 1, 59900.00),
-- Order 5
(5, 7, 2, 12995.00),
(5, 8, 1, 14999.00),
(5, 5, 1, 29990.00),
-- Order 6
(6, 9, 1, 239900.00),
-- Order 7
(7, 5, 1, 29990.00),
-- Order 8
(8, 4, 1, 145900.00);

-- Create some useful indexes
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

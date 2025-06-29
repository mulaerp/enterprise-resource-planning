-- Create bill_of_materials table
CREATE TABLE IF NOT EXISTS bill_of_materials (
    id VARCHAR(50) PRIMARY KEY,
    product_id VARCHAR(50),
    product_name VARCHAR(255) NOT NULL,
    total_cost DECIMAL(15,2) DEFAULT 0,
    labor_hours DECIMAL(10,2) DEFAULT 0,
    labor_cost DECIMAL(15,2) DEFAULT 0,
    overhead_cost DECIMAL(15,2) DEFAULT 0,
    final_cost DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create bom_components table
CREATE TABLE IF NOT EXISTS bom_components (
    id SERIAL PRIMARY KEY,
    bom_id VARCHAR(50) REFERENCES bill_of_materials(id) ON DELETE CASCADE,
    item_id VARCHAR(50),
    item_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit VARCHAR(50) DEFAULT 'pcs',
    cost DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create work_orders table
CREATE TABLE IF NOT EXISTS work_orders (
    id VARCHAR(50) PRIMARY KEY,
    bom_id VARCHAR(50) REFERENCES bill_of_materials(id),
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    start_date DATE,
    expected_end_date DATE,
    actual_end_date DATE,
    assigned_to VARCHAR(255),
    priority VARCHAR(50) DEFAULT 'medium',
    progress INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bom_product_id ON bill_of_materials(product_id);
CREATE INDEX IF NOT EXISTS idx_bom_status ON bill_of_materials(status);
CREATE INDEX IF NOT EXISTS idx_bom_components_bom_id ON bom_components(bom_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_bom_id ON work_orders(bom_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_to ON work_orders(assigned_to);
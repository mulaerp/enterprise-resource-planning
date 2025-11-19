-- Phase 6.5: Basic Accounting Module

-- ============================================
-- Chart of Accounts
-- ============================================

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    parent_id UUID REFERENCES accounts(id),
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_accounts_code ON accounts(code);
CREATE INDEX idx_accounts_type ON accounts(account_type);
CREATE INDEX idx_accounts_parent ON accounts(parent_id);
CREATE INDEX idx_accounts_deleted ON accounts(deleted);

-- ============================================
-- Journal Entries
-- ============================================

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number VARCHAR(100) NOT NULL UNIQUE,
    entry_date DATE NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- DRAFT, POSTED, CANCELLED
    reference VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_journal_entries_number ON journal_entries(entry_number);
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);
CREATE INDEX idx_journal_entries_deleted ON journal_entries(deleted);

-- ============================================
-- Journal Entry Lines
-- ============================================

CREATE TABLE journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    debit DECIMAL(15, 2) NOT NULL DEFAULT 0,
    credit DECIMAL(15, 2) NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_debit_or_credit CHECK (
        (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
    )
);

CREATE INDEX idx_journal_entry_lines_entry ON journal_entry_lines(entry_id);
CREATE INDEX idx_journal_entry_lines_account ON journal_entry_lines(account_id);

-- ============================================
-- Default Chart of Accounts
-- ============================================

-- Assets (1000-1999)
INSERT INTO accounts (code, name, account_type, description) VALUES
('1000', 'Assets', 'ASSET', 'All company assets'),
('1100', 'Current Assets', 'ASSET', 'Assets convertible to cash within one year'),
('1110', 'Cash and Cash Equivalents', 'ASSET', 'Cash on hand and in banks'),
('1120', 'Accounts Receivable', 'ASSET', 'Money owed by customers'),
('1130', 'Inventory', 'ASSET', 'Products held for sale'),
('1140', 'Prepaid Expenses', 'ASSET', 'Expenses paid in advance'),
('1200', 'Fixed Assets', 'ASSET', 'Long-term tangible assets'),
('1210', 'Property, Plant & Equipment', 'ASSET', 'Buildings, machinery, equipment'),
('1220', 'Accumulated Depreciation', 'ASSET', 'Depreciation of fixed assets');

-- Liabilities (2000-2999)
INSERT INTO accounts (code, name, account_type, description) VALUES
('2000', 'Liabilities', 'LIABILITY', 'All company liabilities'),
('2100', 'Current Liabilities', 'LIABILITY', 'Obligations due within one year'),
('2110', 'Accounts Payable', 'LIABILITY', 'Money owed to suppliers'),
('2120', 'Accrued Expenses', 'LIABILITY', 'Expenses incurred but not yet paid'),
('2130', 'Short-term Loans', 'LIABILITY', 'Loans due within one year'),
('2200', 'Long-term Liabilities', 'LIABILITY', 'Obligations due after one year'),
('2210', 'Long-term Loans', 'LIABILITY', 'Loans due after one year');

-- Equity (3000-3999)
INSERT INTO accounts (code, name, account_type, description) VALUES
('3000', 'Equity', 'EQUITY', 'Owner''s equity'),
('3100', 'Capital', 'EQUITY', 'Owner''s investment'),
('3200', 'Retained Earnings', 'EQUITY', 'Accumulated profits'),
('3300', 'Current Year Earnings', 'EQUITY', 'Profit/loss for current year');

-- Revenue (4000-4999)
INSERT INTO accounts (code, name, account_type, description) VALUES
('4000', 'Revenue', 'REVENUE', 'All company revenue'),
('4100', 'Sales Revenue', 'REVENUE', 'Revenue from product sales'),
('4200', 'Service Revenue', 'REVENUE', 'Revenue from services'),
('4300', 'Other Revenue', 'REVENUE', 'Miscellaneous revenue');

-- Expenses (5000-5999)
INSERT INTO accounts (code, name, account_type, description) VALUES
('5000', 'Expenses', 'EXPENSE', 'All company expenses'),
('5100', 'Cost of Goods Sold', 'EXPENSE', 'Direct costs of products sold'),
('5200', 'Operating Expenses', 'EXPENSE', 'Day-to-day operating costs'),
('5210', 'Salaries and Wages', 'EXPENSE', 'Employee compensation'),
('5220', 'Rent', 'EXPENSE', 'Facility rental costs'),
('5230', 'Utilities', 'EXPENSE', 'Electricity, water, internet'),
('5240', 'Office Supplies', 'EXPENSE', 'Office materials and supplies'),
('5250', 'Marketing and Advertising', 'EXPENSE', 'Marketing costs'),
('5260', 'Depreciation', 'EXPENSE', 'Asset depreciation'),
('5300', 'Other Expenses', 'EXPENSE', 'Miscellaneous expenses');

-- Update parent relationships
UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '1000') WHERE code IN ('1100', '1200');
UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '1100') WHERE code IN ('1110', '1120', '1130', '1140');
UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '1200') WHERE code IN ('1210', '1220');

UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '2000') WHERE code IN ('2100', '2200');
UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '2100') WHERE code IN ('2110', '2120', '2130');
UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '2200') WHERE code IN ('2210');

UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '3000') WHERE code IN ('3100', '3200', '3300');

UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '4000') WHERE code IN ('4100', '4200', '4300');

UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '5000') WHERE code IN ('5100', '5200', '5300');
UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '5200') WHERE code IN ('5210', '5220', '5230', '5240', '5250', '5260');

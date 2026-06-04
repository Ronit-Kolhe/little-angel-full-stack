-- Create Teachers Table
CREATE TABLE teachers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create Students Table
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    grade_level VARCHAR(20) NOT NULL,
    fee_status VARCHAR(50) DEFAULT 'Pending'
);

-- Insert Dummy Data for Testing
INSERT INTO teachers (full_name, subject) VALUES 
('Arjun Sharma', 'Mathematics'), 
('Priya Desai', 'Science');

INSERT INTO students (full_name, grade_level, fee_status) VALUES 
('Aarav Patel', 'Grade 1', 'Paid'), 
('Diya Singh', 'Grade 2', 'Pending');
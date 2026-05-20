-- SQL Schema for Madatours Places
-- Create this table in your MySQL database

CREATE TABLE IF NOT EXISTS places (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type ENUM('restaurant', 'activity') NOT NULL,
    lat DECIMAL(10, 7) NOT NULL,
    lng DECIMAL(10, 7) NOT NULL,
    location VARCHAR(255) NOT NULL,
    description TEXT,
    rating DECIMAL(2, 1),
    hours VARCHAR(100),
    tags JSON, -- Stores tags as a JSON array (e.g., ["Beach", "Relaxation"])
    image VARCHAR(512),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample Data (Optional)
-- You can import the contents of src/data/places.json into this table.

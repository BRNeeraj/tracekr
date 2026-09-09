CREATE DATABASE IF NOT EXISTS hackathon_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'hackathon_user'@'localhost' IDENTIFIED BY 'change-this-password';
GRANT ALL PRIVILEGES ON hackathon_tracker.* TO 'hackathon_user'@'localhost';
FLUSH PRIVILEGES;

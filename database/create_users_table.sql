db.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    zero_id VARCHAR(255) NOT NULL UNIQUE
);`, (err, result) => {
    if (err) {
        console.error('Failed to create users table:', err);
    } else {
        console.log('users table created successfully.');
    }
});
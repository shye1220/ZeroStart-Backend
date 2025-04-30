const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const mysql = require('mysql2');
const db = require('./db'); // 数据库连接

const app = express();
app.use(bodyParser.json());
app.use(cors());

// 表创建逻辑
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

// 配置 MySQL 数据库连接
const dbConnection = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// 测试数据库连接
dbConnection.query('SELECT 1', (err, results) => {
  if (err) {
    console.error('Database connection test failed:', err);
  } else {
    console.log('Database connection test successful:', results);
  }
});

dbConnection.query('SELECT DATABASE()', (err, results) => {
    if (err) {
        console.error('Database connection test failed:', err);
    } else {
        console.log('Connected to database:', results[0]['DATABASE()']);
    }
});

// 创建 verification_codes 表
dbConnection.query(`CREATE TABLE IF NOT EXISTS verification_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at DATETIME NOT NULL
);`, (err, result) => {
  if (err) {
    console.error('Failed to create verification_codes table:', err);
  } else {
    console.log('verification_codes table created successfully.');
  }
});

// 配置 Nodemailer 邮件服务
const transporter = nodemailer.createTransport({
  service: 'gmail', // 使用 Gmail 服务
  auth: {
    user: 'liwenquan1220@gmail.com', // 新的 Gmail 地址
    pass: 'bjgkacncfzvomeau', // 应用专用密码
  },
});

// 测试邮件发送
transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: 'test@example.com',
  subject: 'Test Email',
  text: 'This is a test email from ZeroStart Backend.',
}, (error, info) => {
  if (error) {
    console.error('Test email failed:', error);
  } else {
    console.log('Test email sent:', info.response);
  }
});

// 测试接口
app.get('/', (req, res) => {
  res.send('ZeroStart Backend is running!');
});

// 邮箱验证码接口
app.post('/send-verification-code', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  // 生成 6 位随机验证码
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // 发送邮件
  const mailOptions = {
    from: 'liwenquan1220@gmail.com', // 新的 Gmail 地址
    to: email,
    subject: 'Your ZeroStart Verification Code',
    text: `Your verification code is: ${code}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to send email' });
    }

    // 邮件发送成功后插入验证码到数据库
    const query = 'INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)';
    dbConnection.query(query, [email, code, new Date(Date.now() + 5 * 60 * 1000)], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Database error' });
      }

      res.status(200).json({ message: 'Verification code sent successfully' });
    });
  });
});

// 用户注册接口
app.post('/register', (req, res) => {
  const { email, password, code } = req.body;

  // 检查必填字段
  if (!email || !password || !code) {
    return res.status(400).json({ message: 'Email, password, and code are required' });
  }

  // 从数据库中查询验证码
  const query = 'SELECT * FROM verification_codes WHERE email = ? AND code = ? AND expires_at > NOW()';
  dbConnection.query(query, [email, code], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // 验证通过，检查邮箱是否已存在
    const checkQuery = 'SELECT * FROM users WHERE email = ?';
    dbConnection.query(checkQuery, [email], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (results.length > 0) {
        return res.status(400).json({ message: 'Email is already registered' });
      }

      // 插入用户信息
      const zeroId = `Zero${Date.now()}`;
      const insertQuery = 'INSERT INTO users (email, password, zero_id) VALUES (?, ?, ?)';
      dbConnection.query(insertQuery, [email, password, zeroId], (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: 'Failed to register user' });
        }

        // 删除已使用的验证码
        const deleteQuery = 'DELETE FROM verification_codes WHERE email = ?';
        dbConnection.query(deleteQuery, [email]);

        res.status(200).json({ message: 'Registration successful', zeroId });
      });
    });
  });
});

// 用户登录接口
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const query = 'SELECT * FROM users WHERE email = ? AND password = ?';
  dbConnection.query(query, [email, password], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.status(200).json({ message: 'Login successful', zeroId: results[0].zero_id });
  });
});

// 用户信息接口
app.get('/user-info', (req, res) => {
  const { zeroId } = req.query;

  if (!zeroId) {
    return res.status(400).json({ message: 'Zero ID is required' });
  }

  const query = 'SELECT email, zero_id FROM users WHERE zero_id = ?';
  dbConnection.query(query, [zeroId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(results[0]);
  });
});

// 重置密码接口
app.post('/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Email, code, and new password are required' });
  }

  const query = 'SELECT * FROM verification_codes WHERE email = ? AND code = ? AND expires_at > NOW()';
  dbConnection.query(query, [email, code], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const updateQuery = 'UPDATE users SET password = ? WHERE email = ?';
    dbConnection.query(updateQuery, [newPassword, email], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to reset password' });
      }

      res.status(200).json({ message: 'Password reset successful' });
    });
  });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
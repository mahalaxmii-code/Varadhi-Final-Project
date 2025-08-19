

const express = require('express');
const oracledb = require('oracledb');
const cors = require('cors');
const bcrypt = require('bcrypt');

// Oracle DB connection configuration
const dbConfig = {
  user: "varadhi_user",
  password: "Varadhi123",
  connectString: "localhost:1521/XEPDB1",
  poolMin: 10,
  poolMax: 10,
  poolIncrement: 0,
  poolAlias: 'myOraclePool'
};

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Initialize Oracle connection pool
async function initializeOraclePool() {
  try {
    const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Oracle pool creation timed out after 10 seconds')), 10000);
    });

    await Promise.race([
        oracledb.createPool(dbConfig),
        timeoutPromise
    ]);

    console.log('✅ Oracle connection pool created successfully!');
  } catch (err) {
    console.error('❌ FATAL ERROR: Could not create Oracle connection pool!');
    console.error('   Details:', err.message);
    console.error('   Check if Oracle DB is running, listener is up, and credentials/connectString are correct.');
    process.exit(1);
  }
}

// Function to get a connection from the pool and execute a query
async function executeQuery(sql, binds = [], options = {}) {
  let connection;
  try {
    connection = await oracledb.getConnection('myOraclePool');
    console.log(`Executing SQL: ${sql}`);
    const result = await connection.execute(sql, binds, options);
    console.log(`Query successful. Rows affected/fetched: ${result.rows ? result.rows.length : result.rowsAffected}`);
    return result;
  } catch (err) {
    console.error('❌ ERROR: Failed to execute query!');
    console.error('   SQL:', sql);
    console.error('   Binds:', JSON.stringify(binds)); // Log binds for debugging
    console.error('   Details:', err.message);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('Connection released back to pool.');
      } catch (err) {
        console.error('❌ ERROR: Failed to close connection!', err);
      }
    }
  }
}

// ---------------------- API Routes ----------------------

// Existing service routes (no changes)
app.get('/api/services/distinct', async (req, res) => {
  const sql = `SELECT DISTINCT SERVICE FROM HELPING_SOCIETIES ORDER BY SERVICE`;
  try {
    const result = await executeQuery(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const distinctServices = result.rows.map(row => row.SERVICE);
    res.json(distinctServices);
  } catch (err) {
    console.error('Error in /api/services/distinct route:', err.message);
    res.status(500).json({ error: 'Failed to fetch distinct services', details: err.message });
  }
});

app.get('/api/services', async (req, res) => {
  const sql = `
    SELECT
      SOCIETY_NAME,
      ORGANISATION_NEED,
      SERVICE,
      STATE,
      DISTRICT,
      PINCODE
    FROM HELPING_SOCIETIES
  `;
  try {
    const result = await executeQuery(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    res.json(result.rows);
  } catch (err) {
    console.error('Error in /api/services route:', err.message);
    res.status(500).json({ error: 'Failed to fetch all services', details: err.message });
  }
});

app.get('/api/services/category/:categoryName', async (req, res) => {
  const categoryName = req.params.categoryName;
  const sql = `
    SELECT
      SOCIETY_NAME,
      ORGANISATION_NEED,
      SERVICE,
      STATE,
      DISTRICT,
      PINCODE
    FROM HELPING_SOCIETIES
    WHERE SERVICE = :categoryName
  `;
  const binds = { categoryName: categoryName };
  try {
    const result = await executeQuery(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    res.json(result.rows);
  } catch (err) {
    console.error(`Error in /api/services/category/${categoryName} route:`, err.message);
    res.status(500).json({ error: 'Failed to fetch services by category', details: err.message });
  }
});

app.get('/api/services/search', async (req, res) => {
  const searchTerm = req.query.query;
  if (!searchTerm) {
    return res.status(400).json({ error: 'Search query parameter is missing.' });
  }

  const sql = `
    SELECT
      SOCIETY_NAME,
      ORGANISATION_NEED,
      SERVICE,
      STATE,
      DISTRICT,
      PINCODE
    FROM HELPING_SOCIETIES
    WHERE
      UPPER(SOCIETY_NAME) LIKE UPPER(:searchTerm) OR
      UPPER(ORGANISATION_NEED) LIKE UPPER(:searchTerm) OR
      UPPER(SERVICE) LIKE UPPER(:searchTerm) OR
      UPPER(STATE) LIKE UPPER(:searchTerm) OR
      UPPER(DISTRICT) LIKE UPPER(:searchTerm) OR
      UPPER(PINCODE) LIKE UPPER(:searchTerm)
  `;
  const binds = { searchTerm: `%${searchTerm}%` };

  try {
    const result = await executeQuery(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    res.json(result.rows);
  } catch (err) {
    console.error(`Error in /api/services/search?query=${searchTerm} route:`, err.message);
    res.status(500).json({ error: 'Failed to perform search', details: err.message });
  }
});

// ---------------------- Authentication Routes ----------------------

// Register new user with email and mobile number
app.post('/api/register', async (req, res) => {
  const { username, email, password, mobileNumber } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required.' });
  }

  try {
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Check if username OR email already exists
    const checkUserSql = `SELECT COUNT(*) AS COUNT FROM APP_USERS WHERE USERNAME = :username OR EMAIL = :email`;
    const checkUserBinds = { username: username, email: email };
    const checkUserResult = await executeQuery(checkUserSql, checkUserBinds, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    if (checkUserResult.rows[0].COUNT > 0) {
      return res.status(409).json({ message: 'Username or email already exists. Please choose another one.' });
    }

    // Insert new user into APP_USERS table
    const insertUserSql = `INSERT INTO APP_USERS (USERNAME, EMAIL, PASSWORD_HASH, MOBILE_NUMBER) VALUES (:username, :email, :passwordHash, :mobileNumber)`;
    const insertUserBinds = {
      username: username,
      email: email,
      passwordHash: passwordHash,
      mobileNumber: mobileNumber || null // Use null if mobileNumber is not provided
    };
    const insertUserOptions = { autoCommit: true };

    await executeQuery(insertUserSql, insertUserBinds, insertUserOptions);

    res.status(201).json({ message: 'User registered successfully!' });
  } catch (err) {
    console.error('Error during user registration:', err);
    res.status(500).json({ message: 'Failed to register user.', details: err.message });
  }
});

// Login user (still uses username and password)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    // Retrieve user from APP_USERS table
    const getUserSql = `SELECT ID, USERNAME, PASSWORD_HASH FROM APP_USERS WHERE USERNAME = :username`;
    const getUserBinds = { username: username };
    const getUserResult = await executeQuery(getUserSql, getUserBinds, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    if (getUserResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const user = getUserResult.rows[0];
    // Compare provided password with stored hash
    const isMatch = await bcrypt.compare(password, user.PASSWORD_HASH);

    if (isMatch) {
      res.status(200).json({ message: 'Login successful!', username: user.USERNAME, userId: user.ID });
    } else {
      res.status(401).json({ message: 'Invalid username or password.' });
    }
  } catch (err) {
    console.error('Error during user login:', err);
    res.status(500).json({ message: 'Failed to log in.', details: err.message });
  }
});


// Generic route to handle requests for the root URL
app.get('/', (req, res) => {
  res.send('Varadhi Services Backend API is running!');
});

// Start the server after initializing the Oracle connection pool
initializeOraclePool().then(() => {
  app.listen(port, () => {
    console.log(`🌐 Backend server listening at http://localhost:${port}`);
    console.log('Ready to receive requests from frontend.');
  });
});

// Graceful shutdown: release the pool when the app closes
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM signal: closing Oracle connection pool...');
  try {
    const pool = oracledb.getPool('myOraclePool');
    if (pool) {
      await pool.close(10);
      console.log('✅ Oracle connection pool closed.');
    } else {
      console.log('Oracle connection pool was not active.');
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR: Failed to close Oracle connection pool gracefully:', err);
    process.exit(1);
  }
});
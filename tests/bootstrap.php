<?php
// PHPUnit bootstrap for Coinsider.
//
// The API is a set of plain functions in api/db.php that talk to a SQLite
// database via the Database singleton. To test them in isolation we point the
// database at an in-memory SQLite instance and reset it between tests
// (see DatabaseTestCase). No HTTP server, session, or on-disk DB is involved.

// api/config.php reads $_SERVER['REQUEST_METHOD'] directly in its CORS block;
// seed it so requiring the file under CLI doesn't trip an "undefined key" notice.
$_SERVER['REQUEST_METHOD'] = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Route every DB connection to a private in-memory database. Each new PDO
// connection to ':memory:' is a fresh, empty database — perfect for isolation.
putenv('COINSIDER_DB_PATH=:memory:');

require __DIR__ . '/../vendor/autoload.php';

// db.php / config.php expose functions (not autoloadable classes), so require
// them explicitly. config.php is pulled in transitively by db.php.
require __DIR__ . '/../api/db.php';

require __DIR__ . '/DatabaseTestCase.php';

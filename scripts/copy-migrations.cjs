const { cpSync } = require('node:fs');
cpSync('src/database/migrations/001-initial.up.sql', 'dist/database/migrations/001-initial.up.sql');
cpSync(
  'src/database/migrations/001-initial.down.sql',
  'dist/database/migrations/001-initial.down.sql',
);

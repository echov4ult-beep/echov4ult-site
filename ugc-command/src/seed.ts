import { loadConfig } from './config.js';
import { openDatabase } from './db.js';
import { seedDatabase } from './seed-data.js';
const db = openDatabase(loadConfig().databasePath);
seedDatabase(db);
console.log('UGC Command seed is ready.');
db.close();

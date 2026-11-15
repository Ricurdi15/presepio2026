import { getDb } from '../server/db.js';
import { makeHandlers } from '../server/handlers.js';

export default makeHandlers(getDb).game;

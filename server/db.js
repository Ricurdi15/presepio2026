import { MongoClient } from 'mongodb';

// Connessione riusata tra le invocazioni della stessa istanza serverless.
export function getDb() {
  if (!globalThis.__runnerDb) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI mancante');
    const client = new MongoClient(uri, { maxPoolSize: 5, maxIdleTimeMS: 5000 });
    globalThis.__runnerDb = client
      .connect()
      .then(async (c) => {
        const db = c.db(process.env.MONGODB_DB || 'endless_runner');
        await db.collection('users').createIndex({ usernameLower: 1 }, { unique: true });
        await db.collection('users').createIndex({ best: -1 });
        await db.collection('games').createIndex({ at: -1 });
        return db;
      })
      .catch((e) => {
        globalThis.__runnerDb = undefined;   // al prossimo tentativo riprova
        throw e;
      });
  }
  return globalThis.__runnerDb;
}

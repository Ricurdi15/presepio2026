import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

const USERNAME_RE = /^[A-Za-z0-9_-]{3,16}$/;
const MAX_POINTS_PER_SEC = 250;   // soglia di plausibilita' (controllo grossolano, non e' anti-cheat vero)
const DUMMY_HASH = bcrypt.hashSync('password-finta', 10);

function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

function readBody(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return {};
}

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('JWT_SECRET mancante o troppo corto');
  return s;
}

function sign(user) {
  return jwt.sign({ sub: String(user._id), name: user.username }, secret(), { expiresIn: '30d' });
}

function verifyHeader(header) {
  if (!header.startsWith('Bearer ')) return null;
  try { return jwt.verify(header.slice(7), secret()); } catch { return null; }
}

function validateCreds(username, password) {
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return 'Nome utente: 3-16 caratteri (lettere, numeri, _ e -)';
  }
  if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password) > 72) {
    return 'Password: da 6 a 72 caratteri';
  }
  return null;
}

const safe = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Errore del server' });
  }
};

/** getDb e' iniettato cosi' la logica si puo' testare senza MongoDB. */
export function makeHandlers(getDb) {
  const register = safe(async (req, res) => {
    if (req.method !== 'POST') return send(res, 405, { error: 'Metodo non consentito' });
    const { username, password } = readBody(req);
    const err = validateCreds(username, password);
    if (err) return send(res, 400, { error: err });

    const db = await getDb();
    const doc = {
      username,
      usernameLower: username.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
      best: 0,
      bestAt: null,
      createdAt: new Date(),
    };
    try {
      doc._id = (await db.collection('users').insertOne(doc)).insertedId;
    } catch (e) {
      if (e && e.code === 11000) return send(res, 409, { error: 'Nome utente gia in uso' });
      throw e;
    }
    send(res, 201, { token: sign(doc), username, best: 0 });
  });

  const login = safe(async (req, res) => {
    if (req.method !== 'POST') return send(res, 405, { error: 'Metodo non consentito' });
    const { username, password } = readBody(req);
    if (typeof username !== 'string' || typeof password !== 'string') {
      return send(res, 400, { error: 'Dati mancanti' });
    }
    const db = await getDb();
    const user = await db.collection('users').findOne({ usernameLower: username.trim().toLowerCase() });
    // si confronta sempre un hash, cosi' i tempi non rivelano se l'utente esiste
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) return send(res, 401, { error: 'Credenziali non valide' });
    send(res, 200, { token: sign(user), username: user.username, best: user.best ?? 0 });
  });

  // Ogni partita viene registrata (anche quella degli ospiti). Solo gli utenti loggati
  // aggiornano il proprio record in classifica.
  const game = safe(async (req, res) => {
    if (req.method !== 'POST') return send(res, 405, { error: 'Metodo non consentito' });
    const b = readBody(req);
    const score = b.score;
    const dur = b.durationSec;
    if (!Number.isInteger(score) || score < 0 || score > 1_000_000) return send(res, 400, { error: 'Punteggio non valido' });
    if (typeof dur !== 'number' || !Number.isFinite(dur) || dur < 0 || dur > 86_400) return send(res, 400, { error: 'Durata non valida' });

    const db = await getDb();
    const users = db.collection('users');

    const header = req.headers.authorization || '';
    let authError = false;
    let user = null;
    if (header) {
      const auth = verifyHeader(header);
      if (auth) {
        try { user = await users.findOne({ _id: new ObjectId(auth.sub) }); } catch { user = null; }
      }
      if (!user) authError = true;   // token scaduto o utente inesistente: il client deve rifare il login
    }

    const suspicious = score > 100 + dur * MAX_POINTS_PER_SEC;
    const guestName = typeof b.name === 'string' ? b.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) : '';

    await db.collection('games').insertOne({
      userId: user ? user._id : null,
      name: user ? user.username : guestName || 'Ospite',
      guest: !user,
      score,
      durationSec: Math.round(dur),
      reachedTarget: b.reachedTarget === true,
      suspicious,
      at: new Date(),
    });

    let best = user ? (user.best ?? 0) : 0;
    let isRecord = false;
    if (user && !suspicious && score > best) {
      const r = await users.updateOne(
        { _id: user._id, $or: [{ best: { $lt: score } }, { best: { $exists: false } }] },
        { $set: { best: score, bestAt: new Date() } },
      );
      if (r.modifiedCount === 1) {
        best = score;
        isRecord = true;
      }
    }
    send(res, 200, { guest: !user, best, isRecord, authError });
  });

  const leaderboard = safe(async (req, res) => {
    if (req.method !== 'GET') return send(res, 405, { error: 'Metodo non consentito' });
    const db = await getDb();
    const rows = await db
      .collection('users')
      .find({ best: { $gt: 0 } })
      .sort({ best: -1, bestAt: 1 })
      .limit(10)
      .project({ username: 1, best: 1 })
      .toArray();
    send(res, 200, { rows: rows.map((r) => ({ name: r.username, score: r.best })) });
  });

  return { register, login, game, leaderboard };
}

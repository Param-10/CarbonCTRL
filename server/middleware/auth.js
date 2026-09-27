import jwt from 'jsonwebtoken';
import { usersRepo } from '../db/repos.js';

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // A 2FA challenge proves only the first factor. It must never authorize
    // ordinary API requests, even when the account's tokenVersion is zero.
    if (decoded.purpose) {
      return res.status(401).json({ error: 'Complete two-factor authentication first.' });
    }
    const user = await usersRepo.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    // tokenVersion is bumped whenever the password changes (or is discarded
    // during Google linking), so any session issued before that must die.
    const tokenVersion = decoded.tokenVersion || 0;
    const userVersion = user.tokenVersion || 0;
    if (tokenVersion !== userVersion) {
      return res.status(401).json({
        error: 'Session has been invalidated. Please sign in again.',
      });
    }

    // Attach a plain, password-stripped user object plus the numeric id.
    req.user = usersRepo.toSafeUser(user);
    req.userId = user.id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    res.status(500).json({ error: 'Server error during authentication.' });
  }
};

export default auth;

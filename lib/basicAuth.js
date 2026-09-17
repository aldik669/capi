const crypto = require('crypto');

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function basicAuth({ username, password, realm = 'Admin' }) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');

    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const separatorIndex = decoded.indexOf(':');
      const providedUser = decoded.slice(0, separatorIndex);
      const providedPass = decoded.slice(separatorIndex + 1);

      if (timingSafeEqual(providedUser, username) && timingSafeEqual(providedPass, password)) {
        return next();
      }
    }

    res.set('WWW-Authenticate', `Basic realm="${realm}"`);
    return res.status(401).send('Authentication required');
  };
}

module.exports = { basicAuth };

const IdempotencyKey = require('../models/IdempotencyKey');

const idempotencyMiddleware = (endpoints = []) => {
  return async (req, res, next) => {
    console.log('[IDEMPOTENCY] Middleware called for:', req.method, req.path);

    // Only apply to specified endpoints or POST/PUT/PATCH by default
    if (endpoints.length > 0 && !endpoints.includes(req.path)) {
      console.log('[IDEMPOTENCY] Skipping - endpoint not in list');
      return next();
    }

    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      console.log('[IDEMPOTENCY] Skipping - method not POST/PUT/PATCH');
      return next();
    }

    const idempotencyKey = req.headers['idempotency-key'];
    console.log('[IDEMPOTENCY] Idempotency key:', idempotencyKey || 'NOT PROVIDED');

    if (!idempotencyKey) {
      console.log('[IDEMPOTENCY] No key provided, passing to next middleware');
      return next();
    }

    try {
      console.log('[IDEMPOTENCY] Checking for existing key...');
      // Check if key exists
      const existing = await IdempotencyKey.get(idempotencyKey);
      console.log('[IDEMPOTENCY] Existing key found:', !!existing);

      if (existing) {
        console.log('[IDEMPOTENCY] Returning cached response');
        // Return cached response
        return res.status(existing.status_code).json(existing.response);
      }

      console.log('[IDEMPOTENCY] No cached response, overriding res.json');
      // Store original res.json
      const originalJson = res.json.bind(res);

      // Override res.json to cache response
      res.json = function (data) {
        const statusCode = res.statusCode || 200;

        console.log('[IDEMPOTENCY] Caching response for key:', idempotencyKey);
        // Cache the response
        IdempotencyKey.create({
          key: idempotencyKey,
          userId: req.user?.userId || null,
          endpoint: req.path,
          response: data,
          statusCode
        }).catch(err => console.error('Idempotency cache error:', err));

        // Send response
        return originalJson(data);
      };

      console.log('[IDEMPOTENCY] Passing to next middleware');
      next();
    } catch (error) {
      console.error('[IDEMPOTENCY] ERROR:', error.message);
      next();
    }
  };
};

module.exports = idempotencyMiddleware;

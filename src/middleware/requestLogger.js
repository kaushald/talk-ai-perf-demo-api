const { Counter, Histogram } = require('prom-client');

// Prometheus metrics
const httpRequestCounter = new Counter({
  name: 'demo_app_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const httpRequestDuration = new Histogram({
  name: 'demo_app_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

module.exports = function requestLogger(logger) {
  return (req, res, next) => {
    const start = Date.now();
    const startHrTime = process.hrtime();

    // Log request
    logger.info({
      event: 'request_received',
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Capture response
    const originalSend = res.send;
    res.send = function(data) {
      res.send = originalSend;
      const duration = Date.now() - start;
      const hrDuration = process.hrtime(startHrTime);
      const durationInSeconds = hrDuration[0] + hrDuration[1] / 1e9;

      // Log response
      logger.info({
        event: 'request_completed',
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: duration,
        contentLength: res.get('content-length')
      });

      // Update Prometheus metrics
      const route = req.route ? req.route.path : req.url;
      httpRequestCounter.inc({
        method: req.method,
        route: route,
        status: res.statusCode
      });

      httpRequestDuration.observe({
        method: req.method,
        route: route,
        status: res.statusCode
      }, durationInSeconds);

      return originalSend.call(this, data);
    };

    next();
  };
};
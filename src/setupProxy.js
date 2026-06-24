/* Dev-only proxy. Routes /api and /markup-files to the backend so the Markup iframe
   loads SAME-ORIGIN (the string "proxy" in package.json skips text/html navigations,
   which breaks iframe loads — this proxies everything regardless of Accept header). */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    ['/api', '/markup-files'],
    createProxyMiddleware({ target: 'http://localhost:4000', changeOrigin: true })
  );
};

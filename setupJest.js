global.fetch = require('jest-fetch-mock');

process.on('unhandledRejection', (reason, promise) => {
  console.log('unhandledRejection', reason, promise);
});

const path = require('path');

module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  roots: [
    path.join(__dirname, 'tests'),
    path.join(__dirname, 'src'),
  ],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: [path.join(__dirname, 'tests/setup.env.js')],
  collectCoverageFrom: ['src/**/*.js'],
  coverageReporters: ['html', 'text', 'lcov'],
  coverageDirectory: path.join(__dirname, 'coverage'),
};

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testTimeout: 30000,
  // Los tests pegan contra Postgres/Redis reales (locales) -- correr en
  // un solo worker evita que dos suites pisen las mismas filas de
  // beds/reservations al mismo tiempo.
  maxWorkers: 1,
  setupFiles: ['dotenv/config'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};

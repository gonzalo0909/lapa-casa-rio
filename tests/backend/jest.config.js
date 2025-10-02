// lapa-casa-hostel/tests/backend/jest.config.js

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '../../',
  testMatch: [
    '<rootDir>/tests/backend/**/*.test.ts'
  ],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/backend/src/$1'
  },

  setupFilesAfterEnv: [
    '<rootDir>/tests/backend/test-setup.ts'
  ],

  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },

  collectCoverageFrom: [
    'backend/src/**/*.ts',
    '!backend/src/**/*.d.ts',
    '!backend/src/server.ts',
    '!backend/src/types/**'
  ],

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],

  testTimeout: 15000,

  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  },

  moduleFileExtensions: [
    'ts',
    'js',
    'json'
  ],

  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  verbose: true,

  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  maxWorkers: '50%',

  coverageDirectory: '<rootDir>/coverage/backend'
};

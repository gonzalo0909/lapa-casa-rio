// lapa-casa-hostel/tests/frontend/jest.config.js

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  rootDir: '../../',
  testMatch: [
    '<rootDir>/tests/frontend/**/*.test.{ts,tsx}'
  ],
  
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/frontend/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/frontend/__mocks__/fileMock.js'
  },

  setupFilesAfterEnv: [
    '<rootDir>/tests/frontend/test-setup.ts',
    '@testing-library/jest-dom'
  ],

  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },

  collectCoverageFrom: [
    'frontend/src/**/*.{ts,tsx}',
    '!frontend/src/**/*.d.ts',
    '!frontend/src/**/*.stories.{ts,tsx}',
    '!frontend/src/app/**',
    '!frontend/src/types/**'
  ],

  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],

  testTimeout: 10000,

  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  },

  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],

  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  verbose: true,

  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};

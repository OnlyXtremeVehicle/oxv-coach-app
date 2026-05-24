/**
 * Configuration Jest minimaliste pour la business logic pure OXV Coach.
 *
 * Périmètre testé :
 *   - src/ubx/  (parser UBX)
 *   - src/utils/ (geo, validation, lapDetection)
 *   - src/types/state.ts (state machine)
 *   - src/types/domain.ts (helpers métier)
 *
 * Volontairement hors-périmètre Jest :
 *   - composants React Native (testés manuellement en build dev)
 *   - hooks Zustand (couverts par les tests de leurs deps pures)
 *   - services BLE/Supabase (testés via fixtures et builds réels)
 *
 * On utilise ts-jest pour ne pas hériter du preset jest-expo qui
 * embarquerait toute la chaîne native — superflu pour du JS pur.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/ubx/**/*.ts',
    'src/utils/**/*.ts',
    'src/types/state.ts',
    'src/types/domain.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 70,
      statements: 70,
      branches: 60,
      functions: 70,
    },
  },
};

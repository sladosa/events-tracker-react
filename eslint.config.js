import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // /!\ `Claude-temp_R/` drzi CIJELE stare kopije projekta (radni stol, gitignoriran).
  //     ESLint 9 NE cita `.gitignore`, pa ih je do S139 lintao kao da su izvor:
  //     od 189 prijavljenih problema 142 (75%) dolazilo je odande. Posljedica nije
  //     bila sum nego KRIVA DIJAGNOZA -- audit je 76 `react-hooks` nalaza pripisao
  //     zivom kodu, a ziv je 25; `DateRangeFilter.tsx` je izgledao kao najgori file,
  //     a u njemu ih danas nema nijedan.
  globalIgnores(['dist', 'Claude-temp_R', 'test-results', 'e2e/test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])

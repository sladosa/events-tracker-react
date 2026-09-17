import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  {
    // /!\ MRTVA `eslint-disable` DIREKTIVA NIJE SUM NEGO SLIJEPA MRLJA.
    //     ESLint 9 ih po defaultu prijavljuje kao `warn`, a upozorenja ovdje nitko
    //     nije citao 7 mjeseci: u S139 su nadjene 5, i jedna je skrivala PRAVI nalaz
    //     (`react-hooks/immutability` u `ViewDetailsPage`) -- jer plugin preskoci
    //     cijeli efekt koji nosi disable za BILO KOJE `react-hooks` pravilo.
    //     Od S139 `disable` s obrazlozenjem je legitiman alat (v. § Zamke), pa mora
    //     postojati i brana koja javi kad obrazlozenje vise ne opisuje stvarnost.
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
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
    rules: {
      // Podvlaka je u ovoj bazi koda VEC signal za „namjerno neiskoristeno"
      // (`_userId`, `_attrDefs`, `_setRenderError`). Do S139 ESLint to nije znao,
      // pa je 7 takvih prijavljivao kao mrtav kod.
      // /!\ „Popravak" brisanjem bio bi GORI od nalaza: `_userId` i `_attrDefs` su
      //     PARAMETRI, pa bi brisanje mijenjalo potpise funkcija zbog lint poruke.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    // Context fileovi POSTOJE da izvezu par Provider + hook (`FilterProvider` +
    // `useFilter`, `HelpProvider` + `useHelp`) -- to je standardni React idiom.
    // Pravilo ondje trazi da se hook izdvoji u zaseban file; dobitak je samo brzi
    // HMR u devu, cijena je razbijanje idioma. Gasi se za te fileove, ne globalno.
    files: ['src/context/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])

/**
 * theme.ts – Centralna konfiguracija boja
 * =========================================
 * Sve boje za Add / Edit / View stranice definiraju se OVDJE.
 * Komponente čitaju boje iz ovog objekta – nikakve hardkodirane klase.
 *
 * KAKO MIJENJATI BOJE:
 *   1. Otvori tailwindcss.com/docs/customizing-colors za vizualni pregled
 *   2. Odaberi nijansu (50-950)
 *   3. Promijeni string ovdje (mora biti kompletan Tailwind razred, npr. 'bg-blue-600')
 *   4. Tailwind ne podržava dinamičke klase (bg-${color}-600), zato su strings ovdje statični
 *
 * STRUKTURA:
 *   headerBg      – pozadina sticky headera
 *   headerText    – tekst u headeru (breadcrumb, duration)
 *   headerBorder  – linija ispod headera
 *   accent        – primarni button u headeru (Save / Edit)
 *   accentHover   – hover state primarnog buttona
 *   cancelBtn     – X button u headeru
 *   deleteBtn     – delete / trash button
 *   light         – lagana pozadina sekcija (session info banner)
 *   lightBorder   – border sekcija
 *   lightText     – tekst u laganim sekcijama
 *   spinner       – border boja loading spinnera
 *   ring          – focus ring na input poljima
 */

export const THEME = {
  add: {
    headerBg:     'bg-blue-600',
    headerText:   'text-white',
    headerBorder: 'border-blue-700',
    accent:       'bg-white text-blue-700 hover:bg-blue-50',
    cancelBtn:    'bg-blue-500 hover:bg-blue-700 text-white',
    deleteBtn:    'bg-red-500 hover:bg-red-600 text-white',
    light:        'bg-blue-50',
    lightBorder:  'border-blue-100',
    lightText:    'text-blue-800',
    spinner:      'border-blue-600',
    ring:         'focus:ring-blue-500',
  },
  edit: {
    headerBg:     'bg-amber-600',
    headerText:   'text-white',
    headerBorder: 'border-amber-700',
    accent:       'bg-white text-amber-700 hover:bg-amber-50',
    cancelBtn:    'bg-amber-500 hover:bg-amber-700 text-white',
    deleteBtn:    'bg-red-500 hover:bg-red-600 text-white',
    light:        'bg-amber-50',
    lightBorder:  'border-amber-100',
    lightText:    'text-amber-800',
    spinner:      'border-amber-600',
    ring:         'focus:ring-amber-500',
  },
  view: {
    headerBg:     'bg-indigo-700',
    headerText:   'text-white',
    headerBorder: 'border-indigo-800',
    accent:       'bg-white text-indigo-700 hover:bg-indigo-50',
    cancelBtn:    'bg-indigo-600 hover:bg-indigo-800 text-white',
    deleteBtn:    'bg-red-500 hover:bg-red-600 text-white',
    light:        'bg-indigo-50',
    lightBorder:  'border-indigo-100',
    lightText:    'text-indigo-800',
    spinner:      'border-indigo-600',
    ring:         'focus:ring-indigo-500',
  },
} as const;

export type PageMode = keyof typeof THEME;
export type PageTheme = typeof THEME[PageMode];

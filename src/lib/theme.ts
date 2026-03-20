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
  // Structure Edit panel theme — amber, independent from global 'edit' and from 'structure'.
  // Used by StructureNodeEditPanel only. Change here to restyle without affecting other pages.
  structureEdit: {
    headerBg:     'bg-amber-500',
    headerText:   'text-white',
    headerBorder: 'border-amber-600',
    accent:       'bg-white text-amber-700 hover:bg-amber-50',
    cancelBtn:    'bg-amber-400 hover:bg-amber-600 text-white',
    deleteBtn:    'bg-red-500 hover:bg-red-600 text-white',
    light:        'bg-amber-50',
    lightBorder:  'border-amber-200',
    lightText:    'text-amber-800',
    spinner:      'border-amber-500',
    ring:         'focus:ring-amber-500',
  },
  // Structure tab theme — independent from 'view' so it can be changed separately.
  // Colour: indigo/purple. Edit here only; never hardcode in structure components.
  structure: {
    headerBg:      'bg-indigo-600',
    headerText:    'text-white',
    headerBorder:  'border-indigo-700',
    accent:        'bg-white text-indigo-600 hover:bg-indigo-50',
    cancelBtn:     'bg-indigo-500 hover:bg-indigo-700 text-white',
    deleteBtn:     'bg-red-500 hover:bg-red-600 text-white',
    light:         'bg-indigo-50',
    lightBorder:   'border-indigo-200',
    lightText:     'text-indigo-800',
    spinner:       'border-indigo-500',
    ring:          'focus:ring-indigo-500',
    // Structure-specific tokens
    rowArea:       'bg-indigo-50 border-l-4 border-indigo-400',
    rowL1:         'bg-white border-l-4 border-indigo-300',
    rowL2:         'bg-white border-l-4 border-indigo-200',
    rowDeep:       'bg-white border-l-4 border-indigo-100',
    rowLeaf:       'bg-white border-l-4 border-emerald-300',
    badgeAttrs:    'bg-indigo-100 text-indigo-700',
    badgeLeaf:     'bg-emerald-100 text-emerald-700',
    btnExport:     'bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700',
    btnEditMode:   'bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300',
    btnViewSwitch: 'bg-indigo-100 text-indigo-700',
  },
} as const;

export type PageMode = keyof typeof THEME;
export type PageTheme = typeof THEME[PageMode];
export type StructureTheme = typeof THEME['structure'];
export type StructureEditTheme = typeof THEME['structureEdit'];

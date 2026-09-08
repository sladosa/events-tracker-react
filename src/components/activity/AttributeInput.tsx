import { useState, useMemo, useEffect, useRef } from 'react';
import type { AttributeDefinition, DataType } from '@/types';
import { parseValidationRules, getOptionsForDependency } from '@/hooks/useAttributeDefinitions';
import { parseAmountInput } from '@/lib/amountFormat';

interface AttributeInputProps {
  definition: AttributeDefinition;
  value: string | number | boolean | null;
  onChange: (value: string | number | boolean | null) => void;
  onTouched?: () => void;
  disabled?: boolean;
  // Za dependency
  dependencyValue?: string | null;
  className?: string;
  // Callback kada korisnik unese novu "Other" vrijednost — parent je zadužen za persist
  onNewOption?: (definitionId: string, newOption: string, dependencyValue?: string | null) => void;
}

export function AttributeInput({
  definition,
  value,
  onChange,
  onTouched,
  disabled,
  dependencyValue,
  className = '',
  onNewOption,
}: AttributeInputProps) {
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherValue, setOtherValue] = useState('');

  // Parse validation rules
  const parsedOptions = useMemo(() => 
    parseValidationRules(definition.validation_rules),
    [definition.validation_rules]
  );

  // Get options based on dependency
  const options = useMemo(() => 
    getOptionsForDependency(parsedOptions, dependencyValue || null),
    [parsedOptions, dependencyValue]
  );

  const hasOptions = options.length > 0;
  const hasDependency = !!parsedOptions.dependsOn;
  // FIX: Show dropdown for suggest/enum types, OR when there's a dependency
  // (dependency dropdowns may have 0 options until the parent is selected)
  const showDropdown = (hasOptions || hasDependency) && 
    (parsedOptions.type === 'suggest' || parsedOptions.type === 'enum');

  // Handle change
  const handleChange = (newValue: string | number | boolean | null) => {
    onChange(newValue);
    onTouched?.();
  };

  // Handle "Other" selection
  const handleOtherSelect = () => {
    setShowOtherInput(true);
    setOtherValue('');
  };

  const handleOtherConfirm = () => {
    const trimmed = otherValue.trim();
    if (!trimmed) return;

    handleChange(trimmed);
    setShowOtherInput(false);
    onNewOption?.(definition.id, trimmed, dependencyValue);
  };

  const handleOtherCancel = () => {
    setShowOtherInput(false);
    setOtherValue('');
  };

  // Render based on data type
  const renderInput = () => {
    const dataType = definition.data_type as DataType;

    // Boolean - checkbox
    if (dataType === 'boolean') {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => handleChange(e.target.checked)}
            disabled={disabled}
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            {value === true ? 'Yes' : value === false ? 'No' : 'Not set'}
          </span>
        </label>
      );
    }

    // Number
    if (dataType === 'number') {
      return (
        <NumberInput
          value={typeof value === 'number' ? value : null}
          unit={definition.unit}
          disabled={disabled}
          placeholder={definition.default_value || ''}
          onChange={handleChange}
        />
      );
    }

    // Datetime
    if (dataType === 'datetime') {
      return (
        <input
          type="datetime-local"
          value={value ? String(value).slice(0, 16) : ''}
          onChange={(e) => handleChange(e.target.value || null)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
        />
      );
    }

    // Text with dropdown (suggest/enum)
    if (dataType === 'text' && showDropdown) {
      // Dependency not yet selected - show disabled dropdown with hint
      if (hasDependency && !dependencyValue) {
        return (
          <div className="space-y-1">
            <select
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-100 text-gray-500"
            >
              <option>Select {parsedOptions.dependsOn?.attributeSlug?.replace(/_/g, ' ')} first...</option>
            </select>
            <p className="text-xs text-amber-600">
              ⚠️ Depends on: {parsedOptions.dependsOn?.attributeSlug}
            </p>
          </div>
        );
      }

      // "Other" input modal
      if (showOtherInput && parsedOptions.allowOther) {
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={otherValue}
              onChange={(e) => setOtherValue(e.target.value)}
              placeholder="Enter custom value..."
              autoFocus
              className="w-full px-3 py-2 border border-blue-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleOtherConfirm}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={handleOtherCancel}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      }

      // Dropdown
      const currentValueStr = value != null ? String(value) : '';
      const currentValueInOptions = !!currentValueStr && options.includes(currentValueStr);
      const isCustomValue = !!currentValueStr && !currentValueInOptions;

      return (
        <div className="space-y-1">
          <select
            value={currentValueStr}
            onChange={(e) => {
              if (e.target.value === '__other__') {
                handleOtherSelect();
              } else {
                handleChange(e.target.value || null);
              }
            }}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          >
            <option value="">Select {definition.name}...</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            {/* DROPDOWN-1: custom vrijednost prikazana kao normalna opcija */}
            {isCustomValue && (
              <option key="__custom__" value={currentValueStr}>
                {currentValueStr}
              </option>
            )}
            {parsedOptions.allowOther && (
              <option value="__other__">Other...</option>
            )}
          </select>
        </div>
      );
    }

    // Default: text input
    return (
      <input
        type={dataType === 'link' ? 'url' : 'text'}
        value={typeof value === 'boolean' ? String(value) : (value ?? '')}
        onChange={(e) => handleChange(e.target.value || null)}
        disabled={disabled}
        placeholder={definition.default_value || ''}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
      />
    );
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {definition.name}
        {definition.is_required && <span className="text-red-500 ml-1">*</span>}
        {definition.unit && (
          <span className="font-normal text-gray-400 ml-1">({definition.unit})</span>
        )}
        {/* Hint inline for compact view */}
        {definition.description && (
          <span className="font-normal text-gray-400 ml-2 text-xs">
            {definition.description}
          </span>
        )}
      </label>
      
      {renderInput()}

    </div>
  );
}

// ============================================================
// NumberInput — decimalni ZAREZ, i unos koji ne nestaje u tišini
// ============================================================
// ZAŠTO NE <input type="number">
//   Njegov decimalni separator bira LOKALIZACIJA PREGLEDNIKA, ne aplikacija —
//   pa se isti build drukčije ponaša na Kokinom mobitelu i na en-US desktopu.
//   Gore od nedosljednosti: kad preglednik odbije utipkani znak, `e.target.value`
//   je `''`, a stari kod je to mapirao u `null`. Iznos utipkan kao `1389,52`
//   mogao je tiho postati prazan, bez ijedne poruke. Isti razred kao sve ostalo
//   ovdje — zato je neprepoznat unos sada VIDLJIV (crveno), a ne prazan.
//
// ŠTO POLJE PRIKAZUJE
//   Točno spremljenu vrijednost, samo sa zarezom. Bez grupiranja tisućica (u
//   polju za unos ih moraš brisati da bi pretipkao), bez zaokruživanja i bez
//   dopunjenih nula. Zaokruživanje u prikazu prije ili kasnije zaokruži i pri
//   spremanju, a `7,123` je legitimna vrijednost za nešto što nije novac.
//   Formatiranje novca (2 decimale) živi ondje gdje se za novac ZNA — u ulogama
//   kolona liste (`amount`/`pair`/`balance`), ne u generičkom polju za broj.
// ============================================================

/** Broj → tekst kakav se upisuje: zarez, bez tisućica, bez ijedne izmišljene
 *  ili odrezane znamenke (`maximumFractionDigits: 20` da prikaz nikad ne laže). */
function toRaw(n: number | null): string {
  if (n == null) return '';
  // ⚠ `hr-HR` piše minus kao U+2212 (−), a to nije znak koji se tipka na
  //   tipkovnici. U polju za UNOS mora stajati obični `-`, inače korisnik
  //   uređuje vrijednost koju ne može ponovno utipkati.
  return n
    .toLocaleString('hr-HR', { useGrouping: false, maximumFractionDigits: 20 })
    .replace(/−/g, '-');
}

function NumberInput({
  value, unit, disabled, placeholder, onChange,
}: {
  value: number | null;
  unit?: string | null;
  disabled?: boolean;
  placeholder?: string;
  onChange: (v: number | null) => void;
}) {
  const [raw, setRaw] = useState(() => toRaw(value));
  // Zadnja vrijednost koju je OVO polje poslalo van. Bez nje bi sinkronizacija
  // pojela zarez u trenutku kad se utipka: `1389,` se već parsira u 1389, pa bi
  // se polje samo prepisalo u `1389` i korisnik ne bi mogao utipkati decimale.
  const emitted = useRef<number | null>(value);

  // Sinkroniziraj SAMO kad vrijednost dođe izvana — učitavanje retka u Editu,
  // preset, `set_attribute`.
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setRaw(toRaw(value));
    }
  }, [value]);

  // `-` ili `,` sami po sebi nisu greška nego pola utipkanog broja — crveni
  // rub koji bljesne na svakom negativnom iznosu nauči se ignorirati.
  const trimmed = raw.trim();
  const transitional = /^-?[.,]?$/.test(trimmed);
  const invalid = trimmed !== '' && !transitional && parseAmountInput(raw) === null;

  const handle = (text: string) => {
    setRaw(text);
    const parsed = text.trim() === '' ? null : parseAmountInput(text);
    emitted.current = parsed;
    onChange(parsed);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={(e) => handle(e.target.value)}
          disabled={disabled}
          placeholder={placeholder || ''}
          aria-invalid={invalid || undefined}
          className={`flex-1 px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 disabled:bg-gray-100 ${
            invalid
              ? 'border-red-400 focus:ring-red-500 focus:border-red-500 text-red-700'
              : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
          }`}
        />
        {unit && (
          <span className="text-sm text-gray-500 min-w-[3rem]">{unit}</span>
        )}
      </div>
      {invalid && (
        <p className="mt-1 text-xs text-red-600">
          Ne mogu pročitati broj — polje se sprema kao prazno. Npr. 1389,52
        </p>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import type { AttributeDefinition, DataType } from '@/types';
import { parseValidationRules, getOptionsForDependency } from '@/hooks/useAttributeDefinitions';

interface AttributeInputProps {
  definition: AttributeDefinition;
  value: string | number | boolean | null;
  onChange: (value: string | number | boolean | null) => void;
  onTouched?: () => void;
  disabled?: boolean;
  // Za dependency
  dependencyValue?: string | null;
  className?: string;
}

export function AttributeInput({
  definition,
  value,
  onChange,
  onTouched,
  disabled,
  dependencyValue,
  className = '',
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
  const showDropdown = hasOptions && (parsedOptions.type === 'suggest' || parsedOptions.type === 'enum');

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
    if (otherValue.trim()) {
      handleChange(otherValue.trim());
      setShowOtherInput(false);
    }
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
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={typeof value === 'boolean' ? '' : (value ?? '')}
            onChange={(e) => {
              const num = e.target.value === '' ? null : parseFloat(e.target.value);
              handleChange(num);
            }}
            disabled={disabled}
            placeholder={definition.default_value || ''}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          />
          {definition.unit && (
            <span className="text-sm text-gray-500 min-w-[3rem]">
              {definition.unit}
            </span>
          )}
        </div>
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
      const currentValueInOptions = options.includes(String(value));
      const isCustomValue = value && !currentValueInOptions;

      return (
        <div className="space-y-1">
          <select
            value={isCustomValue ? '__other__' : (typeof value === 'boolean' ? '' : (value ?? ''))}
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
            {parsedOptions.allowOther && (
              <option value="__other__">Other...</option>
            )}
            {isCustomValue && (
              <option value="__other__" disabled>
                Custom: {String(value)}
              </option>
            )}
          </select>
          {isCustomValue && (
            <p className="text-xs text-blue-600">
              Custom value: {String(value)}
            </p>
          )}
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
      </label>
      
      {renderInput()}
      
      {definition.description && (
        <p className="text-xs text-gray-500">{definition.description}</p>
      )}

      {/* Dependency info za debug */}
      {parsedOptions.dependsOn && (
        <p className="text-xs text-gray-400">
          Depends on: {parsedOptions.dependsOn.attributeSlug}
          {dependencyValue && ` (${dependencyValue})`}
        </p>
      )}
    </div>
  );
}

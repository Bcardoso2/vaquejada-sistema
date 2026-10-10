import React from 'react';

interface FormInputProps {
  label: string;
  type?: string;
  value?: string | number;
  onChange?: (e: any) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  children?: React.ReactNode;
}

export function FormInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  error,
  disabled = false,
  multiline = false,
  rows = 3,
  min,
  max,
  step,
  children
}: FormInputProps) {
  const handleChange = (e: any) => {
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className="mb-4">
      <label className={`block text-sm font-medium text-gray-700 mb-1 ${required ? 'text-gray-900 font-semibold' : ''}`}>
        {label}
        {required && <span className="ml-1 text-xs text-red-500">*</span>}
      </label>
      {children ? (
        children
      ) : multiline ? (
        <textarea
          className={`block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900 ${
            disabled ? 'bg-gray-50' : ''
          } ${error ? 'border-red-300' : ''}`}
          value={value !== undefined ? value : ''}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
        />
      ) : (
        <input
          className={`block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900 ${
            disabled ? 'bg-gray-50' : ''
          } ${error ? 'border-red-300' : ''}`}
          type={type}
          value={value !== undefined ? value : ''}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
        />
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
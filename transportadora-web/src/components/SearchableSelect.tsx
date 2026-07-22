import { ChevronDown, Search } from 'lucide-react';
import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  value: string;
  options?: SearchableSelectOption[];
  onChange: (value: string) => void;
  emptyLabel?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
};

export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function filterSearchableOptions(options: SearchableSelectOption[], query: string) {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return options;
  return options.filter((option) => normalizeSearch(option.label).includes(normalizedQuery));
}

export function SearchableSelect({
  value,
  options = [],
  onChange,
  emptyLabel = 'Selecione',
  disabled = false,
  required = false,
  ariaLabel,
}: SearchableSelectProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const allOptions = useMemo(() => {
    const configuredEmpty = options.find((option) => option.value === '');
    return [configuredEmpty || { value: '', label: emptyLabel }, ...options.filter((option) => option.value !== '')];
  }, [emptyLabel, options]);
  const selectedOption = allOptions.find((option) => option.value === value);
  const [query, setQuery] = useState(selectedOption?.label || emptyLabel);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filteredOptions = useMemo(() => filterSearchableOptions(allOptions, query), [allOptions, query]);

  useEffect(() => {
    if (!open) setQuery(selectedOption?.label || emptyLabel);
  }, [emptyLabel, open, selectedOption?.label]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !value ? 'Selecione uma opção da lista.' : '');
  }, [required, value]);

  function select(option: SearchableSelectOption) {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  function handleFocus() {
    if (disabled) return;
    setQuery('');
    setOpen(true);
  }

  function handleClick() {
    if (disabled || open) return;
    setQuery('');
    setOpen(true);
  }

  function handleChange(nextQuery: string) {
    setQuery(nextQuery);
    setOpen(true);
    if (!nextQuery) onChange('');
    const exact = allOptions.find((option) => normalizeSearch(option.label) === normalizeSearch(nextQuery));
    if (exact) onChange(exact.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!filteredOptions.length) return;
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
    if (event.key === 'Enter' && open && filteredOptions[activeIndex]) {
      event.preventDefault();
      select(filteredOptions[activeIndex]);
    }
    if (event.key === 'Escape') {
      setOpen(false);
      setQuery(selectedOption?.label || emptyLabel);
    }
  }

  return (
    <div className={`searchable-select ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`}>
      <div className="searchable-select-control">
        <Search size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && filteredOptions[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
          autoComplete="off"
          disabled={disabled}
          required={required}
          value={query}
          onFocus={handleFocus}
          onClick={handleClick}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setOpen(false);
            setQuery(selectedOption?.label || emptyLabel);
          }}
        />
        <ChevronDown size={16} aria-hidden="true" />
      </div>
      {open && (
        <div id={listboxId} className="searchable-select-options" role="listbox">
          {filteredOptions.map((option, index) => (
            <button
              id={`${listboxId}-${index}`}
              key={`${option.value}-${option.label}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`${option.value === value ? 'selected' : ''} ${index === activeIndex ? 'active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(option)}
            >
              {option.label}
            </button>
          ))}
          {!filteredOptions.length && <div className="searchable-select-empty">Nenhuma opção encontrada.</div>}
        </div>
      )}
    </div>
  );
}

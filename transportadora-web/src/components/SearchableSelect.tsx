import { Check, ChevronDown, Search, X } from 'lucide-react';
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
    setActiveIndex(Math.max(0, allOptions.findIndex((option) => option.value === value)));
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
    if (event.key === 'Tab' && open && filteredOptions[activeIndex]) {
      select(filteredOptions[activeIndex]);
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
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

type MultiSearchableSelectProps = {
  value: string[];
  options?: SearchableSelectOption[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

export function MultiSearchableSelect({
  value,
  options = [],
  onChange,
  placeholder = 'Todos',
  disabled = false,
  ariaLabel,
}: MultiSearchableSelectProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filteredOptions = useMemo(() => filterSearchableOptions(options, query), [options, query]);
  const selectedOptions = value.map((selectedValue) => (
    options.find((option) => option.value === selectedValue) || { value: selectedValue, label: selectedValue }
  ));

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, filteredOptions.length - 1)));
  }, [filteredOptions.length]);

  function toggle(option: SearchableSelectOption) {
    onChange(value.includes(option.value)
      ? value.filter((item) => item !== option.value)
      : [...value, option.value]);
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => current < 0 ? 0 : Math.min(current + 1, filteredOptions.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => current < 0 ? Math.max(0, filteredOptions.length - 1) : Math.max(current - 1, 0));
    }
    if ((event.key === 'Enter' || event.key === ' ') && open && !query && filteredOptions[activeIndex]) {
      event.preventDefault();
      toggle(filteredOptions[activeIndex]);
    } else if (event.key === 'Enter' && open && filteredOptions[activeIndex]) {
      event.preventDefault();
      toggle(filteredOptions[activeIndex]);
    }
    if (event.key === 'Backspace' && !query && value.length) {
      onChange(value.slice(0, -1));
    }
    if (event.key === 'Tab' && open && activeIndex >= 0 && filteredOptions[activeIndex]) {
      toggle(filteredOptions[activeIndex]);
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div className={`searchable-select multi-searchable-select ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`}>
      <div
        className="searchable-select-control multi-searchable-select-control"
        onClick={(event) => {
          if (disabled) return;
          if (open && event.target !== inputRef.current) {
            setOpen(false);
            inputRef.current?.blur();
            return;
          }
          inputRef.current?.focus();
        }}
      >
        <Search size={16} aria-hidden="true" />
        <div className="multi-searchable-select-values">
          {selectedOptions.map((option) => (
            <span className="multi-select-tag" key={option.value}>
              {option.label}
              <button
                type="button"
                aria-label={`Remover ${option.label}`}
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(option);
                }}
              >
                <X size={13} />
              </button>
            </span>
          ))}
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
            value={query}
            placeholder={value.length ? 'Adicionar...' : placeholder}
            onFocus={() => {
              setOpen(true);
              setActiveIndex(-1);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setOpen(false);
              setQuery('');
            }}
          />
        </div>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
      {open && (
        <div id={listboxId} className="searchable-select-options" role="listbox" aria-multiselectable="true">
          {filteredOptions.map((option, index) => {
            const selected = value.includes(option.value);
            return (
              <button
                id={`${listboxId}-${index}`}
                key={`${option.value}-${option.label}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={`${selected ? 'selected' : ''} ${index === activeIndex ? 'active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => toggle(option)}
              >
                <span>{option.label}</span>
                {selected && <Check size={15} aria-hidden="true" />}
              </button>
            );
          })}
          {!filteredOptions.length && <div className="searchable-select-empty">Nenhuma opção correspondente.</div>}
        </div>
      )}
    </div>
  );
}

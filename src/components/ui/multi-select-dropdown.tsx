"use client";

import { useState, useRef, useEffect, useMemo } from "react";

export interface FilterOption {
  value: string;
  count: number;
  label?: string; // Optional display label (defaults to value)
}

interface MultiSelectDropdownProps {
  label: string;
  placeholder?: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function MultiSelectDropdown({
  label,
  placeholder = "Search...",
  options,
  selected,
  onChange,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get display label for a value
  const getLabel = (value: string): string => {
    const option = options.find((opt) => opt.value === value);
    return option?.label ?? option?.value ?? value;
  };

  // Filter options based on search query (searches both label and value)
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((opt) =>
      (opt.label ?? opt.value).toLowerCase().includes(query) ||
      opt.value.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const removeOption = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== value));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-foreground/70 mb-2">
        {label}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[42px] px-3 py-2 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white text-left flex items-center justify-between gap-2"
      >
        <div className="flex-1 flex flex-wrap gap-1.5">
          {selected.length === 0 ? (
            <span className="text-foreground/40">Select {label.toLowerCase()}...</span>
          ) : (
            selected.slice(0, 3).map((value) => (
              <span
                key={value}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-md"
              >
                <span className="truncate max-w-[100px]">{getLabel(value)}</span>
                <button
                  type="button"
                  onClick={(e) => removeOption(value, e)}
                  className="hover:text-primary/70 flex-shrink-0"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))
          )}
          {selected.length > 3 && (
            <span className="text-xs text-foreground/60 py-0.5">
              +{selected.length - 3} more
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="p-0.5 hover:bg-foreground/10 rounded"
            >
              <svg className="w-4 h-4 text-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 text-foreground/40 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-foreground/20 rounded-lg shadow-lg overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-foreground/10">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-foreground/20 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-foreground/50">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleOption(option.value)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-foreground/5 transition-colors ${
                      isSelected ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-foreground/30"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="truncate">{option.label ?? option.value}</span>
                    </div>
                    <span className="text-foreground/40 text-xs flex-shrink-0 ml-2">
                      ({option.count})
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Selected Count Footer */}
          {selected.length > 0 && (
            <div className="px-3 py-2 border-t border-foreground/10 bg-foreground/[0.02] text-xs text-foreground/60">
              {selected.length} selected
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { travelApi, type TravelDestinationCountry } from "@/lib/api";

function unwrapCountries(payload: unknown): TravelDestinationCountry[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { data?: { countries?: TravelDestinationCountry[] }; countries?: TravelDestinationCountry[] };
  if (Array.isArray(body.data?.countries)) return body.data.countries;
  if (Array.isArray(body.countries)) return body.countries;
  return [];
}

export function locationLabels(countries: TravelDestinationCountry[]): string[] {
  const labels: string[] = [];
  for (const country of countries) {
    for (const city of country.cities ?? []) {
      if (city.name) labels.push(`${city.name}, ${country.name}`);
    }
    if ((country.cities ?? []).length === 0) {
      labels.push(country.name);
    }
  }
  return labels;
}

export function TravelDestinationFields({
  country,
  city,
  onCountryChange,
  onCityChange,
  countries,
  onAddCountry,
  onAddCity,
  adding = false,
}: {
  country: string;
  city: string;
  onCountryChange: (name: string) => void;
  onCityChange: (name: string) => void;
  countries: TravelDestinationCountry[];
  onAddCountry: (name: string) => Promise<void>;
  onAddCity: (country: string, name: string) => Promise<void>;
  adding?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-neutral-700">
          Destination Country <span className="text-red-500">*</span>
        </label>
        <CountrySelect
          value={country}
          countries={countries}
          adding={adding}
          onChange={(next) => {
            onCountryChange(next);
            if (next !== country) onCityChange("");
          }}
          onAdd={onAddCountry}
        />
      </div>
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-neutral-700">City</label>
        <CitySelect
          value={city}
          country={country}
          countries={countries}
          adding={adding}
          onChange={onCityChange}
          onAdd={onAddCity}
        />
      </div>
    </div>
  );
}

function CountrySelect({
  value,
  countries,
  onChange,
  onAdd,
  adding,
}: {
  value: string;
  countries: TravelDestinationCountry[];
  onChange: (v: string) => void;
  onAdd: (name: string) => Promise<void>;
  adding: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();

  const sadcFiltered = countries.filter((c) => c.is_sadc && c.name.toLowerCase().includes(q));
  const otherFiltered = countries.filter((c) => !c.is_sadc && c.name.toLowerCase().includes(q));
  const exactMatch = countries.some((c) => c.name.toLowerCase() === q);
  const canAdd = q.length > 0 && !exactMatch;
  const showSections = query === "";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-left focus:border-primary focus:ring-1 focus:ring-primary outline-none"
      >
        <span className={value ? "text-neutral-900" : "text-neutral-400"}>
          {value || "Select country..."}
        </span>
        <span className="material-symbols-outlined text-[16px] text-neutral-400">expand_more</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 shadow-lg">
          <div className="p-2 border-b border-neutral-100">
            <input
              autoFocus
              className="w-full rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              placeholder="Search countries..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {showSections && (
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                SADC Member States
              </div>
            )}
            {sadcFiltered.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/5 flex items-center justify-between ${
                  value === c.name ? "text-primary font-medium" : "text-neutral-700"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(c.name);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {c.name}
                {value === c.name && <span className="material-symbols-outlined text-[14px]">check</span>}
              </button>
            ))}
            {showSections && (
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-t border-neutral-50 mt-1">
                Other Countries
              </div>
            )}
            {otherFiltered.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/5 flex items-center justify-between ${
                  value === c.name ? "text-primary font-medium" : "text-neutral-700"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(c.name);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {c.name}
                {value === c.name && <span className="material-symbols-outlined text-[14px]">check</span>}
              </button>
            ))}
            {canAdd && (
              <button
                type="button"
                disabled={adding}
                className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/5 border-t border-neutral-50"
                onMouseDown={async (e) => {
                  e.preventDefault();
                  setError(null);
                  try {
                    await onAdd(query.trim());
                    setOpen(false);
                    setQuery("");
                  } catch {
                    setError("Could not add that country.");
                  }
                }}
              >
                Add “{query.trim()}” as a country
              </button>
            )}
            {!canAdd && sadcFiltered.length === 0 && otherFiltered.length === 0 && (
              <div className="px-3 py-4 text-xs text-neutral-400 text-center">No results for "{query}"</div>
            )}
            {error && <p className="px-3 py-2 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function CitySelect({
  value,
  country,
  countries,
  onChange,
  onAdd,
  adding,
}: {
  value: string;
  country: string;
  countries: TravelDestinationCountry[];
  onChange: (v: string) => void;
  onAdd: (country: string, name: string) => Promise<void>;
  adding: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const cities = useMemo(() => {
    const match = countries.find((c) => c.name.toLowerCase() === country.trim().toLowerCase());
    return match?.cities ?? [];
  }, [countries, country]);
  const q = query.trim().toLowerCase();
  const filtered = cities.filter((c) => c.name.toLowerCase().includes(q));
  const exactMatch = cities.some((c) => c.name.toLowerCase() === q);
  const canAdd = Boolean(country.trim()) && q.length > 0 && !exactMatch;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!country.trim()) {
    return (
      <input
        className="form-input"
        disabled
        placeholder="Select a country first"
        value=""
        readOnly
      />
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-left focus:border-primary focus:ring-1 focus:ring-primary outline-none"
      >
        <span className={value ? "text-neutral-900" : "text-neutral-400"}>
          {value || "Select city..."}
        </span>
        <span className="material-symbols-outlined text-[16px] text-neutral-400">expand_more</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 shadow-lg">
          <div className="p-2 border-b border-neutral-100">
            <input
              autoFocus
              className="w-full rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              placeholder="Search or add a city..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/5 flex items-center justify-between ${
                  value === c.name ? "text-primary font-medium" : "text-neutral-700"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(c.name);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {c.name}
                {value === c.name && <span className="material-symbols-outlined text-[14px]">check</span>}
              </button>
            ))}
            {canAdd && (
              <button
                type="button"
                disabled={adding}
                className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/5 border-t border-neutral-50"
                onMouseDown={async (e) => {
                  e.preventDefault();
                  setError(null);
                  try {
                    await onAdd(country, query.trim());
                    setOpen(false);
                    setQuery("");
                  } catch {
                    setError("Could not add that city.");
                  }
                }}
              >
                Add “{query.trim()}” as a city
              </button>
            )}
            {!canAdd && filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-neutral-400 text-center">No results for "{query}"</div>
            )}
            {error && <p className="px-3 py-2 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export async function loadTravelDestinations(): Promise<TravelDestinationCountry[]> {
  const res = await travelApi.listDestinations();
  return unwrapCountries(res.data);
}

export async function addTravelCountry(name: string): Promise<string> {
  const res = await travelApi.createCountry({ name });
  return res.data.data.name;
}

export async function addTravelCity(country: string, name: string): Promise<string> {
  const res = await travelApi.createCity({ country, name });
  return res.data.data.name;
}

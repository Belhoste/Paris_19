// Shared search configuration for People and Places
// Centralizes filter definitions and search behavior used by the SearchService.
//
// HOW TO USE / MAINTENANCE GUIDE
// 1) Edit project perimeter (P131 roots):
//    - Update the `p131Roots` array in the relevant config (PEOPLE_SEARCH_CONFIG or PLACES_SEARCH_CONFIG).
//    - These are Q-IDs that define the geographic/organizational scope searched via haswbstatement:P131.
//    - You can add/remove Q-IDs safely; the service will query all roots and merge results.
//
// 2) Add or modify filters:
//    - In `availableFilters`, add a new object: { key: 'yourKey', occupationId: 'Qxxxxx' }.
//    - `key` is a stable identifier used in code and translations; add a label in translations.config for each language.
//    - `occupationId` is the root class Q-ID; the service will expand it with P3* (subclass of, transitively).
//    - To rename a filter, keep the same `key` when possible (so translations remain aligned), or update translations accordingly.
//
// 3) Adjust which claim properties are inspected for local class/type filtering:
//    - `claimProperties` lists the property IDs read from entity claims (e.g., People: P165/P106; Places: P2).
//    - The service checks if any of the entity's class/type claims belong to the selected filter closures.
//
// 4) Tuning the search behavior:
//    - `termPreprocess` controls how the raw text input is transformed into tokens and optional anchor clauses.
//      Example: Places injects a soft anchor '"Paris,"' unless user typed it explicitly and splits input into tokens.
//    - `enableSparqlFallback` (recommended for Places): if true, when CirrusSearch returns nothing, a SPARQL fallback on labels is attempted.
//    - `finalFilterMode`: 'substring' (simple label/aliases substring) or 'allTokens' (every token must match label/aliases).
//
// After edits, simply rebuild; components read this config on init and update labels via translations.

export interface OccupationFilterConfig {
  key: string;
  occupationId: string;
  label?: string;
}

export interface PlaceFilterConfig {
  key: string;
  placeId: string;
  label?: string;
}

// Union discriminée pour les filtres
export type FilterConfig = OccupationFilterConfig | PlaceFilterConfig;

export type FinalFilterMode = 'substring' | 'allTokens';

export interface TermPreprocessResult {
  // Extra clauses to inject into srsearch (e.g., '"Paris,"')
  extraClauses: string[];
  // Tokens to star (t*) for full-text search
  tokens: string[];
}

export interface ComponentSearchConfig<TFilter extends FilterConfig> {
  name: 'people' | 'places';
  p131Roots: string[];
  claimProperties: string[];
  subclassProperty: 'P3';
  availableFilters: TFilter[];
  entityNamespace?: number;
  termPreprocess: (raw: string) => TermPreprocessResult;
  enableSparqlFallback?: boolean;
  finalFilterMode: FinalFilterMode;
}

// Default preprocessors
function defaultPeoplePreprocess(raw: string): TermPreprocessResult {
  const term = (raw || '').trim();
  if (!term) return { extraClauses: [], tokens: [] };
  // People: keep the raw term as a single token (the star is added later)
  return { extraClauses: [], tokens: [term] };
}

function defaultPlacesPreprocess(raw: string): TermPreprocessResult {
  const term = (raw || '').trim();
  const hasParis = /^Paris,\s*/i.test(term);
  const tokens = term.split(/\s+/).filter(t => !!t);
  const extraClauses = hasParis ? [] : ['"Paris,"'];
  return { extraClauses, tokens };
}

export const PEOPLE_SEARCH_CONFIG: ComponentSearchConfig<OccupationFilterConfig> = {
  name: 'people',
  p131Roots: ['Q268686', 'Q22241'],
  claimProperties: ['P165', 'P106'],
  subclassProperty: 'P3',
  availableFilters: [
    { key: 'painter',    occupationId: 'Q36783' },
    { key: 'writer',     occupationId: 'Q23190' },
    { key: 'actor',      occupationId: 'Q176304' },
    { key: 'physician',  occupationId: 'Q38980' },
    { key: 'scientist',  occupationId: 'Q206759' },
    { key: 'bookseller', occupationId: 'Q36507' },
    { key: 'printer',    occupationId: 'Q38848' },
    { key: 'engraver',   occupationId: 'Q162783' },
  ],
  entityNamespace: 120,
  termPreprocess: defaultPeoplePreprocess,
  enableSparqlFallback: false,
  finalFilterMode: 'substring'
};

export const PLACES_SEARCH_CONFIG: ComponentSearchConfig<PlaceFilterConfig> = {
  name: 'places',
  p131Roots: ['Q314208', 'Q147167'],
  claimProperties: ['P2'],
  subclassProperty: 'P3',
  availableFilters: [
    { key: 'address',  placeId: 'Q16200' },
    { key: 'voie',     placeId: 'Q266101' },
    { key: 'building', placeId: 'Q40261' },
    { key: 'theatre',  placeId: 'Q396161' },
  ],
  entityNamespace: 120,
  termPreprocess: defaultPlacesPreprocess,
  enableSparqlFallback: true,
  finalFilterMode: 'allTokens'
};


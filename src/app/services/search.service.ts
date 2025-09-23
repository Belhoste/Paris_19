import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { RequestService } from './request.service';
import { ComponentSearchConfig, FilterConfig, TermPreprocessResult } from '../config/search-filters.config';

export interface WikibaseEntity {
  id: string;
  labels?: { [lang: string]: { value: string } };
  aliases?: { [lang: string]: { value: string }[] };
  descriptions?: { [lang: string]: { value: string } };
  claims?: any;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private request = inject(RequestService);

  // Caches par composant
  private closuresCache: Record<string, Record<string, Set<string>>> = {};
  private closuresLoaded: Record<string, boolean> = {};
  private closuresLoading: Record<string, boolean> = {};

  // Utils
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const results: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) results.push(array.slice(i, i + chunkSize));
    return results;
  }

  private buildCirrusQueries<T extends FilterConfig>(cfg: ComponentSearchConfig<T>, preprocess: TermPreprocessResult, limit: number): Observable<string[]> {
    const tokenClauses = preprocess.tokens.map(t => (t.endsWith('*') ? t : t + '*'));
    const ns = cfg.entityNamespace ?? 120;
    const makeQuery = (root: string) => {
      const srsearch = [
        `haswbstatement:P131=${root}`,
        ...preprocess.extraClauses,
        ...tokenClauses,
      ].join(' ');
      const url = `https://database.factgrid.de/w/api.php?action=query&list=search&format=json&origin=*&srsearch=${encodeURIComponent(srsearch)}&srnamespace=${ns}&srlimit=${limit}`;
      return this.request.getItem(url).pipe(
        map((res: any) => (res?.query?.search || [])
          .map((it: any) => it.title.match(/Q\d+/)?.[0])
          .filter((x: string) => !!x))
      );
    };
    const queries = cfg.p131Roots.map(id => makeQuery(id));
    return forkJoin(queries).pipe(map(arr => Array.from(new Set(arr.flat()))));
  }

  private buildSparqlFallback<T extends FilterConfig>(cfg: ComponentSearchConfig<T>, preprocess: TermPreprocessResult, lang: string): Observable<string[]> {
    const tokens = preprocess.tokens.map(t => t.toLowerCase().replace(/"/g, ''));
    if (!tokens.length) return of([]);
    const tokenFilters = tokens.map(t => `FILTER(CONTAINS(LCASE(?label), "${t}")).`).join(' ');
    const roots = cfg.p131Roots.map(r => `wd:${r}`).join(' ');
    const sparql = `SELECT DISTINCT ?item WHERE { VALUES ?root { ${roots} } ?item wdt:P131* ?root . ?item rdfs:label ?label . FILTER(lang(?label)='${lang}') ${tokenFilters} } LIMIT 300`;
    const url = 'https://database.factgrid.de/sparql?query=' + encodeURIComponent(sparql) + '&format=json';
    return this.request.getItem(url).pipe(
      map((res: any) => {
        const set = new Set<string>();
        const bindings = res?.results?.bindings || [];
        for (const b of bindings) {
          const val = b.item?.value || '';
          const q = val.match(/Q\d+/)?.[0];
          if (q) set.add(q);
        }
        return Array.from(set);
      })
    );
  }

  searchIds<T extends FilterConfig>(cfg: ComponentSearchConfig<T>, rawTerm: string, minLength = 2, lang = 'en'): Observable<string[]> {
    const t = (rawTerm || '').trim();
    if (t.length < minLength) return of([]);
    const preprocess = cfg.termPreprocess(t);
    const limit = t.length === 2 ? 100 : 200;
    return this.buildCirrusQueries(cfg, preprocess, limit).pipe(
      switchMap(cirrusIds => {
        if ((cirrusIds?.length || 0) > 0 || !cfg.enableSparqlFallback) return of(cirrusIds);
        return this.buildSparqlFallback(cfg, preprocess, lang).pipe(
          map(fallbackIds => Array.from(new Set([...(cirrusIds || []), ...fallbackIds])))
        );
      })
    );
  }

  fetchEntities(ids: string[], lang: string): Observable<WikibaseEntity[]> {
    if (!ids?.length) return of([]);
    const chunks = this.chunkArray(ids, 50);
    const requests = chunks.map(chunk => {
      const idsParam = chunk.join('|');
      const url = `https://database.factgrid.de/w/api.php?action=wbgetentities&ids=${idsParam}&format=json&languages=${lang}&origin=*`;
      return this.request.getItem(url).pipe(
        map((res: any) => res && res.entities ? (Object.values(res.entities) as WikibaseEntity[]) : [])
      );
    });
    return requests.length ? forkJoin(requests).pipe(map(r => r.flat())) : of([]);
  }

  // Fermeture des classes via P3*
  loadClosures<T extends FilterConfig>(cfg: ComponentSearchConfig<T>, filters: T[]): Observable<Record<string, Set<string>>> {
    const key = cfg.name;
    if (!this.closuresCache[key]) this.closuresCache[key] = {};
    if (this.closuresLoaded[key]) return of(this.closuresCache[key]);
    if (this.closuresLoading[key]) return of(this.closuresCache[key]);

    this.closuresLoading[key] = true;
    // init skeleton
    filters.forEach(f => {
      if ('occupationId' in f) {
        // Pour les filtres occupation
        this.closuresCache[key][f.key] = new Set([f.occupationId]);
      } else if ('placeId' in f) {
        // Pour les filtres place
        this.closuresCache[key][f.key] = new Set([f.placeId]);
      }
    });
    const roots = filters.map(f => 'occupationId' in f ? `wd:${f.occupationId}` : `wd:${f.placeId}`).join(' ');
    if (!roots) { this.closuresLoaded[key] = true; this.closuresLoading[key] = false; return of(this.closuresCache[key]); }
    const sparql = `SELECT ?root ?occ WHERE { VALUES ?root { ${roots} } ?occ wdt:${cfg.subclassProperty}* ?root . }`;
    const url = `https://database.factgrid.de/sparql?format=json&query=${encodeURIComponent(sparql)}`;
    return this.request.getItem(url).pipe(
      map((res: any) => {
        const bindings = res?.results?.bindings || [];
        for (const b of bindings) {
          const rootQ = b.root?.value?.match(/Q\d+/)?.[0];
          const occQ = b.occ?.value?.match(/Q\d+/)?.[0];
          if (!rootQ || !occQ) continue;
          const f = filters.find(ff => 'occupationId' in ff ? ff.occupationId === rootQ : ff.placeId === rootQ);
          if (!f) continue;
          const set = this.closuresCache[key][f.key] || new Set<string>();
          set.add(rootQ); set.add(occQ);
          this.closuresCache[key][f.key] = set;
        }
        this.closuresLoaded[key] = true; this.closuresLoading[key] = false;
        return this.closuresCache[key];
      })
    );
  }

  // Filtrage local par classes
  filterEntitiesByClasses<T extends FilterConfig>(cfg: ComponentSearchConfig<T>, entities: WikibaseEntity[], activeKeys: string[], closures: Record<string, Set<string>>, advMode: boolean, advGroups: { id: number; allOf: string[] }[], disjoint: boolean): WikibaseEntity[] {
    if (!entities?.length) return [];
    const occupationMap: Record<string, string> = cfg.availableFilters.reduce((acc, f) => {
      if ('occupationId' in f) {
        acc[f.key] = f.occupationId;
      } else if ('placeId' in f) {
        acc[f.key] = f.placeId;
      }
      return acc;
    }, {} as Record<string, string>);
    const properties = cfg.claimProperties;

    return entities.filter((e: any) => {
      const occIds: string[] = [];
      for (const p of properties) {
        const claims = e.claims?.[p] || [];
        for (const c of claims) { const id = c?.mainsnak?.datavalue?.value?.id; if (id) occIds.push(id); }
      }
      if (!occIds.length && (activeKeys.length || advMode)) return false;
      const uniq = Array.from(new Set(occIds));

      if (advMode) {
        const groups = advGroups.filter(g => g.allOf.length > 0);
        if (!groups.length) return true;
        return groups.some(g => g.allOf.every(k => {
          const closure = closures[k] || new Set([occupationMap[k]]);
          return uniq.some(id => closure.has(id));
        }));
      }
      if (!activeKeys.length) return true;
      if (disjoint) {
        return activeKeys.some(k => {
          const closure = closures[k] || new Set([occupationMap[k]]);
          return uniq.some(id => closure.has(id));
        });
      } else {
        return activeKeys.every(k => {
          const closure = closures[k] || new Set([occupationMap[k]]);
          return uniq.some(id => closure.has(id));
        });
      }
    });
  }

  // Filtrage final par label/alias selon mode
  finalTextFilter<T extends FilterConfig>(cfg: ComponentSearchConfig<T>, entities: WikibaseEntity[], rawTerm: string, lang: string): WikibaseEntity[] {
    const term = (rawTerm || '').toString();
    if (!term) return entities;
    if (cfg.finalFilterMode === 'substring') {
      const searchTerm = term.toLowerCase();
      return entities.filter((item: any) => {
        const label = item.labels?.[lang]?.value?.toLowerCase?.() || item.label?.toLowerCase?.() || '';
        const aliases = (item.aliases?.[lang] || []).map((a: any) => (a.value || a).toString().toLowerCase());
        return label.includes(searchTerm) || aliases.some(al => al.includes(searchTerm));
      });
    }
  // allTokens
  // Ancien: suppression du préfixe "Paris, "
  // const normalized = term.replace(/^Paris,\s*/i, '');
  // const tokens = normalized.split(/\s+/).filter(t => t.length > 0).map(t => t.toLowerCase());
  // Nouveau: conserver le terme sans suppression
  const tokens = term.split(/\s+/).filter(t => t.length > 0).map(t => t.toLowerCase());
    if (!tokens.length) return entities;
    return entities.filter((e: any) => {
      const label = (e.label || e.labels?.[lang]?.value || '').toLowerCase();
      const aliasesArr: string[] = Array.isArray(e.aliases) ? e.aliases.map((a: any) => (a.value || a || '').toLowerCase()) : (e.aliases?.[lang] || []).map((a: any) => a.value.toLowerCase());
      return tokens.every(tok => label.includes(tok) || aliasesArr.some(al => al.includes(tok)));
    });
  }
}

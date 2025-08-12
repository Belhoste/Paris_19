import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, Observable, forkJoin, of, BehaviorSubject, combineLatest } from 'rxjs';
import { map, tap, switchMap, debounceTime, filter, startWith, distinctUntilChanged } from 'rxjs/operators';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule, Router } from '@angular/router';
import { SetLanguageService } from '../services/set-language.service';
import { RequestService } from '../services/request.service';
import { SelectedLangService } from '../selected-lang.service';
import { LastSearchRouteService } from '../services/last-search-route.service';

@Component({
    selector: 'app-places',
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        FormsModule,
        MatInputModule,
        MatFormFieldModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
  MatSlideToggleModule,
  MatTooltipModule,
    ],
    templateUrl: './places.component.html',
    styleUrls: ['./places.component.scss']
})

export class PlacesComponent implements OnInit {
  private changeDetector = inject(ChangeDetectorRef);
  private request = inject(RequestService);
  private setLanguage = inject(SetLanguageService);
  private lang = inject(SelectedLangService);
  private lastSearchRoute = inject(LastSearchRouteService);
  private router = inject(Router);

  title = 'Paris 19';
  subTitle: string = 'Places';
  bibliography: string;
  home_page: string = 'Home';
  people:string = 'People';
  formerVisitsTitle: string = 'you have visited:';

  minTermLength = 2;
  minLengthTooltip = 'Tapez au moins 2 caractères pour lancer la recherche';

  searchInput = new FormControl();
  public isDisplay: boolean = false;
  items: any[] = [];
  labels: Subscription; // abonnement principal
  pages: Observable<number>;
  selectedItemsList: any[] = JSON.parse(localStorage.getItem('selectedItems')) || [];

  // -------- Filtres dynamiques (placeholder) --------
  // Remplacez occupationId par le Q-id racine correspondant au type de lieu (ex: instance of building, street, etc.)
  availableFilters: { key: string; label: string; occupationId: string; }[] = [
    { key: 'address', label: 'Adresses', occupationId: 'Q16200' },     // P2=Q16200
    { key: 'voie', label: 'Voies', occupationId: 'Q266101' },          // P2=Q266101
    { key: 'building', label: 'Bâtiments', occupationId: 'Q40261' },   // P2=Q40261
    { key: 'theatre', label: 'Théâtres', occupationId: 'Q396161' },    // P2=Q396161
  ];
  private selectedFilters = new Set<string>();
  private selectedFilters$ = new BehaviorSubject<string[]>([]);
  combineDisjoint = false; // false = AND, true = OR
  private combineDisjoint$ = new BehaviorSubject<boolean>(false);

  // Cache fermetures sous-classes (réutilise P3 * ). Même logique que People.
  private occupationClosureCache: Record<string, Set<string>> = {};
  private occupationClosureLoaded = false;
  private occupationClosureLoading = false;

  // -------- Mode avancé (DNF) --------
  advancedMode = false;
  private advancedMode$ = new BehaviorSubject<boolean>(false);
  advancedGroups: { id: number; allOf: string[] }[] = [];
  private advancedGroups$ = new BehaviorSubject<{ id: number; allOf: string[] }[]>([]);
  private groupIdCounter = 0;
  expressionSummary = '';

  private baseGetURL = 'https://database.factgrid.de//w/api.php?action=wbgetentities&ids=';
  private getUrlSuffix = '&format=json&origin=*';

  // Utilitaire de découpe (comme People)
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const results: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      results.push(array.slice(i, i + chunkSize));
    }
    return results;
  }

  goToDisplay(itemId: string) {
    this.lastSearchRoute.setLastSearchRoute(this.router.url);
    this.router.navigate(['/item', itemId]);
  }

  // ---------- Méthodes filtres & mode avancé (copiées/adaptées) ----------
  private emitAdvancedGroups() {
    this.advancedGroups$.next(this.advancedGroups.map(g => ({ id: g.id, allOf: [...g.allOf] })));
    this.recomputeExpressionSummary();
  }

  private recomputeExpressionSummary() {
    if (!this.advancedMode || this.advancedGroups.length === 0) { this.expressionSummary = ''; return; }
    const labelMap = this.availableFilters.reduce((acc, f) => { acc[f.key] = f.label; return acc; }, {} as Record<string,string>);
    const parts = this.advancedGroups
      .filter(g => g.allOf.length > 0)
      .map(g => g.allOf.map(k => labelMap[k] || k).join(' ∧ '));
    this.expressionSummary = parts.join(' ∨ ');
  }

  toggleAdvancedMode() {
    this.advancedMode = !this.advancedMode;
    this.advancedMode$.next(this.advancedMode);
    if (this.advancedMode) {
      this.groupIdCounter = 0;
      const current = Array.from(this.selectedFilters);
      if (current.length === 0) {
        this.advancedGroups = [{ id: ++this.groupIdCounter, allOf: [] }];
      } else if (current.length === 1) {
        this.advancedGroups = [{ id: ++this.groupIdCounter, allOf: [...current] }];
      } else {
        if (this.combineDisjoint) {
          this.advancedGroups = current.map(k => ({ id: ++this.groupIdCounter, allOf: [k] }));
        } else {
          this.advancedGroups = [{ id: ++this.groupIdCounter, allOf: [...current] }];
        }
      }
      this.emitAdvancedGroups();
    } else {
      this.selectedFilters.clear();
      this.selectedFilters$.next([]);
      this.combineDisjoint = false; this.combineDisjoint$.next(false);
      this.expressionSummary = ''; this.groupIdCounter = 0;
    }
  }

  addGroup() { this.advancedGroups.push({ id: ++this.groupIdCounter, allOf: [] }); this.emitAdvancedGroups(); }
  removeGroup(id: number) {
    this.advancedGroups = this.advancedGroups.filter(g => g.id !== id);
    if (this.advancedGroups.length === 0) this.advancedGroups.push({ id: ++this.groupIdCounter, allOf: [] });
    this.emitAdvancedGroups();
  }
  groupHas(group: { id: number; allOf: string[] }, key: string) { return group.allOf.includes(key); }
  toggleFilterInGroup(group: { id: number; allOf: string[] }, key: string) {
    const i = group.allOf.indexOf(key); if (i >= 0) group.allOf.splice(i, 1); else group.allOf.push(key); this.emitAdvancedGroups();
  }
  trackGroup(index: number, g: { id: number; allOf: string[] }) { return g.id; }

  private initOccupationClosureCacheSkeleton() {
    this.availableFilters.forEach(f => { if (!this.occupationClosureCache[f.key]) this.occupationClosureCache[f.key] = new Set([f.occupationId]); });
  }
  private loadOccupationClosures() {
    if (this.occupationClosureLoaded || this.occupationClosureLoading || !this.availableFilters.length) return;
    this.occupationClosureLoading = true; this.initOccupationClosureCacheSkeleton();
    const roots = this.availableFilters.map(f => `wd:${f.occupationId}`).join(' ');
    const sparql = `SELECT ?root ?occ WHERE { VALUES ?root { ${roots} } ?occ wdt:P3* ?root . }`;
    const url = `https://database.factgrid.de/sparql?format=json&query=${encodeURIComponent(sparql)}`;
    this.request.getItem(url).subscribe({
      next: (res: any) => {
        try {
          const bindings = res?.results?.bindings || [];
          bindings.forEach((b: any) => {
            const rootQ = b.root?.value?.match(/Q\d+/)?.[0];
            const occQ = b.occ?.value?.match(/Q\d+/)?.[0];
            if (!rootQ || !occQ) return;
            const filter = this.availableFilters.find(f => f.occupationId === rootQ); if (!filter) return;
            const set = this.occupationClosureCache[filter.key] || new Set<string>();
            set.add(rootQ); set.add(occQ); this.occupationClosureCache[filter.key] = set;
          });
          this.occupationClosureLoaded = true;
          const active = Array.from(this.selectedFilters); if (active.length) this.selectedFilters$.next(active);
        } catch (e) { console.error('[PlacesComponent] Erreur parsing SPARQL', e); }
      },
      error: err => console.warn('[PlacesComponent] Échec SPARQL closures', err),
      complete: () => { this.occupationClosureLoading = false; }
    });
  }

  toggleCombineMode() { this.combineDisjoint = !this.combineDisjoint; this.combineDisjoint$.next(this.combineDisjoint); }
  toggleFilter(filter: { key: string }) {
    if (this.advancedMode) return;
    if (!this.occupationClosureLoaded && !this.occupationClosureLoading) this.loadOccupationClosures();
    if (this.selectedFilters.has(filter.key)) this.selectedFilters.delete(filter.key); else this.selectedFilters.add(filter.key);
    this.selectedFilters$.next(Array.from(this.selectedFilters));
  }
  isFilterSelected(filter: { key: string }) { return this.selectedFilters.has(filter.key); }


  ngOnInit(): void {
    this.loadOccupationClosures(); // eager (noop si pas de filtres)
    // Traductions
    this.people = this.lang.getTranslation('people', this.lang.selectedLang);
    this.home_page = this.lang.getTranslation('home_page', this.lang.selectedLang);
    this.subTitle = this.lang.getTranslation('places', this.lang.selectedLang);
    this.formerVisitsTitle = this.lang.getTranslation('formerVisitsTitle',this.lang.selectedLang)
    this.selectedItemsList = this.selectedItemsList.filter(function (el) { return (el !== null) });
    this.pages = this.request.getStat().pipe(map(res => (Object.values(res)[1] as any).statistics.pages));

    // Flux terme
  const term$ = this.searchInput.valueChanges.pipe(
      startWith(''),
      map(v => (v || '').trim()),
      debounceTime(250),
      distinctUntilChanged()
    );
    const filters$ = this.selectedFilters$.pipe(
      map(list => [...list]),
      distinctUntilChanged((a, b) => a.length === b.length && a.every((v, i) => v === b[i]))
    );
    const mode$ = this.combineDisjoint$.pipe(startWith(false));
    const advMode$ = this.advancedMode$.pipe(startWith(this.advancedMode));
    const advGroups$ = this.advancedGroups$.pipe(startWith(this.advancedGroups));

    this.labels = combineLatest([term$, filters$, mode$, advMode$, advGroups$]).pipe(
  tap(([term]) => {
        if ((term as string).length < this.minTermLength) { this.items = []; this.isDisplay = false; this.changeDetector.detectChanges(); }
      }),
      filter(([term]) => (term as string).length >= this.minTermLength),
      // Recherche via CirrusSearch: tokens n'importe où dans le label après "Paris,".
      switchMap(([term]) => {
        const raw = (term as string).trim();
        // Retirer un éventuel préfixe "Paris," déjà saisi (on le réinjecte systématiquement après)
        const normalized = raw.replace(/^Paris,\s*/i, '');
        const tokens = normalized.split(/\s+/).filter(t => !!t);
        const tokenClauses = tokens.map(t => (t.endsWith('*') ? t : t + '*'));
        const baseClause = 'haswbstatement:P131=Q314208';
        // RÉTABLI : token obligatoire "Paris," pour ancrer la recherche sur les items du 19ᵉ (logique précédente qui fonctionnait)
        const srsearchParts = [baseClause, '"Paris,"', ...tokenClauses];
        const srsearch = srsearchParts.join(' ');
        const limit = raw.length === 2 ? 100 : 200;
        const url = `https://database.factgrid.de/w/api.php?action=query&list=search&format=json&origin=*&srsearch=${encodeURIComponent(srsearch)}&srnamespace=120&srlimit=${limit}`;
        return this.request.getItem(url).pipe(
          map((res: any) => {
            const ids = (res?.query?.search || []).map((item: any) => item.title.match(/Q\d+/)?.[0]).filter((x: string) => !!x);
            return ids;
          })
        );
      }),
      filter((ids: string[]) => ids.length > 0),
      switchMap((ids: string[]) => {
        const lang = this.lang.selectedLang;
        const chunks = this.chunkArray(ids, 50);
        const requests = chunks.map(chunk => {
          const idsParam = chunk.join('|');
          const getEntitiesUrl = `https://database.factgrid.de/w/api.php?action=wbgetentities&ids=${idsParam}&format=json&languages=${lang}&origin=*`;
          return this.request.getItem(getEntitiesUrl).pipe(
            map((res: any) => res && res.entities ? Object.values(res.entities) as any[] : [])
          );
        });
        return requests.length ? forkJoin(requests).pipe(map(r => r.flat())) : of([]);
      }),
      // Filtrage LOCAL adapté pour Places : on regarde la propriété P2 (type / classe)
      map((entities: any[]) => {
        const activeKeys = this.selectedFilters$.value;
        const disjoint = this.combineDisjoint;
        const advMode = this.advancedMode;
        const advGroups = this.advancedGroups;
        const occupationMap: Record<string, string> = this.availableFilters.reduce((acc, f) => { acc[f.key] = f.occupationId; return acc; }, {} as Record<string,string>);
        const occupationProperties = ['P2']; // propriété utilisée pour typer les lieux
        return entities.filter((e: any) => {
          const occIds: string[] = [];
          for (const p of occupationProperties) {
            const claims = e.claims?.[p] || [];
            for (const c of claims) { const id = c?.mainsnak?.datavalue?.value?.id; if (id) occIds.push(id); }
          }
          // Debug: si filtre address actif ou mode avancé contenant 'address', afficher les IDs P2 collectés
          // (logs retirés)
          if (activeKeys.length === 0 && !advMode) return true; // pas de contrainte
          const uniq = Array.from(new Set(occIds));
          if (advMode) {
            const groups = advGroups.filter(g => g.allOf.length > 0);
            if (groups.length === 0) return true;
            return groups.some(g => g.allOf.every(k => {
              const closure = this.occupationClosureCache[k] || new Set([occupationMap[k]]);
              return uniq.some(id => closure.has(id));
            }));
          }
          if (activeKeys.length === 0) return true;
            if (disjoint) {
              return activeKeys.some(k => {
                const closure = this.occupationClosureCache[k] || new Set([occupationMap[k]]);
                return uniq.some(id => closure.has(id));
              });
            } else {
              return activeKeys.every(k => {
                const closure = this.occupationClosureCache[k] || new Set([occupationMap[k]]);
                return uniq.some(id => closure.has(id));
              });
            }
        });
      }),
      map(entities => this.setLanguage.item(entities, this.lang.selectedLang) as any[])
      ,
      // Filtrage final: s'assurer que chaque token saisi apparaît dans le label (ou alias) et non seulement dans d'autres champs indexés
      map((entities: any[]) => {
        const raw = (this.searchInput.value || '').toString().trim();
        const normalized = raw.replace(/^Paris,\s*/i, '');
        const tokens = normalized.split(/\s+/).filter(t => t.length > 0).map(t => t.toLowerCase());
        if (!tokens.length) return entities;
        // Après setLanguage.item, la structure est { id, label: string, aliases?: string[] }
        const filtered = entities.filter(e => {
          const label = (e.label || '').toLowerCase();
            const aliasesArr: string[] = Array.isArray(e.aliases) ? e.aliases.map((a: any) => (a || '').toLowerCase()) : [];
          return tokens.every(tok => label.includes(tok) || aliasesArr.some(al => al.includes(tok)));
        });
        return filtered;
      })
    ).subscribe(list => {
      this.items = list;
      this.isDisplay = this.items.length > 0 && !(this.items[0]?.id === 'Q220375');
      this.changeDetector.detectChanges();
    });
  }

  createList(re: any) {
  // Obsolète (recherche refactorisée CirrusSearch) – conservé si réutilisation potentielle.
  let arr = re?.search || [];
  if (!Array.isArray(arr)) arr = [];
  const list = arr.map((e: any) => e.id).filter((x: any) => !!x).join('|');
  return this.baseGetURL + list + this.getUrlSuffix;
  }

  ngOnDestroy(): void { if (this.labels) this.labels.unsubscribe(); }
}

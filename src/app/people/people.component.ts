import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, Observable, forkJoin, of, BehaviorSubject, combineLatest } from 'rxjs';
import { map, tap, switchMap, debounceTime, filter, startWith, distinctUntilChanged } from 'rxjs/operators';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule, Router } from '@angular/router';
import { SetLanguageService } from '../services/set-language.service';
import { RequestService } from '../services/request.service';
import { SelectedLangService } from '../selected-lang.service';
import { LastSearchRouteService } from '../services/last-search-route.service'; 
//import { SearchCacheService } from '../services/search-cache.service';

export interface WikibaseEntity {
  id: string;
  labels?: {
    [lang: string]: { value: string }
  };
  aliases?: {
    [lang: string]: { value: string }[]
  };
  descriptions?: {
    [lang: string]: { value: string }
  };
  // Ajoutez d'autres propriétés si besoin (claims, sitelinks, etc.)
}

// Fonction utilitaire pour découper un tableau en lots de taille fixe
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const results: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    results.push(array.slice(i, i + chunkSize));
  }
  return results;
}

@Component({
    selector: 'app-people',
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        FormsModule,
        MatInputModule,
        MatFormFieldModule,
        MatTableModule,
        MatIconModule,
        MatButtonModule,
      MatCardModule,
  MatSlideToggleModule,
  MatTooltipModule,
    ],
    templateUrl: './people.component.html',
    styleUrls: ['./people.component.scss']
})
export class PeopleComponent implements OnInit {
  private changeDetector = inject(ChangeDetectorRef);
  private request = inject(RequestService);
  private setLanguage = inject(SetLanguageService);
  private lang = inject(SelectedLangService);
  private lastSearchRoute = inject(LastSearchRouteService);
  private router = inject(Router);
//  private searchCache = inject(SearchCacheService);

  prosopography: string = "Prosopography Harmonia Universalis";
  animalMagnetism_subtitle: string = "a database on animal magnetism";
  home_page: string;
  bibliography: string;

  places: string = "Places";

  subTitle: string = "People";
  advanced_search: string = "advanced search";
  projects: string = "research projects";
  fields: string = "fields of reserach";

  warningMessage: string = "";
  minTermLength = 2;
  minLengthTooltip = 'Tapez au moins 2 caractères pour lancer la recherche';

  searchInput = new FormControl();
  public isDisplay: boolean = false;
  labels: Subscription;
  items: WikibaseEntity[] = [];
  selectedItemsList: any[] = JSON.parse(localStorage.getItem('selectedItems')) || [];
  pages: Observable<number>;

  // Filtres dynamiques (désormais filtrage LOCAL sur les claims plutôt que dans srsearch)
  // occupationId correspond à la valeur (Q-id) attendue dans les claims P165 (à vérifier selon votre modèle: si l'occupation réelle est P106, adapter ci-dessous)
  availableFilters: { key: string; label: string; occupationId: string; }[] = [
    { key: 'painter', label: 'Peintres', occupationId: 'Q36783' },
    { key: 'writer', label: 'Écrivains', occupationId: 'Q23190' },
  { key: 'actor', label: 'Comédiens', occupationId: 'Q176304' },
  { key: 'doctor', label: 'Médecins', occupationId: 'Q38980' },
  { key: 'bookseller', label: 'Libraires', occupationId: 'Q36507' },
  { key: 'printer', label: 'Imprimeurs', occupationId: 'Q38848' },
  { key: 'engraver', label: 'Graveurs', occupationId: 'Q162783' },
  ];
  private selectedFilters = new Set<string>();
  // Observable des clés de filtres sélectionnés (et non plus des clauses srsearch)
  private selectedFilters$ = new BehaviorSubject<string[]>([]);
  // Mode de combinaison des filtres: true = OR (disjoint), false = AND (conjoint)
  combineDisjoint = false;
  private combineDisjoint$ = new BehaviorSubject<boolean>(false);

  // Cache des fermetures de sous-classes: key (filter key) -> Set de Qids (root + sous-classes)
  private occupationClosureCache: Record<string, Set<string>> = {};
  private occupationClosureLoaded = false;
  private occupationClosureLoading = false;

  // --- Mode avancé (DNF: OR de groupes AND) ---
  advancedMode = false;
  private advancedMode$ = new BehaviorSubject<boolean>(false);
  advancedGroups: { id: number; allOf: string[] }[] = [];
  private advancedGroups$ = new BehaviorSubject<{ id: number; allOf: string[] }[]>([]);
  private groupIdCounter = 0;
  expressionSummary = '';

  private emitAdvancedGroups() {
  // Ne pas filtrer ici: on veut que l'utilisateur voie immédiatement un nouveau groupe vide après +
  // Le nettoyage éventuel pourra se faire en quittant le mode avancé si nécessaire.
    this.advancedGroups$.next(this.advancedGroups.map(g => ({ id: g.id, allOf: [...g.allOf] })));
    this.recomputeExpressionSummary();
  }

  private recomputeExpressionSummary() {
    if (!this.advancedMode || this.advancedGroups.length === 0) {
      this.expressionSummary = '';
      return;
    }
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
  // Réinitialiser la numérotation des groupes à chaque nouvelle combinaison
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
      this.combineDisjoint = false;
      this.combineDisjoint$.next(false);
      this.expressionSummary = '';
  this.groupIdCounter = 0; // prêt pour la prochaine activation
    }
  }

  addGroup() {
    this.advancedGroups.push({ id: ++this.groupIdCounter, allOf: [] });
    this.emitAdvancedGroups();
  }

  removeGroup(id: number) {
    this.advancedGroups = this.advancedGroups.filter(g => g.id !== id);
    if (this.advancedGroups.length === 0) {
      this.advancedGroups.push({ id: ++this.groupIdCounter, allOf: [] });
    }
    this.emitAdvancedGroups();
  }

  groupHas(group: { id: number; allOf: string[] }, key: string) {
    return group.allOf.includes(key);
  }

  toggleFilterInGroup(group: { id: number; allOf: string[] }, key: string) {
    const idx = group.allOf.indexOf(key);
    if (idx >= 0) group.allOf.splice(idx, 1); else group.allOf.push(key);
    this.emitAdvancedGroups();
  }

  trackGroup(index: number, g: { id: number; allOf: string[] }) { return g.id; }

  private initOccupationClosureCacheSkeleton() {
    // Initialiser chaque filtre avec son root seulement pour un fallback immédiat
    this.availableFilters.forEach(f => {
      if (!this.occupationClosureCache[f.key]) {
        this.occupationClosureCache[f.key] = new Set([f.occupationId]);
      }
    });
  }

  private loadOccupationClosures() {
    if (this.occupationClosureLoaded || this.occupationClosureLoading) return;
    this.occupationClosureLoading = true;
    this.initOccupationClosureCacheSkeleton();
    const roots = this.availableFilters.map(f => `wd:${f.occupationId}`).join(' ');
    // P3 = sous-classe de (transitif * )
    const sparql = `SELECT ?root ?occ WHERE { VALUES ?root { ${roots} } ?occ wdt:P3* ?root . }`;
    const url = `https://database.factgrid.de/sparql?format=json&query=${encodeURIComponent(sparql)}`;
    this.request.getItem(url).subscribe({
      next: (res: any) => {
        try {
          const bindings = res?.results?.bindings || [];
          bindings.forEach((b: any) => {
            const rootUri = b.root?.value || '';
            const occUri = b.occ?.value || '';
            const rootMatch = rootUri.match(/Q\d+/);
            const occMatch = occUri.match(/Q\d+/);
            if (!rootMatch || !occMatch) return;
            const rootQ = rootMatch[0];
            const occQ = occMatch[0];
            // Trouver le filtre correspondant à ce rootQ
            const filter = this.availableFilters.find(f => f.occupationId === rootQ);
            if (!filter) return;
            const set = this.occupationClosureCache[filter.key] || new Set<string>();
            set.add(rootQ);
            set.add(occQ);
            this.occupationClosureCache[filter.key] = set;
          });
          this.occupationClosureLoaded = true;
          console.log('[PeopleComponent] Occupation closures chargées:', Object.fromEntries(Object.entries(this.occupationClosureCache).map(([k,v]) => [k, Array.from(v)])));
          // Relancer filtrage si des filtres sont déjà actifs
          const activeKeys = Array.from(this.selectedFilters);
            if (activeKeys.length) {
              this.selectedFilters$.next(activeKeys);
            }
        } catch (e) {
          console.error('[PeopleComponent] Erreur parsing SPARQL occupation closures', e);
        }
      },
      error: (err: any) => {
        console.warn('[PeopleComponent] Échec SPARQL occupation closures, fallback racines uniquement', err);
      },
      complete: () => {
        this.occupationClosureLoading = false;
      }
    });
  }

  toggleCombineMode() {
    this.combineDisjoint = !this.combineDisjoint;
    this.combineDisjoint$.next(this.combineDisjoint);
  }

  toggleFilter(filter: { key: string }) {
  if (this.advancedMode) return; // Ignorer en mode avancé
    // S'assurer que la fermeture a été demandée (lazy: on lance si pas encore)
    if (!this.occupationClosureLoaded && !this.occupationClosureLoading) {
      this.loadOccupationClosures();
    }
    if (this.selectedFilters.has(filter.key)) {
      this.selectedFilters.delete(filter.key);
    } else {
      this.selectedFilters.add(filter.key);
    }
    const activeKeys = Array.from(this.selectedFilters);
    console.log('[PeopleComponent] toggleFilter selection(keys)=', activeKeys);
    this.selectedFilters$.next(activeKeys);
  }

  isFilterSelected(filter: { key: string }) {
    return this.selectedFilters.has(filter.key);
  }

  // toggleCombineMode() déjà défini plus bas

  goToDisplay(itemId: string) {
    this.lastSearchRoute.setLastSearchRoute(this.router.url);
    console.log('Route mémorisée :', this.router.url); // <-- Ajoutez ceci
    this.router.navigate(['/item', itemId]);
  }

  ngOnInit(): void {
  // Préchargement (eager) des fermetures de sous-classes (peut être rendu lazy si souhaité)
  this.loadOccupationClosures();

    this.subTitle = this.lang.getTranslation('people', this.lang.selectedLang);
    this.home_page = this.lang.getTranslation('home_page', this.lang.selectedLang);
    this.places = this.lang.getTranslation('places', this.lang.selectedLang);
    this.advanced_search = this.lang.getTranslation('advanced_search', this.lang.selectedLang);
    this.projects = this.lang.getTranslation('projects', this.lang.selectedLang);
    this.fields = this.lang.getTranslation('fields', this.lang.selectedLang);
    this.bibliography = this.lang.getTranslation('bibliography', this.lang.selectedLang);

    this.selectedItemsList = this.selectedItemsList.filter(el => el !== null);

    this.pages = this.request.getStat().pipe(
      map(res => Object.values(res)[1].statistics.pages)
    );

    // Flux séparé pour le terme (debounce uniquement sur la saisie)
    const term$ = this.searchInput.valueChanges.pipe(
      startWith(''),
      map(v => (v || '').trim()),
      debounceTime(250),
      distinctUntilChanged()
    );

    // Flux immédiat pour les filtres (pas de debounce, différence structurelle)
    const filters$ = this.selectedFilters$.pipe(
      map(list => [...list]), // shallow copy
      distinctUntilChanged((a, b) => a.length === b.length && a.every((v, i) => v === b[i]))
    );

  const mode$ = this.combineDisjoint$.pipe(startWith(false));
  const advMode$ = this.advancedMode$.pipe(startWith(this.advancedMode));
  const advGroups$ = this.advancedGroups$.pipe(startWith(this.advancedGroups));

    this.labels = combineLatest([term$, filters$, mode$, advMode$, advGroups$]).pipe(
      tap(([term]) => {
        if (term.length < 2) {
          this.items = [];
          this.isDisplay = false;
          this.changeDetector.detectChanges();
        }
      }),
      filter(([term]) => term.length >= 2),
      switchMap(([term, activeKeys, disjoint]) => {
        const baseClause = 'haswbstatement:P131=Q268686';
        const termWithStar = term.endsWith('*') ? term : term + '*';
        // Désormais on n'insère PLUS les occupations dans srsearch: filtrage client pour plus de contrôle
        const srsearch = [baseClause, termWithStar].join(' ');
        const limit = term.length === 2 ? 100 : 200; // limitation volontaire pour requêtes très courtes
        console.log('[PeopleComponent] srsearch (sans occupations)=', srsearch, '| len=', term.length, '| limit=', limit, '| filtres=', activeKeys, '| mode=', disjoint ? 'OR' : 'AND');
        const searchUrl = `https://database.factgrid.de/w/api.php?action=query&list=search&format=json&origin=*&srsearch=${encodeURIComponent(srsearch)}&srnamespace=120&srlimit=${limit}`;
        return this.request.getItem(searchUrl).pipe(
          tap(res => console.log('Réponse CirrusSearch:', res))
        );
      }),
      map(res => {
        if (!res.query || !res.query.search) return [];
        const ids = res.query.search
          .map((item: any) => {
            const match = item.title.match(/Q\d+/);
            return match ? match[0] : null;
          })
          .filter((qid: string | null) => !!qid);
        console.log('Q-ids extraits:', ids);
        return ids;
      }),
      filter((ids: string[]) => ids.length > 0),
      switchMap((ids: string[]) => {
        const lang = this.lang.selectedLang;
        const chunks = chunkArray(ids, 50);
        const requests = chunks.map(chunk => {
          const idsParam = chunk.join('|');
          const getEntitiesUrl = `https://database.factgrid.de/w/api.php?action=wbgetentities&ids=${idsParam}&format=json&languages=${lang}&origin=*`;
          return this.request.getItem(getEntitiesUrl).pipe(
            map((res: any) => res && res.entities ? Object.values(res.entities) as WikibaseEntity[] : [])
          );
        });
        return requests.length > 0 ? forkJoin(requests).pipe(
          map(results => results.flat())
        ) : of([]);
      }),
      // Filtrage LOCAL des occupations
      map((entities: WikibaseEntity[]) => {
        const activeKeys = this.selectedFilters$.value;
        const disjoint = this.combineDisjoint;
        const advMode = this.advancedMode;
        const advGroups = this.advancedGroups;
        const occupationMap: Record<string, string> = this.availableFilters.reduce((acc, f) => { acc[f.key] = f.occupationId; return acc; }, {} as Record<string,string>);
        const occupationProperties = ['P165','P106'];
        // Préparer extraction des occIds pour chaque entité une seule fois
        return entities.filter((e: any) => {
          const occIds: string[] = [];
          for (const p of occupationProperties) {
            const claims = e.claims?.[p] || [];
            for (const c of claims) {
              const id = c?.mainsnak?.datavalue?.value?.id; if (id) occIds.push(id);
            }
          }
          if (occIds.length === 0) return false;
            const uniq = Array.from(new Set(occIds));
          if (advMode) {
            const groups = advGroups.filter(g => g.allOf.length > 0);
            if (groups.length === 0) return true; // pas de contrainte
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
      map((entities: WikibaseEntity[]) => {
        const searchTerm = (this.searchInput.value || '').toLowerCase();
        const lang = this.lang.selectedLang;
        return entities.filter((item: WikibaseEntity) => {
          const label = item.labels?.[lang]?.value?.toLowerCase() || '';
          const aliases = (item.aliases?.[lang] || []).map(a => a.value.toLowerCase());
          return (
            searchTerm === '' ||
            label.includes(searchTerm) ||
            aliases.some(alias => alias.includes(searchTerm))
          );
        });
      })
    ).subscribe((re: WikibaseEntity[]) => {
      this.items = this.setLanguage.item(re, this.lang.selectedLang);
      this.isDisplay = this.items.length > 0;
      this.changeDetector.detectChanges();
    });
  }

  ngOnDestroy(): void {
    if (this.labels) {
      this.labels.unsubscribe();
    }
  }
}

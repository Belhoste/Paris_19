import { Component, OnInit, AfterViewInit, ChangeDetectorRef, inject, ViewChildren, QueryList, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, Observable, of, BehaviorSubject, combineLatest, Subject } from 'rxjs';
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
import { OCCUPATION_FILTER_TRANSLATIONS } from '../config/translations.config';
import { LastSearchRouteService } from '../services/last-search-route.service'; 
import { SearchService, WikibaseEntity } from '../services/search.service';
import { PEOPLE_SEARCH_CONFIG, OccupationFilterConfig } from '../config/search-filters.config';
//import { SearchCacheService } from '../services/search-cache.service';

// WikibaseEntity importé depuis SearchService

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
export class PeopleComponent implements OnInit, AfterViewInit {
  private readonly debug = false;
  private changeDetector = inject(ChangeDetectorRef);
  private request = inject(RequestService);
  private setLanguage = inject(SetLanguageService);
  private lang = inject(SelectedLangService);
  private lastSearchRoute = inject(LastSearchRouteService);
  private router = inject(Router);
  private search = inject(SearchService);
//  private searchCache = inject(SearchCacheService);

  prosopography: string = "Prosopography Harmonia Universalis";
  animalMagnetism_subtitle: string = "a database on animal magnetism";
  home_page: string;
  bibliography: string;
  formerVisitsTitle: string = 'you have visited:';

  places: string = "Places";

  subTitle: string = "People";
  advanced_search: string = "advanced search";
  projects: string = "research projects";
  fields: string = "fields of research";

  warningMessage: string = "";
  minTermLength = 2;
  minLengthTooltip = 'Tapez au moins 2 caractères pour lancer la recherche';
  tooltipAny: string; // OR
  tooltipAll: string; // AND

  searchInput = new FormControl();
  filterInput = new FormControl('');
  public isDisplay: boolean = false;
  labels: Subscription;

  items: WikibaseEntity[] = [];
  private items$ = new BehaviorSubject<WikibaseEntity[]>([]);
  filteredItems$: Observable<any[]>; // any pour lever la contrainte TS sur label/description

  selectedItemsList: any[] = JSON.parse(localStorage.getItem('selectedItems')) || [];
  pages: Observable<number>;
  clickedItemId: string | null = null;

  // Filtres dynamiques 
  availableFilters: OccupationFilterConfig[] = PEOPLE_SEARCH_CONFIG.availableFilters
  .filter((f): f is OccupationFilterConfig => 'occupationId' in f)
  .map(f => ({ ...f, label: '' }));
  private selectedFilters = new Set<string>();
  // Observable des clés de filtres sélectionnés 
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
  // Gestion repli des filtres
  @ViewChildren('filterBtn') filterButtons!: QueryList<ElementRef<HTMLButtonElement>>;
  collapsedFilters = true;
  overflowFilterKeys = new Set<string>();
  private minCollapsibleFilters = 6;
  // Debounce resize for overflow computation
  private resize$ = new Subject<void>();
  private resizeSub?: Subscription;
  @HostListener('window:resize') onResize() { this.resize$.next(); }

  private emitAdvancedGroups() {
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

  private loadOccupationClosures() {
    if (this.occupationClosureLoaded || this.occupationClosureLoading) return;
    this.occupationClosureLoading = true;
    this.search.loadClosures(PEOPLE_SEARCH_CONFIG, this.availableFilters).subscribe((closures) => {
      this.occupationClosureCache = closures;
      this.occupationClosureLoaded = true;
      this.occupationClosureLoading = false;
      const activeKeys = Array.from(this.selectedFilters);
      if (activeKeys.length) this.selectedFilters$.next(activeKeys);
    });
  }

  toggleCombineMode() {
    this.combineDisjoint = !this.combineDisjoint;
    this.combineDisjoint$.next(this.combineDisjoint);
  }

  toggleFilter(filter: OccupationFilterConfig) {
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
  if (this.debug) console.log('[PeopleComponent] toggleFilter selection(keys)=', activeKeys);
    this.selectedFilters$.next(activeKeys);
    setTimeout(() => this.computeOverflowFilters(), 0);
  }

  isFilterSelected(filter: OccupationFilterConfig) {
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
  this.tooltipAny = this.lang.getTranslation('combination_any', this.lang.selectedLang) || '';
  this.tooltipAll = this.lang.getTranslation('combination_all', this.lang.selectedLang) || '';
  this.formerVisitsTitle = this.lang.getTranslation('formerVisitsTitle', this.lang.selectedLang) || 'Vous avez visité :'; // <-- Ajoutez cette ligne

    // Appliquer les traductions dynamiques pour les filtres
    const currentLang = this.lang.selectedLang;
    this.availableFilters = this.availableFilters.map(f => ({
      ...f,
      label: (OCCUPATION_FILTER_TRANSLATIONS as any)[f.key]?.[currentLang] || f.key
    }));

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
      switchMap(([term]) => this.search.searchIds(PEOPLE_SEARCH_CONFIG, term, this.minTermLength, this.lang.selectedLang)),
      filter((ids: string[]) => ids.length > 0),
      switchMap((ids: string[]) => this.search.fetchEntities(ids, this.lang.selectedLang)),
      map((entities: WikibaseEntity[]) => this.search.filterEntitiesByClasses(PEOPLE_SEARCH_CONFIG, entities, this.selectedFilters$.value, this.occupationClosureCache, this.advancedMode, this.advancedGroups, this.combineDisjoint)),
      map((entities: WikibaseEntity[]) => this.search.finalTextFilter(PEOPLE_SEARCH_CONFIG, entities, this.searchInput.value || '', this.lang.selectedLang))
    ).subscribe((re: WikibaseEntity[]) => {
      this.items = this.setLanguage.item(re, this.lang.selectedLang);
      // mettre à jour le BehaviorSubject réactif
      this.items$.next(this.items);
      this.isDisplay = this.items.length > 0;
      this.changeDetector.detectChanges();
    });

    // Ajout du filtrage local réactif basé sur items$
    this.filteredItems$ = combineLatest([
      this.items$,
      this.filterInput.valueChanges.pipe(startWith(''))
    ]).pipe(
      map(([items, filter]) => {
        if (!filter) return items;
        const f = (filter || '').toLowerCase();
        return items.filter(item => {
          const label = this.getItemLabel(item).toLowerCase();
          const desc = this.getItemDescription(item).toLowerCase();
          return label.includes(f) || desc.includes(f);
        });
      })
    );
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.computeOverflowFilters(), 0);
  this.resizeSub = this.resize$.pipe(debounceTime(150)).subscribe(() => this.computeOverflowFilters());
  }

  toggleCollapsedFilters() { this.collapsedFilters = !this.collapsedFilters; }
  private computeOverflowFilters() {
    try {
      if (!this.filterButtons || this.filterButtons.length === 0) { this.overflowFilterKeys.clear(); return; }
      const arr = this.filterButtons.toArray().filter(r => !!r && !!r.nativeElement);
      if (arr.length === 0) { this.overflowFilterKeys.clear(); return; }
      const firstEl = arr[0].nativeElement as HTMLElement;
      if (!firstEl || !firstEl.getBoundingClientRect) { this.overflowFilterKeys.clear(); return; }
      const firstTop = firstEl.getBoundingClientRect().top;
      this.overflowFilterKeys.clear();
      for (const ref of arr) {
        const el = ref.nativeElement as HTMLElement;
        if (!el || !el.getBoundingClientRect) continue;
        const top = el.getBoundingClientRect().top;
        const key = el.getAttribute('data-key');
        if (key && top - firstTop > 1) this.overflowFilterKeys.add(key);
      }
      if (this.availableFilters.length < this.minCollapsibleFilters) {
        this.overflowFilterKeys.clear();
      }
      if (this.overflowFilterKeys.size === 0) this.collapsedFilters = true;
    } catch (e) {
      // Fallback silencieux: on désactive overflow si un élément est introuvable (phase d'init)
      this.overflowFilterKeys.clear();
    }
    this.changeDetector.detectChanges();
  }

  ngOnDestroy(): void {
    if (this.labels) {
      this.labels.unsubscribe();
    }
  if (this.resizeSub) this.resizeSub.unsubscribe();
  }

  onItemRowClick(itemId: string) {
    this.clickedItemId = itemId;
    setTimeout(() => {
      this.clickedItemId = null;
      this.router.navigate(['/item', itemId]);
    }, 200);
  }

  // Helpers pour récupérer label/description de façon sûre
  private getItemLabel(item: any): string {
    if (!item) return '';
    if (typeof item.label === 'string' && item.label.trim()) return item.label;
    const lang = this.lang.selectedLang;
    if (item.labels && item.labels[lang] && item.labels[lang].value) return item.labels[lang].value;
    if (item.labels && item.labels.en && item.labels.en.value) return item.labels.en.value;
    return '';
  }

  private getItemDescription(item: any): string {
    if (!item) return '';
    if (typeof item.description === 'string' && item.description.trim()) return item.description;
    const lang = this.lang.selectedLang;
    if (item.descriptions && item.descriptions[lang] && item.descriptions[lang].value) return item.descriptions[lang].value;
    if (item.descriptions && item.descriptions.en && item.descriptions.en.value) return item.descriptions.en.value;
    return '';
  }
}

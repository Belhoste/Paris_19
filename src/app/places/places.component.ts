import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, inject, ViewChildren, QueryList, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, Observable, of, BehaviorSubject, combineLatest, Subject } from 'rxjs';
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
import { PLACE_FILTER_TRANSLATIONS } from '../config/translations.config';
import { SearchService, WikibaseEntity } from '../services/search.service';
import { PLACES_SEARCH_CONFIG, PlaceFilterConfig } from '../config/search-filters.config';

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

export class PlacesComponent implements OnInit, AfterViewInit, OnDestroy {
  private changeDetector = inject(ChangeDetectorRef);
  private request = inject(RequestService);
  private setLanguage = inject(SetLanguageService);
  private lang = inject(SelectedLangService);
  private lastSearchRoute = inject(LastSearchRouteService);
  private router = inject(Router);
  private search = inject(SearchService);

  title = 'Paris 19';
  subTitle: string = 'Places';
  bibliography: string;
  home_page: string = 'Home';
  people:string = 'People';
  formerVisitsTitle: string = 'you have visited:';

  minTermLength = 2;
  minLengthTooltip = 'Tapez au moins 2 caractères pour lancer la recherche';
  tooltipAny: string; // OR logic tooltip
  tooltipAll: string; // AND logic tooltip

  searchInput = new FormControl();
  public isDisplay: boolean = false;
  items: any[] = [];
  labels: Subscription; // abonnement principal
  pages: Observable<number>;
  selectedItemsList: any[] = JSON.parse(localStorage.getItem('selectedItems')) || [];

  // -------- Filtres dynamiques (placeholder) --------
  // Remplacez placeId par le Q-id racine correspondant au type de lieu (ex: instance of building, street, etc.)
  availableFilters: PlaceFilterConfig[] = PLACES_SEARCH_CONFIG.availableFilters
    .map(f => ({ ...f, label: '' }));
  private selectedFilters = new Set<string>();
  private selectedFilters$ = new BehaviorSubject<string[]>([]);
  combineDisjoint = false; // false = AND, true = OR
  private combineDisjoint$ = new BehaviorSubject<boolean>(false);

  // Gestion affichage compressé des filtres (seule première ligne visible)
  @ViewChildren('filterBtn') filterButtons!: QueryList<ElementRef<HTMLButtonElement>>;
  collapsedFilters = true; // état initial: replié si overflow
  overflowFilterKeys = new Set<string>();
  private minCollapsibleFilters = 6; // en dessous de ce nombre on désactive le repli

  // Debounce resize -> computeOverflowFilters
  private resize$ = new Subject<void>();
  private resizeSub?: Subscription;
  @HostListener('window:resize') onResize() { this.resize$.next(); }

  // Cache fermetures sous-classes (réutilise P3 * ). Même logique que People.
  private placeClosureCache: Record<string, Set<string>> = {};
  private placeClosureLoaded = false;
  private placeClosureLoading = false;

  // -------- Mode avancé (DNF) --------
  advancedMode = false;
  private advancedMode$ = new BehaviorSubject<boolean>(false);
  advancedGroups: { id: number; allOf: string[] }[] = [];
  private advancedGroups$ = new BehaviorSubject<{ id: number; allOf: string[] }[]>([]);
  private groupIdCounter = 0;
  expressionSummary = '';

  // Suppression des utilitaires locaux (externalisés dans SearchService)

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

  private loadplaceClosures() {
    if (this.placeClosureLoaded || this.placeClosureLoading || !this.availableFilters.length) return;
    this.placeClosureLoading = true;
    this.search.loadClosures(PLACES_SEARCH_CONFIG, this.availableFilters).subscribe((closures) => {
      this.placeClosureCache = closures;
      this.placeClosureLoaded = true;
      this.placeClosureLoading = false;
      const active = Array.from(this.selectedFilters); if (active.length) this.selectedFilters$.next(active);
    });
  }

  toggleCombineMode() { this.combineDisjoint = !this.combineDisjoint; this.combineDisjoint$.next(this.combineDisjoint); }
  toggleFilter(filter: { key: string }) {
    if (this.advancedMode) return;
    if (!this.placeClosureLoaded && !this.placeClosureLoading) this.loadplaceClosures();
    if (this.selectedFilters.has(filter.key)) this.selectedFilters.delete(filter.key); else this.selectedFilters.add(filter.key);
    this.selectedFilters$.next(Array.from(this.selectedFilters));
    // Recalcul overflow potentiellement (ex si styles modifient largeur active)
    setTimeout(() => this.computeOverflowFilters(), 0);
  }
  isFilterSelected(filter: { key: string }) { return this.selectedFilters.has(filter.key); }

  toggleCollapsedFilters() {
    this.collapsedFilters = !this.collapsedFilters;
    // Si on replie, rien d'autre; si on déplie pas de recalcul nécessaire
  }

  private computeOverflowFilters() {
    try {
      if (!this.filterButtons || this.filterButtons.length === 0) { this.overflowFilterKeys.clear(); return; }
      const buttons = this.filterButtons.toArray().filter(b => !!b && !!b.nativeElement);
      if (!buttons.length) { this.overflowFilterKeys.clear(); return; }
      const firstEl = buttons[0].nativeElement as HTMLElement;
      if (!firstEl || !firstEl.getBoundingClientRect) { this.overflowFilterKeys.clear(); return; }
      const firstTop = firstEl.getBoundingClientRect().top;
      this.overflowFilterKeys.clear();
      for (const ref of buttons) {
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
    } catch {
      this.overflowFilterKeys.clear();
    }
    this.changeDetector.detectChanges();
  }


  ngOnInit(): void {
    this.loadplaceClosures(); // eager (noop si pas de filtres)
    // Traductions
    this.people = this.lang.getTranslation('people', this.lang.selectedLang);
    this.home_page = this.lang.getTranslation('home_page', this.lang.selectedLang);
    this.subTitle = this.lang.getTranslation('places', this.lang.selectedLang);
    this.formerVisitsTitle = this.lang.getTranslation('formerVisitsTitle',this.lang.selectedLang)
  this.tooltipAny = this.lang.getTranslation('combination_any', this.lang.selectedLang) || '';
  this.tooltipAll = this.lang.getTranslation('combination_all', this.lang.selectedLang) || '';
    // Traductions dynamiques des filtres
    const currentLang = this.lang.selectedLang;
    this.availableFilters = this.availableFilters.map(f => ({
      ...f,
      label: (PLACE_FILTER_TRANSLATIONS as any)[f.key]?.[currentLang] || f.key
    }));
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
      switchMap(([term]) => this.search.searchIds(PLACES_SEARCH_CONFIG, term as string, this.minTermLength, this.lang.selectedLang)),
      filter((ids: string[]) => ids.length > 0),
      switchMap((ids: string[]) => this.search.fetchEntities(ids, this.lang.selectedLang)),
      map((entities: WikibaseEntity[]) => this.search.filterEntitiesByClasses(PLACES_SEARCH_CONFIG, entities, this.selectedFilters$.value, this.placeClosureCache, this.advancedMode, this.advancedGroups, this.combineDisjoint)),
      map((entities: WikibaseEntity[]) => this.setLanguage.item(entities, this.lang.selectedLang) as any[]),
      map((entities: any[]) => this.search.finalTextFilter(PLACES_SEARCH_CONFIG, entities as any, this.searchInput.value || '', this.lang.selectedLang) as any[])
    ).subscribe(list => {
      this.items = list;
      this.isDisplay = this.items.length > 0 && !(this.items[0]?.id === 'Q220375');
      this.changeDetector.detectChanges();
    });
  }

  ngAfterViewInit(): void {
    // Calcul initial après rendu
    setTimeout(() => this.computeOverflowFilters(), 0);
  // Debounce 150ms sur resize pour limiter recalculs layout
  this.resizeSub = this.resize$.pipe(debounceTime(150)).subscribe(() => this.computeOverflowFilters());
  }

  // createList obsolète – supprimé après mutualisation

  ngOnDestroy(): void { 
    if (this.labels) this.labels.unsubscribe(); 
    if (this.resizeSub) this.resizeSub.unsubscribe(); 
  }
}

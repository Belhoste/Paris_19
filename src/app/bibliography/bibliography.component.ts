import { LiveAnnouncer } from '@angular/cdk/a11y';
import { AfterViewInit, Component, OnInit, ChangeDetectionStrategy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Injectable } from '@angular/core';
import { SetDataService } from '../services/set-data.service';
import { ArrayToCsvService } from '../services/array-to-csv.service';
import { HuDatabaseService } from './services/hu-database.service';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatSort, Sort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map, filter, finalize, take } from 'rxjs/operators';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { SelectedLangService } from '../selected-lang.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LastSearchRouteService } from '../services/last-search-route.service';
import { ChangeDetectorRef } from '@angular/core';

export interface HU {
  author: { label: string, id: string };
  title: { label: string, id: string };
  location: { label: string, id: string };
  country?: { label: string, id: string }; 
  date: { value: string };
}

const columnMapping = {
  author: (data) => data.author?.label,
  title: (data) => data.title?.label,
  location: (data) => data.location?.label,
  date: (data) => data.date?.value,
};

@Component({
  selector: 'app-bibliography',
  imports: [
    CommonModule, MatTableModule, MatSortModule, MatIconModule, MatButtonModule,
    MatCardModule, RouterModule, MatPaginatorModule, MatInputModule, MatFormFieldModule,
    FormsModule, ReactiveFormsModule, MatSlideToggleModule, MatProgressSpinnerModule,
    MatTooltipModule, MatProgressBarModule
  ],
  templateUrl: './bibliography.component.html',
  styleUrl: './bibliography.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BibliographyComponent implements OnInit, AfterViewInit {
  private database = inject(HuDatabaseService);
  private _liveAnnouncer = inject(LiveAnnouncer);
  private csv = inject(ArrayToCsvService);
  private lang = inject(SelectedLangService);
  private lastSearchRoute = inject(LastSearchRouteService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Configuration du tableau
  public readonly displayedColumns: string[] = ['author', 'title', 'location', 'date'];
  dataSource: MatTableDataSource<HU> = new MatTableDataSource();
  dataSource$: Observable<any>;

  filtered;
  isMobile = window.innerWidth <= 600;

  // Traductions
  bibliography: string = "Bibliography";
  authorHeader: string = "Author";
  titleHeader: string = "Title";
  locationHeader: string = "Location";
  dateHeader: string = "Date";
  home_page: string = "Home";
  loadingBatchMessage: string = "Loading additional data";
  loadingMessage: string = "Loading data...";

  // État du filtre
  behavior$ = new BehaviorSubject<string>('');

  // Pagination
  length = 0;
  pageSize = 25;
  pageIndex = 0;
  pageSizeOptions = [10, 25, 50, 100, 500, 1000];
  hidePageSize = false;
  showPageSizeOptions = true;
  showFirstLastButtons = true;
  disabled = false;
  pageEvent: PageEvent;

  // État du chargement
  isSpinner: boolean = true;


  // Configuration du chargement par lots
  batchSize: number = 100;         // Taille du premier lot
  subsequentBatchSize: number = 1500; // Taille des lots suivants
  totalLoaded: number = 0;
  maxResults: number = 3000;
  isLoadingBatch: boolean = false;

  myLang: string = "%20.%0A%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22" + this.lang.selectedLang + "%22%2C%22en%22.%20%7D%0A%7D%0A";

  @ViewChild(MatSort)
  sort: MatSort;

  @ViewChild("paginator")
  paginator;

  ngOnInit() {
    this.initializeComponent();

    this.dataSource.filterPredicate = (data: HU, filter: string) => {
      const dataStr = [
        data.author?.label,
        data.title?.label,
        data.location?.label,
        data.date?.value
      ].join(' ').toLowerCase();
      return dataStr.includes(filter);
    };
  }

  ngAfterViewInit() {
    // Connecter le paginator et le tri après que la vue soit initialisée
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
    this.cdr.markForCheck();
  }

  private initializeComponent() {
    // Définir les traductions
    this.setTranslations();

    // Configurer la détection de la taille de l'écran
    this.setupResponsiveness();

    // Configurer le tri et le filtrage
    this.setupSorting();

    // Observer les changements de route
    this.setupRouteObserver();

    // Configurer la source de données (préparation)
    this.setupDataSource();

    // Démarrer le chargement intelligent
    this.loadDataInBatches();
  }

  private setTranslations() {
    this.bibliography = this.lang.getTranslation('bibliography', this.lang.selectedLang);
    this.authorHeader = this.lang.getTranslation('authorHeader', this.lang.selectedLang);
    this.titleHeader = this.lang.getTranslation('titleHeader', this.lang.selectedLang);
    this.locationHeader = this.lang.getTranslation('locationHeader', this.lang.selectedLang);
    this.dateHeader = this.lang.getTranslation('dateHeader', this.lang.selectedLang);
    this.home_page = this.lang.getTranslation('home_page', this.lang.selectedLang);
    this.loadingMessage = this.lang.getTranslation('loadingMessage', this.lang.selectedLang);
    this.loadingBatchMessage = this.lang.getTranslation('loadingBatchMessage', this.lang.selectedLang);
  }

  private setupResponsiveness() {
    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth <= 600;
      this.cdr.markForCheck();
    });
  }

  private setupSorting() {
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) =>
      columnMapping[sortHeaderId]
        ? columnMapping[sortHeaderId](data) || ''
        : data[sortHeaderId] || '';

    this.dataSource.sortData = (data, sort) => {
      const active = sort.active;
      const direction = sort.direction;
      if (!active || direction === '') {
        return data;
      }
      return data.slice().sort((a, b) => {
        const valueA = this.dataSource.sortingDataAccessor(a, active);
        const valueB = this.dataSource.sortingDataAccessor(b, active);
        const comparison = (valueA as string).localeCompare(valueB as string, 'fr', { sensitivity: 'base' });
        return direction === 'asc' ? comparison : -comparison;
      });
    };
  }

  private setupRouteObserver() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(event => {
        if (this.router.url === '/bibliography') {
          console.log('Navigation vers /bibliography détectée');
        }
      });
  }

  // Dans setupDataSource()
  private setupDataSource() {
    this.dataSource$ = combineLatest([this.behavior$, this.database.getBiblioData()]).pipe(
      map(([filter, data]) => {
        if (data) {
          // 1. Appliquer le filtre d'abord
          this.dataSource.filter = filter;

          // 2. Définir les données
          this.dataSource.data = data;

          // 3. Vérifier si les données ont changé
          if (this.length !== data.length) {
            this.length = data.length;

            // 4. Réinitialiser la pagination
            if (this.paginator) {
              this.pageIndex = 0; // Retour à la première page
              this.paginator.pageIndex = 0;

              // Réassigner le paginator pour force refresh
              setTimeout(() => {
                // Déconnecter et reconnecter le paginator
                this.dataSource.paginator = null;
                this.dataSource.paginator = this.paginator;
                this.cdr.markForCheck();
              });
            }
          }

          // 5. Connecter le tri
          if (this.sort && !this.dataSource.sort) {
            this.dataSource.sort = this.sort;
          }
        }
        return this.dataSource;
      })
    );

    // S'abonner pour recevoir les mises à jour
    this.dataSource$.subscribe();
  }


  loadDataInBatches() {
    // Initialiser l'état
    this.isSpinner = true;
   this.loadingMessage;
    this.cdr.markForCheck();

    // Vérifier si des données existent déjà
    const existingData = this.database.getCurrentData();
    console.log('existingData:', existingData);
    if (existingData && existingData.length > 0) {
      this.totalLoaded = existingData.length;
      this.length = existingData.length;

      // Afficher immédiatement les données existantes
      this.isSpinner = false;
      this.cdr.markForCheck();

      // Charger la suite si nécessaire
      if (existingData.length < this.maxResults) {
        this.loadRemainingBatches(existingData.length);
      }
      return;
    }

    // Aucune donnée existante - charger le premier lot
    this.loadFirstBatch();
  }

  // Dans la méthode loadFirstBatch()
 private loadFirstBatch() {
    this.isSpinner = true;
    this.loadingMessage;
    this.cdr.markForCheck();

    console.log('Début du chargement de la bibliographie');
    const sparqlQuery = this.database.sparqlBuilding(this.myLang, this.batchSize, 0);
    console.log('sparqlQuery générée:', sparqlQuery);
    const sparqlApiUrl = this.database.newSparqlAdress(sparqlQuery);

    this.database.databaseToDisplay(sparqlApiUrl).subscribe({
      next: (batchData) => {
        if (batchData && batchData.length > 0) {

          // Déduplication globale sur title.id
          const dedupedData = this.deduplicateByTitleId(batchData);

          this.totalLoaded = dedupedData.length;

          // Limiter les données initiales pour un affichage plus rapide
          const initialDisplayData = dedupedData.slice(0, this.pageSize);

          // Mettre à jour les données complètes dans le service
          this.database.updateBiblioData(dedupedData);
          this.length = dedupedData.length;

          // Afficher d'abord un sous-ensemble pour performance
          this.dataSource.data = initialDisplayData;

          // Masquer le spinner principal
          this.isSpinner = false;
          this.cdr.markForCheck();

          // Ensuite mettre à jour avec toutes les données du lot
          setTimeout(() => {
            this.dataSource.data = dedupedData;
            this.dataSource.paginator = this.paginator;
            this.dataSource.sort = this.sort;
            this.cdr.markForCheck();

            // Continuer le chargement en arrière-plan
            if (dedupedData.length > 0 && this.totalLoaded < this.maxResults) {
              setTimeout(() => {
                this.loadRemainingBatches(this.totalLoaded);
              }, 500);
            }
          }, 100);
        } else {
          // Aucune donnée
          console.log('Aucune donnée trouvée');
          this.isSpinner = false;
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement du premier lot:', err);
        this.isSpinner = false;
        this.cdr.markForCheck();
      }
    });
  }
  

  private loadRemainingBatches(offset: number) {
    this.isLoadingBatch = true;

    const loadNextBatch = (currentOffset: number) => {
      if (currentOffset >= this.maxResults || !this.isLoadingBatch) {
        this.isLoadingBatch = false;
        return;
      }

      const batchSize = this.subsequentBatchSize;
      const sparqlQuery = this.database.sparqlBuilding(this.myLang, batchSize, currentOffset);
      const sparqlApiUrl = this.database.newSparqlAdress(sparqlQuery);

      this.database.databaseToDisplay(sparqlApiUrl).subscribe({
        next: (batchData) => {
          if (batchData && batchData.length > 0) {
            const currentData = this.database.getCurrentData() || [];
            // Fusionner et dédupliquer
            const mergedData = this.deduplicateByTitleId([...currentData, ...batchData]);
            this.totalLoaded = mergedData.length;
            this.database.updateBiblioData(mergedData);
            this.length = mergedData.length;
            this.cdr.markForCheck();

            if (batchData.length === batchSize && this.totalLoaded < this.maxResults) {
              setTimeout(() => {
                loadNextBatch(currentOffset + batchSize);
              }, 500);
            } else {
              this.isLoadingBatch = false;
              this.cdr.markForCheck();
            }
          } else {
            this.isLoadingBatch = false;
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          console.error('Erreur lors du chargement d\'un lot:', err);
          this.isLoadingBatch = false;
          this.cdr.markForCheck();
        }
      });
    };

    loadNextBatch(offset);
  }

  private deduplicateByTitleId(entries: HU[]): HU[] {
    const seen = new Set<string>();
    return entries.filter(entry => {
      const key = entry.title?.id?.trim();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  getHeaderLabel(column: string): string {
    switch (column) {
      case 'author': return this.authorHeader;
      case 'title': return this.titleHeader;
      case 'location': return this.locationHeader;
      case 'date': return this.dateHeader;
      default: return column;
    }
  }

  clickedItemId: string | null = null;

  onItemClick(itemId: string) {
    this.clickedItemId = itemId;
    setTimeout(() => this.clickedItemId = null, 300);
    this.goToDisplay(itemId);
  }

  goToDisplay(itemId: string) {
    this.lastSearchRoute.setLastSearchRoute(this.router.url);
    console.log('Route mémorisée :', this.router.url);
    this.router.navigate(['/item', itemId]);
  }

  onClick(query) {
    let u = query;
    u = this.database.databaseToDownload(query);
    let v = this.csv.arrayToCsv(u);
    this.csv.downloadBlob(v, "biblio_Paris_19", "text/csv;charset=utf-8;");
  }

  applyFilter(event) {
    const filterValue = event.target.value.trim().toLowerCase();
    this.behavior$.next(filterValue);

    // Réinitialiser la pagination après filtrage
    if (this.paginator) {
      this.paginator.firstPage();
    }

    // Vérifier s'il y a des résultats après filtrage
   setTimeout(() => {
      if (this.dataSource.filteredData && this.dataSource.filteredData.length > 0) {
        this.filtered = this.dataSource.filteredData[0].author?.label;
      }
    });
  }

  handlePageEvent(e: PageEvent) {
    console.log('Page event:', e);
    this.pageEvent = e;
    this.length = e.length;
    this.pageSize = e.pageSize;
    this.pageIndex = e.pageIndex;
    this.cdr.markForCheck();
  }

  setPageSizeOptions(setPageSizeOptionsInput: string) {
    if (setPageSizeOptionsInput) {
      this.pageSizeOptions = setPageSizeOptionsInput.split(',').map(str => +str);
    }
  }

  setSort(column: string) {
    if (this.sort.active === column) {
      this.sort.direction = this.sort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sort.active = column;
      this.sort.direction = 'asc';
    }
    this.sort.sortChange.emit({ active: this.sort.active, direction: this.sort.direction });
  }
}

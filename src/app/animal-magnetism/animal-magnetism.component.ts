import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, Observable, forkJoin, of } from 'rxjs';
import { map, tap, switchMap, debounceTime, filter } from 'rxjs/operators';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterModule, Router } from '@angular/router';
import { SetLanguageService } from '../services/set-language.service';
import { RequestService } from '../services/request.service';
import { SelectedLangService } from '../selected-lang.service';
import { LastSearchRouteService } from '../services/last-search-route.service'; 

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
    selector: 'app-animal-magnetism',
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
    ],
    templateUrl: './animal-magnetism.component.html',
    styleUrls: ['./animal-magnetism.component.scss']
})
export class AnimalMagnetismComponent implements OnInit {
  private changeDetector = inject(ChangeDetectorRef);
  private request = inject(RequestService);
  private setLanguage = inject(SetLanguageService);
  private lang = inject(SelectedLangService);
  private lastSearchRoute = inject(LastSearchRouteService);
  private router = inject(Router);



  prosopography: string = "Prosopography Harmonia Universalis";
  animalMagnetism_subtitle: string = "a database on animal magnetism";
  home_page: string;
  bibliography: string;

  subTitle: string = "a database on animal magnetism";
  advanced_search: string = "advanced search";
  projects: string = "research projects";
  fields: string = "fields of reserach";

  warningMessage: string = "";

  searchInput = new FormControl();
  public isDisplay: boolean = false;
  labels: Subscription;
  items: WikibaseEntity[] = [];
  selectedItemsList: any[] = JSON.parse(localStorage.getItem('selectedItems')) || [];
  pages: Observable<number>;

  goToDisplay(itemId: string) {
    this.lastSearchRoute.setLastSearchRoute(this.router.url);
    console.log('Route mémorisée :', this.router.url); // <-- Ajoutez ceci
    this.router.navigate(['/item', itemId]);
  }

  ngOnInit(): void {

    this.animalMagnetism_subtitle = this.lang.getTranslation('home_subtitle', this.lang.selectedLang);
    console.log('Sous-titre:', this.animalMagnetism_subtitle);
    this.subTitle = this.lang.getTranslation('subTitle', this.lang.selectedLang);
    this.home_page = this.lang.getTranslation('home_page', this.lang.selectedLang);
    this.advanced_search = this.lang.getTranslation('advanced_search', this.lang.selectedLang);
    this.projects = this.lang.getTranslation('projects', this.lang.selectedLang);
    this.fields = this.lang.getTranslation('fields', this.lang.selectedLang);
    this.bibliography = this.lang.getTranslation('bibliography', this.lang.selectedLang);

    this.selectedItemsList = this.selectedItemsList.filter(el => el !== null);

    this.pages = this.request.getStat().pipe(
      map(res => Object.values(res)[1].statistics.pages)
    );

    this.labels = this.searchInput.valueChanges.pipe(
      debounceTime(250),
      tap(label => {
        if (!label || label.length === 0) {
          this.items = [];
          this.isDisplay = false;
          this.changeDetector.detectChanges();
        }
      }),
    //  filter(label => !!label && label.length >= 4),
      switchMap(label => {
        const searchTerm = label.endsWith('*') ? label : label + '*';
        const searchUrl = `https://database.factgrid.de/w/api.php?action=query&list=search&format=json&origin=*&srsearch=haswbstatement:P131=Q99677${searchTerm ? ' ' + searchTerm : ''}&srnamespace=120&srlimit=200`;
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

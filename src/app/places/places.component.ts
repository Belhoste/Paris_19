import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, BehaviorSubject, combineLatest, startWith } from 'rxjs';
import { map, switchMap, tap, debounceTime, filter, distinctUntilChanged } from 'rxjs/operators';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule} from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
//import { RouterLinkActive, RouterLink, RouterOutlet } from '@angular/router';
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
        MatTableModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
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


  //  selectedLang: string = (localStorage['selectedLang']===undefined)? "en": localStorage['selectedLang']; //initialization of the storage of the selected language (english)

    title = 'Paris 19';
    subTitle:string = "Places";
    advanced_search:string = "advanced search";
    projects:string = "research projects";
    fields: string = "fields of reserach";
    bibliography: string = "bibliography";
    home_page: string = "Home";

  // Champ de recherche réactif (démarre vide, seul le placeholder s'affiche)
  searchInput = new FormControl<string>('', { nonNullable: true });

  public selectedItem:Observable<any>;
  public isDisplay:boolean = false; // piloté via le flux items$

  // Flux optimisé des items localisés affichés
  items$: Observable<any[]>; // utilisé dans le template via async pipe

    data$ = new Observable<string[]>();
    searchQuery$ = new BehaviorSubject<string>('');
    
    labels
    items = [];
    newItem;
    itemId: string;
    pages: any

    private baseGetURL = 'https://database.factgrid.de//w/api.php?action=wbgetentities&ids=' ;
    private getUrlSuffix= '&format=json&origin=*' ;

    formerVisitsTitle:string = "you have visited:";
    selectedItemsList: any[] = JSON.parse(localStorage.getItem('selectedItems'));


  
  goToDisplay(itemId: string) {
    this.lastSearchRoute.setLastSearchRoute(this.router.url);
    this.router.navigate(['/item', itemId]);
  }

  ngOnInit(): void {

    this.bibliography = this.lang.getTranslation('bibliography', this.lang.selectedLang);

    this.home_page = this.lang.getTranslation('home_page', this.lang.selectedLang);

    this.subTitle = this.lang.getTranslation('places', this.lang.selectedLang);

    this.advanced_search = this.lang.getTranslation('advanced_search',this.lang.selectedLang);

    this.projects = this.lang.getTranslation('projects',this.lang.selectedLang);

    this.fields = this.lang.getTranslation('fields',this.lang.selectedLang);

    this.formerVisitsTitle = this.lang.getTranslation('formerVisitsTitle',this.lang.selectedLang)

    this.selectedItemsList = this.selectedItemsList.filter(function (el) { return (el !== null) });

    this.pages = this.request.getStat().pipe(map(res => Object.values(res)[1].statistics.pages));
    //  this.pages.subscribe(res => console.log(res));

    //   this.pages = this.stat();

    //   console.log(this.pages);
    /*
     this.subtitle = "a database for historians"
      if (this.selectedLang === "de") { this.subtitle = "eine Databank für Historiker*innen" }
      if (this.selectedLang === "fr") { this.subtitle = "une base de données pour historien.nes"}
      if (this.selectedLang === "es") { this.subtitle = "una base de datos para historiadores"}
      if (this.selectedLang === "it") { this.subtitle = "un database per gli storici"}
  
      this.advanced_search = "advanced search"
      if (this.selectedLang === "de") { this.advanced_search = "erweiterte Suche" }
      if (this.selectedLang === "fr") { this.advanced_search = "recherche avancée"}
      if (this.selectedLang === "es") { this.advanced_search = "búsqueda avanzada"}
      if (this.selectedLang === "it") { this.advanced_search = "ricerca avanzata"}
  
      this.projects = "research projects"
      if (this.selectedLang === "de") { this.projects = "Forschungsprojekten" }
      if (this.selectedLang === "fr") { this.projects = "projets de recherche"}
      if (this.selectedLang === "es") { this.projects = "proyectos de investigación"}
      if (this.selectedLang === "it") { this.projects = "progetti di ricerca"}
  
      this.fields = "fields of research"
      if (this.selectedLang === "de") { this.fields = "Forschungsfelder" }
      if (this.selectedLang === "fr") { this.fields = "domaines de recherche"}
      if (this.selectedLang === "es") { this.projects = "campos de investigación"}
      if (this.selectedLang === "it") { this.projects = "aree di ricerca"}
        
      this.formerVisitsTitle = "you have visited:"
      if(this.selectedLang === "de") {this.formerVisitsTitle = "Sie haben besucht:"};
      if(this.selectedLang === "fr") {this.formerVisitsTitle = "vous avez visité :"};
      if(this.selectedLang === "es") {this.formerVisitsTitle = "has visitado :"}
      if(this.selectedLang === "it") {this.formerVisitsTitle = "hai visitato :"}
  
      */

    console.log(this.selectedItemsList);
    console.log(this.labels);


    // Nouveau flux: une seule chaîne RxJS, distinctUntilChanged et un seul debounce suffisent.
    const emptyEntitiesUrl = "https://database.factgrid.de//w/api.php?action=wbgetentities&ids=&format=json&origin=*";
    const fallbackUrl = "https://database.factgrid.de//w/api.php?action=wbgetentities&ids=Q220375&format=json&origin=*";

    const itemsStream = this.searchInput.valueChanges.pipe(
      startWith(''),
      map(v => (v ?? '').trim()),
      distinctUntilChanged(),
      debounceTime(400),
      switchMap(query => {
        if (query.length < 2) {
          return [] as any; // renvoie tableau vide – pas de requête
        }
        const label = "Paris, " + query;
        return this.request.searchItem(label, this.lang.selectedLang).pipe(
          map(res => this.createList(res)),
          map(url => url === emptyEntitiesUrl ? fallbackUrl : url),
          switchMap(url => this.request.getItem(url)),
          filter(res => !!res && !!res.entities),
          map(res => Object.values(res.entities)),
          map(entities => this.setLanguage.item(entities, this.lang.selectedLang) as any[])
        );
      }),
      map(res => Array.isArray(res) ? res : []),
      tap(localized => {
        this.items = localized;
        this.isDisplay = localized.length > 0 && !(localized[0]?.id === 'Q220375');
      })
    ) as unknown as Observable<any[]>;

  this.items$ = itemsStream;
    }

   createList(re) {  //create an url whith the elements of an array
    let list = "";
    let url = "";
    let arr = re.search;
    if ( arr === undefined ) { arr = []}
    else { arr = arr };
    for (let i = 0; i < arr.length; i++) {
      list = list+"|"+arr[i].id;    
    };
    list = list.slice(1) ;
    url = this.baseGetURL+list+this.getUrlSuffix;
    return url
    }

  addParis(re) { // (non utilisée après refactor, conservée si appelée ailleurs)
    return "Paris, " + re;
  }

  // Plus d'unsubscribe manuel nécessaire : items$ est utilisé via async pipe dans le template.
  ngOnDestroy(): void { }
   
   }

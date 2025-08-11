import { Component, OnInit, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { SelectedLangService } from '../selected-lang.service';



@Component({
    selector: 'app-home',
    imports: [MatCardModule, MatButtonModule, RouterModule],
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private lang = inject(SelectedLangService);
  private myLang: string = "%20.%0A%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22" + this.lang.selectedLang + "%22%2C%22en%22.%20%7D%0A%7D%0A";

  home_subtitle: string;
  search: string;
  people: string;
  places: string;
  bibliography: string;
  searchOnPlaces: string;
  searchOnPeople: string;
  searchOnFactGrid: string;

  ngOnInit(): void {
    // Initialisation des traductions
    this.home_subtitle = this.lang.getTranslation('home_subtitle', this.lang.selectedLang);
    this.searchOnPeople = this.lang.getTranslation('searchOnPeople', this.lang.selectedLang);
    this.places = this.lang.getTranslation('places', this.lang.selectedLang);
    this.searchOnPlaces = this.lang.getTranslation('searchOnPlaces', this.lang.selectedLang);
    this.people = this.lang.getTranslation('people', this.lang.selectedLang);
    this.searchOnFactGrid = this.lang.getTranslation('searchOnFactGrid', this.lang.selectedLang);
    this.search = this.lang.getTranslation('search', this.lang.selectedLang);

    console.log('home_subtitle:', this.home_subtitle);

  


  }

}



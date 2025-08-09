import { Injectable, inject } from '@angular/core';
import { RequestService } from '../../services/request.service';
import { map, tap } from 'rxjs/operators';
import { Observable, BehaviorSubject } from 'rxjs';
import { SelectedLangService } from '../../selected-lang.service';

export interface HUEntry {
  author: { id: string; label: string } | undefined;
  title: { id: string; label: string } | undefined;
  location: { id: string; label: string } | undefined;
  country?: { id: string; label: string } | undefined;
  date: { value: string };
}

@Injectable({
  providedIn: 'root'
})

export class HuDatabaseService {
  private request = inject(RequestService);
  private lang = inject(SelectedLangService);

  private biblioData$ = new BehaviorSubject<HUEntry[]>(null);

  myLang: string = "%20.%0A%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22" + this.lang.selectedLang + "%22%2C%22en%22.%20%7D%0A%7D%0A";

  sparqlBuilding(myLang: string, limit?: number, offset?: number): string {
    const baseUrl = "https://database.factgrid.de/query/#";
    let select = `
SELECT DISTINCT ?title ?titleLabel ?author ?authorLabel ?date ?location ?locationLabel ?country ?countryLabel
WHERE {
  VALUES ?c { wd:Q21925 wd:Q11317 }
  ?title wdt:P2 wd:Q20;
         wdt:P243 wd:Q172203;
         wdt:P21 ?author;
         wdt:P222 ?date;
         wdt:P241 ?location
  ${decodeURIComponent(myLang)}
`.trim();

    // Ajout de LIMIT et OFFSET dans la requête SPARQL AVANT l'encodage
    if (limit !== undefined) {
      select += `\nLIMIT ${limit}`;
    }
    if (offset !== undefined && offset > 0) {
      select += `\nOFFSET ${offset}`;
    }

    // Supprimer les retours à la ligne pour l'encodage
    const selectOneLine = select.replace(/\n/g, ' ');

    const query = baseUrl + encodeURIComponent(selectOneLine);

    return query;
  }
  // Ajoutez cette méthode pour mettre à jour les données
  updateBiblioData(data: HUEntry[]): void {
    this.biblioData$.next(data);
  }


  listFromSparql(res: any): HUEntry[] {
    if (!res?.results?.bindings) return [];

    return res.results.bindings.map(binding => ({
      author: binding.author ? {
        id: binding.author.value.replace("https://database.factgrid.de/entity/", ""),
        label: binding.authorLabel?.value || ""
      } : undefined,
      title: binding.title ? {
        id: binding.title.value.replace("https://database.factgrid.de/entity/", ""),
        label: binding.titleLabel?.value || ""
      } : undefined,
      location: binding.location ? {
        id: binding.location.value.replace("https://database.factgrid.de/entity/", ""),
        label: binding.locationLabel?.value || ""
      } : undefined,
      country: binding.country ? {
        id: binding.country.value.replace("https://database.factgrid.de/entity/", ""),
        label: binding.countryLabel?.value || ""
      } : undefined,
      date: {
        value: binding.date?.value ? binding.date.value.slice(0, 4) : ""
      }
    }));
  }

  // Cette méthode retourne l'observable
  databaseToDisplay(sparql: string): Observable<HUEntry[]> {
    return this.request.getList(sparql).pipe(
      map(res => this.listFromSparql(res)),
    );
  }

  // Cette méthode gère le cache : elle souscrit et alimente le BehaviorSubject
  loadBiblioData(sparql: string): void {
    this.databaseToDisplay(sparql).subscribe({
      next: data => this.biblioData$.next(data),
      error: err => console.error('Erreur lors du chargement des données', err)
    });
  }

  // Observable pour accéder à la donnée en cache
  getBiblioData(): Observable<HUEntry[]> {
    return this.biblioData$.asObservable();
  }

  // Accès à la valeur actuelle sans abonnement
  getCurrentData(): HUEntry[] {
    return this.biblioData$.getValue();
  }


  newSparqlAdress(address: string): string {
    const newPrefix = "https://database.factgrid.de/sparql?query=";
    let oldPrefix = "https://database.factgrid.de/query/#";
    if (address.includes('embed.html')) { oldPrefix = "https://database.factgrid.de/query/embed.html#"; }
    if (address !== undefined) address = address.replace(oldPrefix, newPrefix);
    return address;
  }

  databaseToDownload(data: any[]): any[][] {
    let dataToDownload: any[][] = [["author", "author.id", "title", "title.id", "location", "location.id", "country", "country.id", "date"]];
    for (let i = 0; i < data.length; i++) {
      dataToDownload[i + 1] = [
        data[i].author.label, data[i].author.id,
        data[i].title.label, data[i].title.id,
        data[i].location.label, data[i].location.id,
        data[i].country.label, data[i].country.id,
        data[i].date.value
      ];
    }
    return dataToDownload;
  }

  // hu-database.service.ts

  initBiblioData(sparql: string): void {
    if (!this.biblioData$.getValue() || this.biblioData$.getValue().length === 0) {
      this.loadBiblioData(sparql);
    }
  }

}

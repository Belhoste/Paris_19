import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { saveAs } from 'file-saver-es';
import { expand, map, reduce, catchError } from 'rxjs/operators';


@Injectable({
  providedIn: 'root'
})
export class RequestService {
  private http = inject(HttpClient);

  private baseSearchURL = 'https://database.factgrid.de//w/api.php?action=wbsearchentities&search=';
  private baseGetURL = 'https://database.factgrid.de//w/api.php?action=wbgetentities&ids=';
  private searchUrlSuffix = '&language=en&uselang=fr&limit=50&format=json&origin=*';
  private getUrlSuffix = '&format=json&origin=*';

  /**
   * Récupère les propriétés via un tableau de listes (max 8).
   */
  requestProperties(propertiesLists: string[]): Observable<any[]> {
    const lists = [...propertiesLists];
    while (lists.length < 8) lists.push(undefined);

    const requests = lists.map(list =>
      list
        ? this.http.get(this.baseGetURL + list + this.getUrlSuffix).pipe(
          catchError(() => of(undefined))
        )
        : of(undefined)
    );

    return forkJoin(requests);
  }

  /**
   * Récupère les items via un tableau de listes (max 8).
   */
  requestItems(itemsLists: string[]): Observable<any[]> {
    const lists = [...itemsLists];
    while (lists.length < 8) lists.push(undefined);

    const requests = lists.map(list =>
      list
        ? this.http.get(this.baseGetURL + list + this.getUrlSuffix).pipe(
          catchError(() => of(undefined))
        )
        : of(undefined)
    );

    return forkJoin(requests);
  }

  searchItem(label: string, lang: string, offset: number = 0, limit: number = 50) {
    const params = new HttpParams()
      .set('action', 'wbsearchentities')
      .set('search', label)
      .set('language', lang)
      .set('uselang', lang)
      .set('limit', limit.toString())
      .set('format', 'json')
      .set('origin', '*')
      .set('offset', offset.toString());
      ;
    return this.http.get('https://database.factgrid.de//w/api.php', { params });
  }

  searchProperty(label: string, lang: string) {
    const params = new HttpParams()
      .set('action', 'wbsearchentities')
      .set('type', 'property')
      .set('search', label)
      .set('language', lang)
      .set('uselang', lang)
      .set('limit', '50')
      .set('format', 'json')
      .set('origin', '*');
    return this.http.get('https://database.factgrid.de//w/api.php', { params });
  }

  getAsk(re: string): Observable<any> {
    return this.http.get(re).pipe(catchError(() => of(false)));
  }

  getItem(re: string): Observable<any> {
    return this.http.get(re).pipe(catchError(() => of(undefined)));
  }

  getList(sparql: string): Observable<any> {
    if (sparql !== undefined) {
      const params = new HttpParams().set('format', 'json');
      return this.http.get(sparql, { params }).pipe(catchError(() => of([])));
    }
    return of([]);
  }

  downLoadList(sparql: string) {
    if (sparql !== undefined) {
      const headers = new HttpHeaders().set('Accept', 'text/csv');
      const params = new HttpParams();
      this.http.get(sparql, { headers, responseType: 'arraybuffer', params })
        .subscribe(response => this.downLoadFile(response));
    }
  }

  getTranscript(id: string) {
    const params = new HttpParams()
      .set('page', id)
      .set('format', 'json')
      .set('prop', 'text')
      .set('formatversion', '2')
      .set('origin', '*');
    return this.http.get('https://database.factgrid.de//w/api.php?action=parse', { params });
  }

  getItemTalkPageHtml(itemId: string): Observable<any> {
    const pageTitle = `Item_talk:${itemId}`;
    const params = new HttpParams()
      .set('action', 'query')
      .set('format', 'json')
      .set('prop', 'revisions')
      .set('titles', pageTitle)
      .set('rvprop', 'content')
      .set('origin', '*');
    const url = 'https://database.factgrid.de/w/api.php';
    return this.http.get(url, { params }).pipe(catchError(() => of(undefined)));
  }

  getStat() {
    const params = new HttpParams()
      .set('format', 'json')
      .set('meta', 'siteinfo')
      .set('siprop', 'statistics')
      .set('origin', '*');
    return this.http.get('https://database.factgrid.de//w/api.php?action=query', { params });
  }

  newSparqlAddress(address: string) {
    const newPrefix = 'https://database.factgrid.de/sparql?query=';
    const oldPrefix = 'https://database.factgrid.de/query/#';
    return address.replace(oldPrefix, newPrefix);
  }

  downLoadFile(data: any) {
    const blob = new Blob([data], { type: 'text/csv' });
    saveAs(blob, 'list.csv');
  }

  getExpandedUrl(url: string) {
    if (url !== undefined) {
      const headers = new HttpHeaders().set('Accept', 'text/csv');
      const params = new HttpParams();
      this.http.get(url, { headers, responseType: 'arraybuffer', params })
        .subscribe(response => this.downLoadFile(response));
    }
  }

  getProjectList(re: string): Observable<any> {
    return this.http.get(re).pipe(catchError(() => of(false)));
  }

  getBackList(item: string, lang: string): Observable<any> {
    item = 'Item:' + item;
    const prefix = `https://database.factgrid.de/w/api.php?`;
    const params1 = new HttpParams()
      .set('action', 'query')
      .set('format', 'json')
      .set('prop', 'entityterms')
      .set('generator', 'backlinks')
      .set('formatversion', '2')
      .set('wbetterms', 'label')
      .set('gbllimit', '500')
      .set('gblnamespace', '120')
      .set('uselang', lang)
      .set('gbltitle', item)
      .set('origin', '*');
    const params2 = params1.set('uselang', 'en');
    const u1 = this.http.get(prefix, { params: params1 }).pipe(catchError(() => of(undefined)));
    const u2 = this.http.get(prefix, { params: params2 }).pipe(catchError(() => of(undefined)));
    return forkJoin([u1, u2]);
  }


  /** Envoi SPARQL robuste: POST (évite longueur d'URL) avec fallback GET */
  private runSparql(query: string): Observable<any> {
    const endpoint = 'https://database.factgrid.de/sparql';
    const body = new HttpParams().set('query', query);
    const headers = new HttpHeaders({
      'Accept': 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded'
    });
    return this.http.post<any>(endpoint, body.toString(), { headers }).pipe(
      catchError(() =>
        this.http.get<any>(endpoint + '?query=' + encodeURIComponent(query) + '&format=json')
      ),
      catchError((_e: HttpErrorResponse) => of({ results: { bindings: [] } }))
    );
  }

  getResearchProjects(): Observable<any[]> {
    const sparql = `
      SELECT ?item ?itemLabel WHERE {
        ?item wdt:P131 ?project .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
      }`;
    return this.runSparql(sparql).pipe(
      map(res =>
        (res?.results?.bindings || []).map((b: any) => ({
          id: b.item?.value?.split('/')?.pop() || '',
          name: b.itemLabel?.value || ''
        }))
      ),
      catchError(() => of([]))
    );
  }

  /**
   * Récupère les adresses (items) liées à une rue (Q-id), avec latitude/longitude.
   * Utilise le nœud de valeur psv:P48 pour extraire wikibase:geoLatitude/geoLongitude (plus robuste que parser le WKT).
   * @param streetQid ex: 'Q272159'
   * @param lang langue pour les labels (par défaut 'fr')
   */
  getStreetAddresses(streetQid: string, lang: string = 'fr'): Observable<Array<{ id: string; label: string; lat: number; lng: number; p646Id?: string; p646Label?: string; p646Raw?: string }>> {
    const qid = (streetQid || '').replace(/^wd:/i, '');
    if (!/^Q\d+$/.test(qid)) {
      return of([]);
    }
    const sparql = `SELECT ?item ?itemLabel ?lat ?lng ?p646 ?p646Label WHERE {
      VALUES ?street { wd:${qid} }
      ?item wdt:P47 ?street ;
            p:P48/psv:P48 ?c .
      ?c wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lng .
      OPTIONAL { ?item wdt:P646 ?p646 }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},[AUTO_LANGUAGE],en". }
    }`;
    const url = 'https://database.factgrid.de/sparql?query=' + encodeURIComponent(sparql) + '&format=json';
    return this.http.get<any>(url).pipe(
      map(res => {
        const bindings = res?.results?.bindings || [];
        return bindings.map((b: any) => {
          const id = (b.item?.value || '').match(/Q\d+/)?.[0] || '';
          const label = b.itemLabel?.value || id;
          const lat = parseFloat(b.lat?.value || '');
          const lng = parseFloat(b.lng?.value || '');
          const p646Raw = b.p646?.value;
          const p646Label = b.p646Label?.value;
          const p646IdMatch = (p646Raw || '').match(/Q\d+/);
          const p646Id = p646IdMatch ? p646IdMatch[0] : undefined;
          return { id, label, lat, lng, p646Id, p646Label, p646Raw };
        }).filter((x: any) => x.id && Number.isFinite(x.lat) && Number.isFinite(x.lng));
      }),
      catchError(() => of([]))
    );
  }

  getQidsList(search: string): Observable<string[]> {
    const baseParams = new HttpParams()
      .set('action', 'query')
      .set('list', 'search')
      .set('srsearch', search)
      .set('format', 'json')
      .set('srlimit', '5000')
      .set('origin', '*');

    const fetch = (sroffset?: number) => {
      let params = baseParams;
      if (sroffset !== undefined) {
        params = params.set('sroffset', sroffset.toString());
      }
      return this.http.get<any>('https://database.factgrid.de/w/api.php', { params });
    };

    return fetch().pipe(
      expand(response => {
        if (response.continue && response.continue.sroffset !== undefined) {
          return fetch(response.continue.sroffset);
        }
        return of();
      }),
      map(response => response.query?.search.map(item => item.title) ?? []),
      reduce((acc, value) => acc.concat(value), [])
    );
  }

  /**
   * Récupère les photos de Marville avec coordonnées depuis FactGrid.
   * Le label est récupéré dans la langue sélectionnée si possible.
   */
  getMarvillePhotos(selectedLang: string = 'fr'): Observable<Array<{ item: string; label: string; commons: string; lat: number; lng: number }>> {
    const sparql = `
      SELECT DISTINCT ?item ?itemLabel ?commons ?coord WHERE {
        SERVICE wikibase:label { bd:serviceParam wikibase:language "${selectedLang},[AUTO_LANGUAGE],en". }
        ?item wdt:P2 wd:Q394877 ;
              wdt:P83 wd:Q10441 ;
              wdt:P845 wd:Q396105 ;
              wdt:P189 ?commons ;
              wdt:P243 ?place .
        ?place wdt:P48 ?coord .
      }
      ORDER BY ?item`;
    return this.runSparql(sparql).pipe(
      map(res => {
        const bindings = Array.isArray(res?.results?.bindings) ? res.results.bindings : [];
        return bindings.map((row: any) => {
          const coordRaw: string = row.coord?.value || '';
          // WKT attendu: Point(lon lat)
          const parts = coordRaw.startsWith('Point(')
            ? coordRaw.slice(6, -1).split(/\s+/).map(Number)
            : [];
          const lon = parts[0];
          const lat = parts[1];
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          return {
            item: row.item?.value || '',
            label: row.itemLabel?.value || '', // sera dans la langue demandée si dispo
            commons: row.commons?.value || '',
            lat,
            lng: lon
          };
        }).filter(Boolean) as any[];
      }),
      catchError(() => of([]))
    );
  }
}




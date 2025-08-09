import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LastSearchRouteService {
  private lastSearchRoute: string = '/search'; // valeur par défaut

  setLastSearchRoute(route: string) {
    console.log('[LastSearchRouteService] setLastSearchRoute:', route);
    this.lastSearchRoute = route;
  }

  getLastSearchRoute(): string {
    console.log('[LastSearchRouteService] getLastSearchRoute:', this.lastSearchRoute);
    return this.lastSearchRoute;
  }
}

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LastSearchRouteService {
  private key = 'lastSearchRoute';
  private lastRoute: string = '';

  setLastSearchRoute(route: string) {
    this.lastRoute = route;
    localStorage.setItem(this.key, route);
  }

  getLastSearchRoute(): string {
    return this.lastRoute || localStorage.getItem(this.key) || '';
  }
}

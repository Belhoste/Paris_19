import { NgModule } from '@angular/core';
import { RouterModule, Routes, ExtraOptions } from '@angular/router';
import { DisplayComponent} from './display/display.component';
import { HomeComponent } from './home/home.component';
import { MapComponent } from './display/map/map.component';
import { PicturesComponent } from './pictures/pictures.component';
import { GalleryComponent } from './gallery/gallery.component';
import { MarvilleMapComponent } from './marville-map/marville-map.component';

export const routingConfiguration: ExtraOptions = {
  paramsInheritanceStrategy: 'always'
}

const routes: Routes = [

  { path: '', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },

  { path: 'search', loadComponent: () => import('./search/search.component').then(mod => mod.SearchComponent) },
/*  { path: 'item/:id',
    component: DisplayComponent,  
    children: [
      { path: ':lat/:lng/:z', component:MapComponent}
   ]
  }*/
  { path: 'item/:id', loadComponent: () => import('./display/display.component').then(mod => mod.DisplayComponent),
  children: [{ path: ':lat/:lng/:z', component:MapComponent}
  ]
  },
  { path: 'people', loadComponent: () => import('./people/people.component').then(mod => mod.PeopleComponent) },
  { path: 'places', loadComponent: () => import('./places/places.component').then(mod => mod.PlacesComponent) },
  { path: 'advanced_search', loadComponent: () => import('./search/advanced-search/advanced-search.component').then(mod => mod.AdvancedSearchComponent) },
  { path: 'pictures', component: PicturesComponent },
  { path: 'gallery', component: GalleryComponent },
  { path: 'marville-map', component: MarvilleMapComponent }
]

export const Routing = RouterModule.forRoot(routes, routingConfiguration);


@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule]
}
)
export class AppRoutingModule { }

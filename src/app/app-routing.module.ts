import { NgModule } from '@angular/core';
import { RouterModule, Routes, ExtraOptions } from '@angular/router';
import { DisplayComponent} from './display/display.component';
import { HomeComponent } from './home/home.component';
import { MapComponent } from './display/map/map.component';

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
  { path: 'bibliography', loadComponent: () => import('./bibliography/bibliography.component').then(mod => mod.BibliographyComponent) },
  { path: 'animal_magnetism', loadComponent: () => import('./animal-magnetism/animal-magnetism.component').then(mod => mod.AnimalMagnetismComponent) },
  { path: 'advanced_search', loadComponent: () => import('./search/advanced-search/advanced-search.component').then(mod => mod.AdvancedSearchComponent) }

]

export const Routing = RouterModule.forRoot(routes, routingConfiguration);


@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule]
}
)
export class AppRoutingModule { }

//import { importExpr } from '@angular/compiler/src/output/output_ast';
import { Component, OnInit, Input, ChangeDetectorRef, inject } from '@angular/core';
import { ActivatedRoute, ParamMap} from '@angular/router';
import { switchMap } from 'rxjs/operators';
import * as Leaflet from 'leaflet';


@Component({
    selector: 'app-map',
    templateUrl: './map.component.html',
    styleUrls: ['./map.component.scss'],
    standalone: true
})

export class MapComponent implements OnInit {
  private changeDetector = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);

  
  latitude:string;
  longitude: string;
  mapZoom: string;
  lat: number;
  lng: number;
  zoom: number;
  

  ngOnInit(): void {
  // Corrige 404 sur marker-shadow.png : forcer chemins ABSOLUS propres vers les assets.
  // Gestion du base href (ex: "/" en dev, "/Paris_19/" sur gh-pages) sans doublons de slash.
  const baseEl = document.querySelector('base');
  let rawBase = (baseEl?.getAttribute('href') || '/').trim();
  // Si le base contient "media" (route courante), ignorer et repartir de racine.
  if (/media\/?$/i.test(rawBase)) rawBase = '/';
  if (!rawBase.startsWith('/')) rawBase = '/' + rawBase;
  if (!rawBase.endsWith('/')) rawBase += '/';
  // Pour l'URL finale on veut soit "" (dev) soit "/Paris_19" etc.
  let deployPrefix = rawBase === '/' ? '' : rawBase.replace(/\/+/g,'/').replace(/\/$/, '');
  const buildAsset = (file: string) => `${deployPrefix}/assets/leaflet/${file}`;
  const iconOptions = {
    iconRetinaUrl: buildAsset('marker-icon-2x.png'),
    iconUrl: buildAsset('marker-icon.png'),
    shadowUrl: buildAsset('marker-shadow.png')
  };
  // Conversion en URLs absolues complètes (origin + chemin) pour empêcher toute réécriture par le router
  const origin = window.location.origin;
  const absIconOptions = {
    iconRetinaUrl: origin + iconOptions.iconRetinaUrl,
    iconUrl: origin + iconOptions.iconUrl,
    shadowUrl: origin + iconOptions.shadowUrl
  };
  (Leaflet as any).Icon.Default.mergeOptions(absIconOptions);
  const explicitIcon = Leaflet.icon({
    iconRetinaUrl: absIconOptions.iconRetinaUrl,
    iconUrl: absIconOptions.iconUrl,
    shadowUrl: absIconOptions.shadowUrl,
    iconSize: [25,41],
    iconAnchor: [12,41],
    popupAnchor: [1,-34],
    tooltipAnchor: [16,-28],
    shadowSize: [41,41]
  });
  if (!(window as any).__leafletIconLogShown) {
  console.debug('[MapComponent] Leaflet icon paths (abs):', absIconOptions);
    (window as any).__leafletIconLogShown = true;
  }
  // Pré‑vérification (HEAD) pour diagnostiquer immédiatement en console si un asset manque
  try {
    ['marker-icon.png','marker-icon-2x.png','marker-shadow.png'].forEach(f => {
      const testUrl = origin + buildAsset(f);
      fetch(testUrl, { method: 'HEAD' }).then(r => { if (!r.ok) console.warn('[MapComponent] Asset introuvable:', testUrl, r.status); });
    });
  } catch {}

  this.route.params.
  subscribe( 
    params => {
      let latitude = params['lat']; let longitude = params['lng']; let zoom =params['z']; 
    this.lat = Number(latitude);
      this.lng = Number(longitude);
      this.zoom = Number(zoom);
      const itemLocation = { coords: new Leaflet.LatLng(this.lat, this.lng),
      zoom:this.zoom };
                        
       let map = Leaflet.map('map');
  
        Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
        .addTo(map);
  
  Leaflet.marker([this.lat, this.lng], { icon: explicitIcon }).addTo(map);
   
        map.setView(itemLocation.coords, itemLocation.zoom);

      })
   }

   ngOnDestroy(): void {
    
   }
 
}

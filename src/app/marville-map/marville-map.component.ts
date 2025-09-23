import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectedLangService } from '../selected-lang.service';
import { LastSearchRouteService } from '../services/last-search-route.service'; 
import { MatCardModule } from '@angular/material/card';
import { RequestService } from '../services/request.service';
import 'leaflet.markercluster';
import * as L from 'leaflet';
import { Router } from '@angular/router';

@Component({
  selector: 'app-marville-map',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './marville-map.component.html',
  styleUrls: ['./marville-map.component.scss']
})
export class MarvilleMapComponent implements OnInit, OnDestroy {
  points: { item: string, label: string, commons: string, lat: number, lng: number }[] = [];
  loading = true;
  error?: string;
  private lang = inject(SelectedLangService);
  private lastSearchRoute = inject(LastSearchRouteService);
  private map?: L.Map;
  private markersCluster?: L.MarkerClusterGroup;

  Marville_Paris:string;
  showPicture:string;
  showNoticeText:string;

  // Icône caméra (assurez-vous que assets/camera.svg existe)
  private readonly cameraIcon = L.icon({
    iconUrl: 'assets/camera.svg',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -34],
    className: 'camera-leaflet-icon'
  });
  // Fallback (non utilisé si le fichier existe)
  private readonly cameraDivIcon = L.divIcon({
    className: 'camera-div-icon',
    html: '<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid #d32f2f;border-radius:4px;"><span style="font-size:18px;color:#d32f2f;">&#128247;</span></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30]
  });

  constructor(
    private request: RequestService,
    private router: Router // <-- Ajoutez ceci
  ) {}

  ngOnInit(): void {
    this.Marville_Paris = this.lang.getTranslation('Marville_Paris', this.lang.selectedLang);
    this.showPicture = this.lang.getTranslation('showPicture', this.lang.selectedLang) || 'Voir l\'image';
    this.showNoticeText = this.lang.getTranslation('showNoticeText', this.lang.selectedLang) || 'Voir la notice';
    this.request.getMarvillePhotos().subscribe({
      next: points => {
        this.points = points;
        this.loading = false;
        setTimeout(() => { this.ensureMap(); this.addMarkers(); }, 0);
      },
      error: () => {
        this.loading = false;
        this.error = 'Impossible de charger les données (réseau ou serveur).';
        setTimeout(() => this.ensureMap(), 0);
      }
    });
  }

  private ensureMap() {
    if (this.map) return;
    this.map = L.map('leaflet-map', {
      preferCanvas: true
    }).setView([48.8566, 2.3522], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.markersCluster = L.markerClusterGroup();
    this.map.addLayer(this.markersCluster);

    this.map.on('popupopen', (e: any) => {
      const link: HTMLAnchorElement | null = e.popup._contentNode.querySelector('.marville-notice-link');
      if (link) {
        link.removeAttribute('target');
        link.onclick = (evt: MouseEvent) => {
          evt.preventDefault();
          this.lastSearchRoute.setLastSearchRoute('/marville-map');
          const ficheId = link.getAttribute('data-fiche-id');
          // Ici, navigation différée pour éviter les conflits DOM avec Leaflet
          setTimeout(() => {
            this.router.navigate(['/item', ficheId]);
          }, 0);
          return false;
        };
      }
    });
  }

  private addMarkers() {
    if (!this.map || !this.markersCluster) return;
    this.markersCluster.clearLayers();

    if (!this.points.length) return;

    const bounds = L.latLngBounds([]);

    this.points.forEach(pt => {
      if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) return;
      const ll = L.latLng(pt.lat, pt.lng);
      bounds.extend(ll);
      const iconToUse = this.cameraIcon;
      const ficheId = pt.item.split('/').pop();
      const label = pt.label || 'Sans titre';
      let commonsThumb = '';
      if (pt.commons) {
        const fileName = decodeURIComponent(pt.commons.split('/').pop() || '');
        const thumbUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=180`;
        commonsThumb = `
          <div style="display:flex;align-items:center;gap:18px;">
            <a href="${pt.commons}" target="_blank" rel="noopener" title="Voir l'image sur Wikimedia Commons" style="cursor:pointer;display:block;">
              <img src="${thumbUrl}" 
                   alt="Vignette" style="max-width:140px;max-height:140px;border-radius:4px;box-shadow:0 1px 4px #888;vertical-align:middle;display:block;cursor:pointer;" />
            </a>
            <div style="display:flex;flex-direction:column;justify-content:center;align-items:flex-start;height:100%;">
              <a href="#" data-fiche-id="${ficheId}" class="marville-notice-link"
                 style="font-size:0.98em;color:#1976d2;white-space:nowrap;margin-bottom:8px;">
                ${this.showNoticeText}
              </a>
              <a href="${pt.commons}" target="_blank" rel="noopener"
                 style="font-size:0.98em;color:#1976d2;white-space:nowrap;">
                ${this.showPicture}
              </a>
            </div>
          </div>
        `;
      }
      const popupHtml = `
        <div style="min-width:260px">
          <strong>${label}</strong>
          <div style="height:10px;"></div>
          ${commonsThumb}
        </div>
      `;
      const marker = L.marker(ll, { icon: iconToUse, title: label })
        .bindPopup(popupHtml);
      this.markersCluster.addLayer(marker);
    });

    if (bounds.isValid()) {
      if (this.points.length === 1) {
        this.map.setView(bounds.getCenter(), 17);
      } else {
        this.map.fitBounds(bounds, { padding: [30, 30] });
      }
    }
  }

  // Méthode utilitaire si besoin d’un rafraîchissement externe futur
  refresh() {
    this.ensureMap();
    this.addMarkers();
    setTimeout(() => this.map?.invalidateSize(), 50);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
  }
}




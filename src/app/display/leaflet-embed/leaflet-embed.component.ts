import { Component, Input, OnChanges, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import * as Leaflet from 'leaflet';

export interface LeafletMarkerLike {
  lat: number;
  lng: number;
  label?: string;
  popupHtml?: string;
  iconUrl?: string;
}

@Component({
  selector: 'app-leaflet-embed',
  standalone: true,
  templateUrl: './leaflet-embed.component.html',
  styleUrls: ['./leaflet-embed.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeafletEmbedComponent implements AfterViewInit, OnChanges {
  @ViewChild('mapContainer', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  @Input() markers: LeafletMarkerLike[] = [];
  @Input() center: { lat: number; lng: number } | null = null;
  @Input() zoom = 12;
  @Input() height = '320px';

  private map?: Leaflet.Map;
  private layerGroup?: Leaflet.LayerGroup;
  private defaultIconUrls: { iconUrl: string; iconRetinaUrl: string; shadowUrl: string } | null = null;

  ngAfterViewInit(): void {
    this.initLeafletIcons();
    this.initMap();
    this.renderMarkers();
  }

  ngOnChanges(): void {
    if (!this.map) return;
    this.renderMarkers();
  }

  private initLeafletIcons() {
    // Même logique que MapComponent: assurer les chemins d'icônes
    const baseEl = document.querySelector('base');
    let rawBase = (baseEl?.getAttribute('href') || '/').trim();
    if (/media\/?$/i.test(rawBase)) rawBase = '/';
    if (!rawBase.startsWith('/')) rawBase = '/' + rawBase;
    if (!rawBase.endsWith('/')) rawBase += '/';
    const deployPrefix = rawBase === '/' ? '' : rawBase.replace(/\/+/, '/').replace(/\/$/, '');
    const buildAsset = (file: string) => `${deployPrefix}/assets/leaflet/${file}`;
    const origin = window.location.origin;
  const iconRetinaUrl = origin + buildAsset('marker-icon-2x.png');
  const iconUrl = origin + buildAsset('marker-icon.png');
  const shadowUrl = origin + buildAsset('marker-shadow.png');
  (Leaflet as any).Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
  this.defaultIconUrls = { iconUrl, iconRetinaUrl, shadowUrl };
  }

  private initMap() {
    this.map = Leaflet.map(this.mapEl.nativeElement);
    Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
    this.layerGroup = Leaflet.layerGroup().addTo(this.map);
    const c = this.center || this.markers[0] || { lat: 48.8583, lng: 2.2945 };
    this.map.setView([c.lat, c.lng], this.zoom);
  }

  private renderMarkers() {
    if (!this.map || !this.layerGroup) return;
    this.layerGroup.clearLayers();
    if (!this.markers?.length) return;

    const bounds = Leaflet.latLngBounds([]);
    for (const m of this.markers) {
      const options: Leaflet.MarkerOptions = {};
      if (m.iconUrl) {
        // Utilise l'icône fournie, avec l'ombre par défaut si dispo
        options.icon = Leaflet.icon({
          iconUrl: m.iconUrl,
          shadowUrl: this.defaultIconUrls?.shadowUrl,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });
      }
      const marker = Leaflet.marker([m.lat, m.lng], options);
      if (m.popupHtml || m.label) marker.bindPopup(m.popupHtml || m.label || '');
      marker.addTo(this.layerGroup);
      bounds.extend([m.lat, m.lng]);
    }
    if (this.markers.length > 1) this.map.fitBounds(bounds.pad(0.1));
  }
}

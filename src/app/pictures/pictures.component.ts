import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { SelectedLangService } from '../selected-lang.service';

@Component({
  selector: 'app-pictures',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, RouterModule],
  templateUrl: './pictures.component.html',
  styleUrls: ['./pictures.component.scss']
})
export class PicturesComponent implements OnInit {
  private lang = inject(SelectedLangService);
  pictures: string;
  searchOnImages: string;
  Marville_Paris: string;
  Marville_map_text: string;
  marvilleThumbSrc: string = 'assets/Marville-Autoportrait-1861.jpg';
  private marvilleImgFallbackTried = false;

  ngOnInit(): void {
    this.pictures = this.lang.getTranslation('pictures', this.lang.selectedLang);
    this.searchOnImages = this.lang.getTranslation('searchOnImages', this.lang.selectedLang);
    this.Marville_Paris= this.lang.getTranslation('Marville_Paris', this.lang.selectedLang);
    this.Marville_map_text= this.lang.getTranslation('Marville_map_text', this.lang.selectedLang);
  }

  onMarvilleImgError() {
    if (this.marvilleImgFallbackTried) return;
    this.marvilleImgFallbackTried = true;
    this.marvilleThumbSrc = 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Marville-Autoportrait-1861.jpg';
  }
}

import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { MatCardModule } from '@angular/material/card';


@Component({
  selector: 'app-hu-notice-display',
  imports: [MatCardModule],
  templateUrl: './hu-notice-display.component.html',
  styleUrl: './hu-notice-display.component.scss'
})
export class HuNoticeDisplayComponent   {

  @Input() hu_notice: any;

 
 
  
}
// This component is designed to display a single HU notice.

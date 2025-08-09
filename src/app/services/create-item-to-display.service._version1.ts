import { Injectable, inject } from '@angular/core';
import { SetLanguageService } from './set-language.service';
import { DetailsService } from './details.service';
import { PropertyDetailsService } from './property-details.service';
import { ItemDetailsService } from './item-details.service';
import { ItemTalkService } from './item-talk.service';
import { forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';



@Injectable({
  providedIn: 'root'
})

export class CreateItemToDisplayService {
  private setLanguage = inject(SetLanguageService);
  private details = inject(DetailsService);
  private addPropertyDetails = inject(PropertyDetailsService);
  private addItemDetails = inject(ItemDetailsService);
  private itemTalk = inject(ItemTalkService);


  createItemToDisplay(re, selectedLang) {
    let itemProperties = Object.keys(re.claims); // number of properties in the mainsnak
    const hasP131Q99677 = re.claims.P131?.some(
      (claim: any) => claim.mainsnak?.datavalue?.value?.id === 'Q99677'
    );
    let observedItem = forkJoin({
      properties: this.details.setPropertiesList(re),
      items: this.details.setItemsList(re),
      notice: hasP131Q99677
        ? this.itemTalk.getItemTalkContent(re.id)
        : of(null)
    }).pipe(
      map(res => {
        let propertiesDetails = this.setLanguage.item2(res.properties, selectedLang);
        let qualifierProperties = this.addPropertyDetails.addQualifierPropertyDetails(propertiesDetails, re, itemProperties)[1];  // number of properties for the qualifiers
        let referenceProperties = this.details.getReferenceProperties(re);  // number of properties of the references
        this.addItemDetails.addSitelinksDetails(re);  // add the sitelinks with their hyperlinks
        this.addPropertyDetails.addClaimPropertyDetails(propertiesDetails, re, itemProperties);  // add the properties to the statements
        this.addPropertyDetails.addQualifier2PropertyDetails(propertiesDetails, re, itemProperties)[1];
        this.addPropertyDetails.addReferencePropertyDetails(propertiesDetails, re, itemProperties);
        this.addPropertyDetails.addReference2PropertyDetails(propertiesDetails, re, itemProperties);
        let itemsDetails = this.setLanguage.item2(res.items, selectedLang);
        this.addItemDetails.addClaimItemDetails(itemsDetails, re, itemProperties, selectedLang);// selected item with all the properties and items (with their labels and descriptions) of the mainsnaks    
        this.addItemDetails.addQualifierItemDetails(itemsDetails, re, itemProperties, selectedLang);
        this.addItemDetails.addQualifierGroupItemDetails(itemsDetails, re, itemProperties, selectedLang); // selected item with all the properties (with their labels and descriptions) of the qualifiers)
        this.addItemDetails.addReferenceItemDetails(itemsDetails, re, itemProperties, selectedLang); // selected item with all the properties (with their labels and descriptions) of the mainsnaks
        let item = this.addItemDetails.addReference2ItemDetails(itemsDetails, re, itemProperties);
        if (res.notice) {
          item = this.addItemDetails.addNoticeClaim(item, { notice_HU: res.notice[0]["*"] });
        }
        return [item, itemProperties, qualifierProperties, referenceProperties]
      }
      )
    )
    return observedItem
  }
}

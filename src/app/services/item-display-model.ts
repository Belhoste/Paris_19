// src/app/models/display-item.interface.ts

import { Observable } from 'rxjs';

export interface StringClaim {
  datatype: 'string';
  datavalue: { value: string; };
  // autres champs spécifiques
}

export interface TimeClaim {
  datatype: 'time';
  datavalue: { value: { time: string; date?: string; }; };
  // autres champs spécifiques
}

export interface WikibaseItemClaim {
  datatype: 'wikibase-item';
  datavalue: { value: { id: string; label?: string; separator?: string; description?:string }; };
  // autres champs spécifiques
}

export interface MonolingualText {
  datatype: 'monolingualtext';
  datavalue: { value: { text: string; language: string }; };
  // autres champs spécifiques
}

export interface ExternalId {
  datatype: 'external-id';
  datavalue: { value: { link: string; string: string }; };
  // autres champs spécifiques
}

export interface CommonsMedia {
  datatype: 'commonsMedia';
  datavalue: { value: { commons: string }; };
  // autres champs spécifiques
}

// etc. pour chaque type utile

export type DisplayClaimMainsnak = StringClaim | TimeClaim | WikibaseItemClaim | MonolingualText | ExternalId | CommonsMedia /* | ... */;


export interface StringQualifier {
  datatype: 'string';
  datavalue: { value: string };
  label?: string;
  description?: string;
  aliases?: string[];
  separator?: string;
}

export interface TimeQualifier {
  datatype: 'time';
  datavalue: { value: { time: string; date?: string } };
  label?: string;
  description?: string;
  aliases?: string[];
  separator?: string;
}

export interface WikibaseItemQualifier {
  datatype: 'wikibase-item';
  datavalue: { value: { id: string; label?: string; separator?: string; description?: string; aliases?: string[] } };
  label?: string;
  description?: string;
  aliases?: string[];
  separator?: string;
}

export interface MonolingualTextQualifier {
  datatype: 'monolingualtext';
  datavalue: { value: { text: string; language: string } };
  label?: string;
  description?: string;
  aliases?: string[];
  separator?: string;
}

export interface ExternalIdQualifier {
  datatype: 'external-id';
  datavalue: { value: { link: string; string: string } };
  label?: string;
  description?: string;
  aliases?: string[];
  separator?: string;
}

export interface CommonsMediaQualifier {
  datatype: 'commonsMedia';
  datavalue: { value: { commons: string; label?: string; description?: string; aliases?: string[] } };
  label?: string;
  description?: string;
  aliases?: string[];
  separator?: string;
}

// Ajoutez d'autres types si besoin

export type DisplayQualifierMainsnak =
  | StringQualifier
  | TimeQualifier
  | WikibaseItemQualifier
  | MonolingualTextQualifier
  | ExternalIdQualifier
  | CommonsMediaQualifier;

export type PipelineQualifier = DisplayQualifierMainsnak & { property: string };


export interface DisplayQualifierGroup {
  datatype: string;
  id?: string;
  label?: string;
  description?: string;
  unit?: string;
  separator?: string;
  date?: string;
  calendar?: string;
  amount?: string | number;
  string?: any;
  link?: string;
  commons?: string;
  remove?: string;
  display?: DisplayQualifierGroup[]; // si besoin d’imbrication
}


export interface DisplayClaim {
  mainsnak: {
    datatype: string;
    datavalue: any;
    label?: string;
    description?: string;
    aliases?: string[];
    separator?: string;
    timeOrder?: number | string;
  };
  qualifiers?: DisplayQualifierMainsnak[]; // <-- nouveau type
//  qualifierGroups?: DisplayQualifierGroup[];
  qualifierGroups: Array<Array<{ datatype: string;[key: string]: any }>>;
  references?: DisplayReference[];
}

export interface DisplayQualifier {
  // Définissez ici la structure minimale pour l’affichage des qualifiers
  datatype: string;
  unit?: string;
  label?: string;
  description?: string;
  aliases?: string[];
  separator?: string;
  amount?: string | number;

}

export type QualifierValue = {
  id?: string;
  label?: string;
  description?: string;
  aliases?: string[];
  separator?: string;
  unit?: string;
  date?: string;
  calendarmodel?: string;
  amount?: string | number;
  [key: string]: any;
};

export interface DisplayReference {
  // Définissez ici la structure minimale pour l’affichage des références
  datatype: string;
  unit?: string;
  label?: string;
  description?: string;
  aliases?: string[];
  separator?: string;
  amount?: string | number;
}

export interface DisplayClaimsArray extends Array<DisplayClaim> {
  id?: string;
  label?: string;
  description?: string;
  aliases?: string[];
  // autres propriétés de la propriété FactGrid
}


export interface DisplayItem {
  label: string;
  description?: string;
  aliases?: string[];
  claims: { [property: string]: DisplayClaimsArray };
  infolist?: any[];
  sitelinks?: any[];
  sparql?: Observable<any>;
  [key: string]: any;
}


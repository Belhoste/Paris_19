import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SortingDataAccessorService {

  constructor() { }

  // Accès à une propriété imbriquée (ex: 'author.label')
  nestedProperty(data: any, sortHeaderId: string): string | number {
    return sortHeaderId
      .split('.')
      .reduce((accumulator, key) => accumulator && accumulator[key], data) as string | number;
  }

  // Tri insensible à la casse sur une propriété simple
  caseInsensitive(data: any, sortHeaderId: string): string | number {
    const value = data[sortHeaderId];
    return typeof value === 'string' ? value.toUpperCase() : value;
  }

  nestedCaseInsensitive(data: any, sortHeaderId: string): string | number {
    const value = sortHeaderId
      .split('.')
      .reduce((accumulator, key) => accumulator && accumulator[key], data) as string | number;
    console.log('Tri sur', sortHeaderId, '=>', value, 'dans', data);
    return typeof value === 'string' ? value.toUpperCase() : value;
  }

}


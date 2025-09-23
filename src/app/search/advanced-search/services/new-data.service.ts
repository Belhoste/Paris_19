import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Variable, ITEMTYPES, MUTATOR } from './../variable';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  constructor() { }

  mutator: BehaviorSubject<Variable[][]> = new BehaviorSubject(MUTATOR);
  readonly mutator$: Observable<Variable[][]> = this.mutator.asObservable();

  mutatorForItemValue: BehaviorSubject<Variable[][]> = new BehaviorSubject(MUTATOR);
  readonly $mutatorForItemValue: Observable<Variable[][]> = this.mutatorForItemValue.asObservable();
  // Alias standardisé (suffixe $) sans rupture
  readonly mutatorForItemValue$: Observable<Variable[][]> = this.$mutatorForItemValue;

  updateMutator(mutator: Variable[][]): void { this.mutator.next(mutator) };
  updateMutatorForItemValue(mutator: Variable[][]): void { this.mutatorForItemValue.next(mutator) };


  subjectOptions: BehaviorSubject<Variable[]> = new BehaviorSubject(ITEMTYPES);
  readonly subjectOptions$: Observable<Variable[]> = this.subjectOptions.asObservable();
  // Nouvelle méthode (orthographe corrigée)
  updateSubjectOptions(item: Variable[]): void { this.subjectOptions.next(item) };
  // Alias rétrocompatible
  updateSujectOptions(item: Variable[]): void { this.updateSubjectOptions(item) };


  objectOptions: BehaviorSubject<Variable[]> = new BehaviorSubject([]);
  readonly objectOptions$: Observable<Variable[]> = this.objectOptions.asObservable();
  updateObjectOptions(item: Variable[]): void { this.objectOptions.next(item) };


  newOptions: BehaviorSubject<Variable[]> = new BehaviorSubject([]);
  readonly newOptions$: Observable<Variable[]> = this.newOptions.asObservable();
  updateNewOptions(item: Variable[]): void { this.newOptions.next(item) };


  updateFormerItemTypes(itemTypes: Variable[][]): void { this.formerItemTypes.next(itemTypes) };
  formerItemTypes: BehaviorSubject<Variable[][]> = new BehaviorSubject([ITEMTYPES]);
  readonly formerItemTypes$: Observable<Variable[][]> = this.formerItemTypes.asObservable();

  lastItemTypes$(u$: Observable<Variable[][]>): Observable<Variable[]> {
    return u$.pipe(map(res => (res?.length ? res[res.length - 1] : [])));
  }


  propertiesList: BehaviorSubject<any[]> = new BehaviorSubject([]);
  readonly $propertiesList: Observable<any[]> = this.propertiesList.asObservable();
  // Alias standardisé (suffixe $) sans rupture
  readonly propertiesList$: Observable<any[]> = this.$propertiesList;
  updatePropertiesList(list: any[]): void { this.propertiesList.next(list) }

  currentStatement: BehaviorSubject<number> = new BehaviorSubject(0);
  readonly $currentStatement: Observable<number> = this.currentStatement.asObservable();
  // Alias standardisé (suffixe $) sans rupture
  readonly currentStatement$: Observable<number> = this.$currentStatement;
  updateCurrentStatement(i: number): void { this.currentStatement.next(i) };
}

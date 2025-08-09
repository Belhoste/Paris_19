import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, effect, inject, input, AfterViewInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOption } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelect, MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { Observable, ReplaySubject, Subject, BehaviorSubject, map, tap, takeUntil, switchMap, debounceTime, combineLatest, forkJoin, filter, iif, of, delay, startWith } from 'rxjs';
//import { takeUntil } from 'rxjs/operators';
import { SelectedLangService } from '../../../selected-lang.service';
import { PropertiesListService } from '../../../services/properties-list.service';
import { RequestService } from '../../../services/request.service';
import { SearchEngineService } from '../../../services/search-engine.service';
import { SetLanguageService } from '../../../services/set-language.service';
import { DataService } from '../services/data.service';
import { StatementsControlsService } from '../services/statements-controls.service';
import { ITEMTYPES, MUTATOR, QUALIFIERTYPES, Selection, Variable } from '../variable';

export interface Statement {
  itemType: FormControl<string>,
  properties: FormControl<string[]>,
  value?: FormGroup,
  optional: FormControl<boolean>,
  qualifiers?: FormArray<FormGroup>
}

export interface Qualifier {
  qualifierProperty: FormControl<string>,
  value?: FormGroup
}

@Component({
    selector: 'app-statement-search',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        MatInputModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        NgxMatSelectSearchModule,
        MatSelect,
        MatCheckboxModule,
        MatOption,
        MatSlideToggleModule,
    ],
    templateUrl: './statement-search.component.html',
    styleUrl: './statement-search.component.scss'
})

export class StatementSearchComponent
  implements OnInit, OnDestroy, AfterViewInit {

  private changeDetector = inject(ChangeDetectorRef);
  private request = inject(RequestService);
  private setLanguage = inject(SetLanguageService);
  private lang = inject(SelectedLangService);
  private propertyList = inject(PropertiesListService);
  private fb = inject(FormBuilder);
  private searchEngine = inject(SearchEngineService);
  private data = inject(DataService);
  private controls = inject(StatementsControlsService);
  //  private data = inject(DataService);


  @Input() set literalVariables(literalVariables: any[]) {
    this._literalVariables = literalVariables;
    if (this.literalVariables) {
      this.filteredLiteralVariables.next(this.literalVariables.slice())
    }
  }

  @Input() set qualifierLiteralVariables(qualifierLiteralVariables: any[]) {
    this._qualifierLiteralVariables = qualifierLiteralVariables;
    if (this.qualifierLiteralVariables) {
      this.filteredQualifierLiteralVariables.next(this.qualifierLiteralVariables.slice())
    }
  }
  get literalVariables(): any[] {
    return this._literalVariables;
  }

  get qualifierLiteralVariables(): any[] {
    return this._qualifierLiteralVariables;
  }

  @Output() datatype;


  @Output() selectedItemType: EventEmitter<string[]> = new EventEmitter();


  protected currentItemTypes: any[] = [];
  protected currentItemTypesArray: any[][] = [];

  public statementOptions: BehaviorSubject<any[]>[] = [];


  private _propertiesList: any[];
  private propertiesToSelect: any[];
  private _literalVariables: any[];
  private _qualifierLiteralVariables: any[];
  propertiesList: any[];


  private qualifierPropertiesToSelect: any[];

  protected entityValues: any[] = []; //
  protected currentMutator: Variable[][] = MUTATOR;

  protected selectedLiteralVariables: Variable[] = []; // probablement à supprimer

  isWikibaseItemOnStatement: boolean = true;
  isLiteralOnStatement: boolean = false;
  isLiteralStringOnStatement: boolean = false;


  isWikibaseItemOnQualifier: boolean = true;
  isLiteralOnQualifier: boolean = false;
  isLiteralStringOnQualifier: boolean = false;

  isLastStatement: boolean = false;
  isAddStatement: boolean = false;
  isRemoveStatement: boolean = false;

  isAddQualifier: boolean = false;
  isRemoveQualifier: boolean = false;
  isQualifier: boolean = false;

  isItemValue: boolean = true;


  isLiteralVariableSelected: boolean = true;

  selectedItemTypes: any[] = [];



  placeholderForLiteralValue: string = "literal value?"
  placeholderForLiteralString: string = "write string? | date? | number?";

  query = this.fb.group({
    statements: this.fb.array([this.statement])
  });

  get statements(): FormArray<FormGroup> { return this.query.get('statements') as FormArray; } // getter for statements as form array


  // on pourrait aussi bien écrire : get statements() { return this.query.controls['statements'] as FormArray; }
  qualifiers(i: number): FormArray<FormGroup> { return this.statements.at(i).get('qualifiers') as FormArray; }

  get lastStatementIndex(): number {
    const index = this.statements.length > 0 ? this.statements.length - 1 : 0;
    console.log('lastStatementIndex:', index);
    return index;
  }


  get statement(): FormGroup<Statement> {
    return this.fb.group<Statement>(
      {
        itemType: new FormControl({ value: "", disabled: false }),
        properties: new FormControl({ value: [], disabled: true }, [Validators.required, this.datatypeValidator]),
        value: this.value,
        optional: new FormControl({ value: false, disabled: false }),
        qualifiers: this.fb.array([this.qualifier])
      }
    );
  }

  get value(): FormGroup {
    return this.fb.group({
      itemValue: new FormControl({ value: "", disabled: true }),
      literalValue: new FormControl({ value: "", disabled: true }),
      literalString: new FormControl({ value: "", disabled: true })
    }
    );
  }

  get qualifier(): FormGroup {
    return this.fb.group({
      qualifierProperty: new FormControl({ value: "", disabled: false }),
      value: this.qualifierValue,
      optional: new FormControl({ value: false, disabled: false }),
    }
    );
  }

  get qualifierValue(): FormGroup {
    return this.fb.group({
      qualifierValue: new FormControl({ value: "", disabled: true }),
      qualifierLiteralValue: new FormControl({ value: "", disabled: true }),
      qualifierLiteralString: new FormControl({ value: "", disabled: true })
    }
    );
  }

  isPropertiesInvalid(index: number): boolean {
    const statementGroup = this.statements.at(index) as FormGroup;
    const propertiesControl = statementGroup.get('properties') as FormControl;
    return propertiesControl.invalid
    //      && (propertiesControl.dirty || propertiesControl.touched);
  }

  public itemTypeFilterCtrl: FormControl<string | null> = new FormControl<string>('');

  public filteredItemTypesArray: ReplaySubject<any[]>[] = [];



  /** control for the MatSelect filter keyword multi-selection */
  public propertytMultiFilterCtrl: FormControl<string> = new FormControl<string>('');

  public filteredPropertyMultiArray: ReplaySubject<any[]>[] = [];


  //  public valueSearchInput: FormControl = new FormControl();
  /** control for the MatSelect filter keyword single-selection */
  public itemValueFilterCtrl: FormControl<string> = new FormControl<string>('');

  /** value filtered by search keyword */
  public filteredItemValuesArray: ReplaySubject<any[]>[] = [];

  /** control for the MatSelect filter keyword single-selection */
  public literalFilterCtrl: FormControl<string | null> = new FormControl<string>('');

  /** value filtered by search keyword */
  public filteredLiteralVariables: ReplaySubject<any> = new ReplaySubject<any>(1);

  /** control for the MatSelect filter keyword single-selection */
  public qualifierPropertyFilterCtrl: FormControl<string | null> = new FormControl<string>('');

  /** value filtered by search keyword */
  public filteredQualifierProperties: ReplaySubject<any> = new ReplaySubject<any>(1);

  /** control for the MatSelect filter keyword single-selection */
  public qualifierValueFilterCtrl: FormControl<string> = new FormControl<string>('');

  /** value filtered by search keyword */
  public filteredQualifierValues: ReplaySubject<any> = new ReplaySubject<any>(1);

  /** control for the MatSelect filter keyword single-selection */
  public qualifierLiteralFilterCtrl: FormControl<string> = new FormControl<string>('');

  /** value filtered by search keyword */
  public filteredQualifierLiteralVariables: ReplaySubject<any> = new ReplaySubject<any>(1);


  addStatements() {
    this.statements.push(this.statement);
    console.log('Added statement, new statements length:', this.statements.length);
    this.isRemoveStatement = true;
    this.filteredItemTypesArray.push(new ReplaySubject<any[]>(1)); // Initialiser un nouveau ReplaySubject pour la nouvelle déclaration
    this.filteredItemValuesArray.push(new ReplaySubject<any[]>(1)); // Initialiser un nouveau ReplaySubject pour la nouvelle déclaration
    this.filteredPropertyMultiArray.push(new ReplaySubject<any[]>(1)); // Initialiser un nouveau ReplaySubject pour la nouvelle déclaration
    this.statementOptions.push(new BehaviorSubject<any[]>([])); // Initialiser un nouveau BehaviorSubject pour la nouvelle déclaration


    // Initialiser les valeurs des nouveaux ReplaySubject avec une liste vide pour filterItemTypes et un observable de liste vide pour filterPropertyMulti
    this.filteredItemTypesArray[this.lastStatementIndex].next([]);
    this.filteredItemValuesArray[this.lastStatementIndex].next([]);
    this.filteredPropertyMultiArray[this.lastStatementIndex].next([]);


    this.setCurrentItemTypes(this.lastStatementIndex);
    this.filterItemTypes(this.lastStatementIndex);
    this.filterItemValues(this.lastStatementIndex);
    this.filterPropertyMulti(this.lastStatementIndex, of([]));
  }


  removeStatements(i: number) {
    this.statements.removeAt(i);
    console.log('Removed statement at index', i, 'new statements length:', this.statements.length);
    this.currentItemTypesArray.splice(i, 1); // Supprimer les currentItemTypes correspondants
    this.filteredItemTypesArray.splice(i, 1); // Supprimer le ReplaySubject correspondant
    this.setCurrentItemTypes(this.lastStatementIndex);
    this.filterItemTypes(this.lastStatementIndex);
  }

  addQualifiers(i: number) {
    let m = this.qualifiers(i).controls.length - 1
    if (this.qualifiers(i).pristine) { this.qualifiers(i).removeAt(m) };
    this.isQualifier = true;
    this.qualifiers(i).push(this.qualifier);
    let qual = this.controls.qualifiers(this.statements, i);
    this.isQualifier = true;

  }

  addFirstQualifier(i) {
    this.controls.qualifiers(this.statements, i).enable();
    if (i === 0) { this.isQualifier = true; }
  }

  removeQualifiers(i: number, j: number) {
    this.qualifiers(i).removeAt(j);
  }

  statementControllerDisplay(u, i) {
    const statement = this.statements.at(i) as FormGroup;
    const itemValueControl = statement.get('value.itemValue') as FormControl;

    if (u === "WikibaseItem") {
      this.isWikibaseItemOnStatement = true;
      this.isLiteralOnStatement = false;
      itemValueControl.enable();
      statement.get('value.literalValue').disable();
      statement.get('value.literalString').disable();
    } else {
      if (u === "String" || u === "MonolingualText" || u === "Time" || u === "Quantity") {
        console.log(u);
        itemValueControl.disable();
        statement.get('value.literalValue').enable();
        statement.get('value.literalString').enable();
        this.isWikibaseItemOnStatement = false;
        this.isLiteralStringOnStatement = false;
        this.isLiteralOnStatement = true;
      }
    }
  }


  literalControllerDisplay(label, i) {
    if (label === "write literal string" || label === "write date : YYYY-MM-DD" || label === "write number") {
      this.controls.literalValue(this.statements, i).enable(); this.controls.literalString(this.statements, i).enable();
      this.controls.literalValue(this.statements, i).patchValue("");
      this.isLiteralStringOnStatement = true;
      this.placeholderForLiteralString = "write below";
    }
    else {
      this.controls.literalValue(this.statements, i).enable();
      this.controls.literalString(this.statements, i).disable();
      this.isLiteralStringOnStatement = false;
      this.placeholderForLiteralString = "disabled";
    }
  }

  qualifierControllerDisplay(u, i, j) {
    console.log(u);
    let qual = this.controls.qualifiers(this.statements, i);
    if (u === "WikibaseItem") {
      let value = this.controls.qualifierValue(qual, j);
      console.log(value);
      this.isWikibaseItemOnQualifier = true;
      this.isLiteralOnQualifier = false;
      this.controls.qualifierValue(qual, j).enable();
      this.controls.qualifierLiteralValue(qual, j).disable();
      this.controls.qualifierLiteralString(qual, j).disable();
      //  this.controls.qualifierValue(qual, j).patchvalue(value);
    } else {
      if (u === "String" || u === "MonolingualText" || u === "Time" || u === "Quantity") {
        this.controls.qualifierLiteralValue(qual, j).enable();
        this.controls.qualifierLiteralString(qual, j).enable();
        this.isWikibaseItemOnQualifier = false;
        this.isLiteralOnQualifier = true;
      }
    }
  }

  qualifierLiteralControllerDisplay(label, i, j) {
    let qual = this.controls.qualifiers(this.statements, i);
    if (label === "write literal string" || label === "write date : YYYY-MM-DD" || label === "write number") {
      this.controls.qualifierLiteralValue(qual, j).enable(); this.controls.qualifierLiteralString(qual, j).enable();
      //    this.controls.qualifierLiteralValue(qual, j).patchValue("");
      this.isLiteralStringOnQualifier = true;
    }
    else {
      this.controls.literalValue(qual, j).enable();
      this.controls.literalString(qual, j).disable();
      this.isLiteralStringOnQualifier = false;
    }
  }

  onItemTypeSelect(event: MatSelectChange): void {
    console.log(event.value),
      console.log('Selected itemType:', event.value);
    let i = event.value[0]; // name of the statement "i" in the form array "statements"
    this.controls.propertyValues(this.statements, i).enable();
    const options$ = this.propertyList.propertiesListBuilding(event.value[3]); // create the list of properties; useless?
    this.filterPropertyMulti(i, options$); // Appeler filterPropertyMulti avec l'observable
    this.selectedItemType.emit(event.value); // output to advanced-search-component (see selectedItemType(itemType))
    this.statements.at(i).get('itemType').setValue(event.value, { emitEvent: false }); // Mettre à jour la valeur du contrôle
    console.log('Updated itemType control value:', this.statements.at(i).get('itemType').value);
    this.changeDetector.detectChanges(); // Forcer la détection des changements
  }


  onPropertySelect(event: MatSelectChange): void {
    let propertyValue = [];
    console.log('Event value:', event.value);
    let i = event.value[0][0];
    console.log(i);

    // Itérer sur chaque élément de event.value
    for (let j = 0; j < event.value.length; j++) {
      if (event.value[j] !== undefined) {
        let propertyType = event.value[j][3];
        console.log(propertyType);
        if (propertyType) {
          this.statementControllerDisplay(propertyType, i); // to display the right control
          this.controls.itemValue(this.statements, i).enable();
        } else {
          console.error('Property type is undefined or invalid:', event.value[j][1].propertyType);
        }
      } else {
        console.error('Event value[' + j + '] is undefined:', event.value);
      }
    }
  }

 


  onValueSelect(event: MatSelectChange): void {  // to update the mutator and add the selected value type to the current itemTypes
    let i = event.value[0];
    let label = event.value[1];
    let dataType = event.value[2];
    console.log(event.value);

    // Mettre à jour la valeur du contrôle itemValue
    const itemValueControl = this.statements.at(i).get('value.itemValue') as FormControl;
  //  itemValueControl.setValue(label, { emitEvent: false });

    // Déclencher la détection des changements pour mettre à jour le template
    this.changeDetector.detectChanges();



    if (label.charAt(0) === "?") {
 //    this.selectedValue.emit(event.value); // output to advanced-search-component (see selectedValue(itemType))
    }
    this.isAddQualifier = true;
    this.isAddStatement = true;
    // Appeler resetPreviousItemValues après la mise à jour du contrôle itemValue
    this.resetPreviousItemValues(i);
    console.log(this.resetPreviousItemValues(i))
  };

  onLiteralValueSelect(event: MatSelectChange): void {
    let i = event.value[0];
    let label = event.value[1];
    this.placeholderForLiteralString = label;
    this.literalControllerDisplay(label, i); // to display and enable the right controls
    if (label.charAt(0) === "?") {
      console.log(label);
      //    this.selectedValue.emit(event.value); // output to advanced-search-component (see selectedValueType(itemType)). ?string is not an itemType
    }
    this.isAddStatement = true;
    this.isAddQualifier = true;
  }

  onQualifierPropertySelect(event: MatSelectChange): void {
    console.log(event.value);
    let i = event.value[0];
    let j = event.value[1];
    let datatype = event.value[3];
    //   this.qualifierPropertyDatatype.emit([i, j, datatype]);
    this.qualifierControllerDisplay(datatype, i, j); // to display the right controls

  }

  onQualifierValueSelect(event: MatSelectChange): void {
    console.log(event.value);
    let i = event.value[0];
    let j = event.value[1];
    let dataType = event.value[2];
    let col = event.value[3];
    let id = event.value[4];
    let u = [i, dataType, col, id];
    if (dataType.charAt(0) === "?") {
      //      this.selectedQualifierValue.emit(u);
    }
    this.isRemoveQualifier = true;
    let qual = this.controls.qualifiers(this.statements, i);
    let value = this.controls.qualifierValue(qual, j);
    console.log(value);
    this.controls.patchQualifierValue(value, qual, j)
  };

  onQualifierLiteralValueSelect(event: MatSelectChange): void {
    console.log(event.value);
    let i = event.value[0];
    let label = event.value[2];
    // let dataType = event.value[2];
    if (label.charAt(0) === "?") {
      //     this.selectedQualifierValue.emit(event.value);
      this.isLiteralStringOnQualifier = false;
    } else this.isLiteralStringOnQualifier = true;
    this.isRemoveQualifier = true;
  };

  public items = [];

  //  public datatype = "WikibaseItem";
  public isQualifier2Display: boolean = false;
  //propertiesList: any[];
  selectedPropertiesList: string[];


  @ViewChild('matRef') matRef: MatSelect;

  clear() {
    this.matRef.options.forEach((data: MatOption) => data.deselect());
  }


  @ViewChild('singleSelect', { static: true }) singleSelect: MatSelect;

  @ViewChild('multiSelect', { static: true }) multiSelect: MatSelect;

  //  @Output() typeSelectionChange: EventEmitter<MatSelectChange> = new EventEmitter<MatSelectChange>();
  @Output() selectionChange: EventEmitter<MatSelectChange> = new EventEmitter<MatSelectChange>();

  @Output() propertySelectionChange: EventEmitter<MatSelectChange> = new EventEmitter<MatSelectChange>();

  protected _onDestroy = new Subject<void>();



  ngOnInit(): void {
    console.log('Initial statements length:', this.statements.length);

    this.propertyList.qualifierPropertiesListBuilding.subscribe(res => this.qualifierPropertiesToSelect = res);

    this.itemTypeFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterItemTypes(this.lastStatementIndex);
      });

    this.propertytMultiFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterPropertyMulti(this.lastStatementIndex, of([]));
      });

    this.itemValueFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterItemValues(this.lastStatementIndex);
      });

    this.literalFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterLiteralVariables();
      });

    this.qualifierPropertyFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterQualifierProperties();
      });

    this.qualifierValueFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterQualifierValues();
      });

    this.qualifierLiteralFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterQualifierValues();
      });

    // Initialiser statementOptions pour l'index 0
    this.statementOptions[0] = new BehaviorSubject<any[]>([]);

    // Problème 1 et 2: Ajouter le deuxième argument manquant pour filterPropertyMulti
    

    // Problème 3, 4 et 5: Corriger l'initialisation des ReplaySubject
    this.filteredItemTypesArray.push(new ReplaySubject<any[]>(1));
   this.filteredItemValuesArray.push(new ReplaySubject<any[]>(1));
    this.filteredPropertyMultiArray.push(new ReplaySubject<any[]>(1));
   

    this.setCurrentItemTypes(this.lastStatementIndex);
    this.filterItemTypes(this.lastStatementIndex);
    this.filterItemValues(this.lastStatementIndex);
    this.filterPropertyMulti(this.lastStatementIndex, of([]));
  }



  ngAfterViewInit() {

    console.log('Statements length after view init:', this.statements.length);

 //   this.setInitialItemTypeValue();
 //   this.setInitialPropertyValue();
//    this.setInitialItemValue();
    this.setInitialLiteralVariable();
    this.setInitialQualifierPropertyValue();
    this.setInitialQualifierValueValue();
    this.setInitialQualifierLiteralVariable();

  }


  protected setInitialItemTypeValue() {
    this.data.itemTypes$.subscribe(res => {
      this.filteredItemTypesArray.forEach((filteredItemTypes, index) => {
        console.log(res);
        filteredItemTypes.next(res);
        this.filterItemTypes(index);
      });
    });
  }

  protected setInitialPropertyValue() {
    this.filteredPropertyMultiArray.forEach((filteredProperties, index) => {
      filteredProperties
    });
}


  protected setInitialItemValue() {
    this.filteredItemValuesArray.forEach((filteredItemValues, index) => {
      filteredItemValues;
  });
}

  protected setInitialLiteralVariable() {
    this.filteredLiteralVariables;
  }

  protected setInitialQualifierPropertyValue() {
    this.filteredQualifierProperties;
  }

  protected setInitialQualifierValueValue() {
    this.filteredQualifierValues;
  }

  protected setInitialQualifierLiteralVariable() {
    this.filterQualifierLiteralVariables;
  }


  protected filterItemTypes(index: number) {
    console.log('Calling setCurrentItemTypes with index:', index);
    this.setCurrentItemTypes(index);
    console.log('currentItemTypes after setCurrentItemTypes:', this.currentItemTypesArray[index]);

    let search = this.itemTypeFilterCtrl.value;
    if (!search) {
      this.filteredItemTypesArray[index].next(this.currentItemTypesArray[index].slice());
    } else {
      search = search.toLowerCase();
      this.filteredItemTypesArray[index].next(
        this.currentItemTypesArray[index].filter(itemType => itemType.label.toLowerCase().indexOf(search) > -1)
      );
    }

    this.changeDetector.detectChanges();
  }



  /**
 * Initialise et met à jour la liste des types d'éléments disponibles pour chaque déclaration.
 * Cette fonction est appelée chaque fois qu'une nouvelle déclaration est ajoutée ou qu'une déclaration existante est modifiée.
 * Elle s'assure que la liste des types d'éléments est toujours à jour et reflète les sélections actuelles.
 * 
 * @param index L'index de la déclaration pour laquelle les types d'éléments doivent être mis à jour.
 */
  protected setCurrentItemTypes(index: number): void {
    console.log('setCurrentItemTypes called with index:', index);
    if (index === 0) {
      if (!ITEMTYPES || ITEMTYPES.length === 0) {
        console.error('ITEMTYPES is undefined or empty');
        this.currentItemTypesArray[index] = [];
      } else {
        this.currentItemTypesArray[index] = ITEMTYPES;
        console.log('Updated currentItemTypes:', this.currentItemTypesArray[index]);
      }
    } else {
      let labels: any[] = [];

      for (let j = 0; j < index; j++) {
        const itemTypeControl = this.statements.at(j).get('itemType') as FormControl;
        const itemValueControl = this.statements.at(j).get('value.itemValue') as FormControl;

        console.log('itemTypeControl at index', j, ':', itemTypeControl);
        console.log('itemValueControl at index', j, ':', itemValueControl);

        if (itemTypeControl && itemTypeControl.value) {
          const itemTypeValue = itemTypeControl.value[1]; // Extraire l'objet unique
          console.log(`itemTypeControl value at index ${j}:`, itemTypeValue);
          labels.push({ label: itemTypeValue });
        }

        if (itemValueControl && itemValueControl.value) {
          const itemValue = itemValueControl.value[1]; // Extraire l'objet unique
          if (typeof itemValue === 'string' && itemValue.startsWith('?')) {
            labels.push({ label: itemValue });
          }
        }
      }

      // Supprimer les doublons en comparant les propriétés des objets
      const uniqueLabels = Array.from(new Set(labels.map(label => JSON.stringify(label))))
        .map(str => JSON.parse(str));

      // Trier les objets par ordre alphabétique selon leurs propriétés
      this.currentItemTypesArray[index] = uniqueLabels.sort((a, b) => a.label.localeCompare(b.label));
      console.log('Updated currentItemTypes:', this.currentItemTypesArray[index]);
    }
  }



  protected filterPropertyMulti(index: number, options$: Observable<any[]>): void {
    options$
      .pipe(
        switchMap(options => {
          if (!options || options.length === 0) {
            console.error("Les données ne sont pas correctement chargées dans options.");
            return of([]);
          }
          console.log(options);

          let search = this.propertytMultiFilterCtrl.value;
          if (!search) {
            return of(options.slice());
          } else {
            search = search.toLowerCase();
            // filter the projects
            return of(options.filter(entity => entity.value.toLowerCase().indexOf(search) > -1));
          }
        })
      )
      .subscribe(filteredOptions => {
        this.filteredPropertyMultiArray[index].next(filteredOptions);
      });
  }


/*  protected filterItemValues(index: number) {
    const initialSearch = this.itemValueFilterCtrl.value ? this.itemValueFilterCtrl.value.toLowerCase() : '';
    this.itemValueFilterCtrl.valueChanges
      .pipe(
        startWith(initialSearch),
        debounceTime(400),
        switchMap(search => {
          search = search ? search.toLowerCase() : '';
          return this.itemValuesList2(search, this.lang.selectedLang, 20).pipe(
            map(filteredItems => {
              const selectedOptions = this.getSelectedOptionsUpToIndex(index); // Utiliser l'index actuel
              const selectedLabels = this.getLabelsFromSelectedOptions(selectedOptions);
              const augmentedItems = [...selectedLabels.map(label => ({ label, col: null, id: null, separator: '' })), ...filteredItems];

              if (search.startsWith('?')) {
                return augmentedItems.filter(item => item.label.toLowerCase().startsWith(search));
              } else {
                return augmentedItems.filter(item => item.label.toLowerCase().includes(search));
              }
            }),
            map(items => {
              const uniqueItems = items.filter((item, index, self) =>
                index === self.findIndex((t) => (
                  t.label === item.label
                ))
              );
              if (!this.statementOptions[index]) {
                this.statementOptions[index] = new BehaviorSubject<any[]>([]);
              }
              this.statementOptions[index].next(uniqueItems); // Stocker les options dans le BehaviorSubject
              return uniqueItems;
            })
          );
        })
      )
      .subscribe(augmentedItems => {
        console.log(`Augmented Items for statement ${index}:`, augmentedItems);
        if (!this.filteredItemValuesArray[index]) {
          this.filteredItemValuesArray[index] = new ReplaySubject<any[]>(1);
        }
        this.filteredItemValuesArray[index].next(augmentedItems); // Utiliser l'index actuel
        this.resetPreviousItemValues(index); // Réinitialiser les valeurs des statements précédents
      });

    // Utiliser les options stockées lors des changements
    if (this.statementOptions[index]) {
      this.statementOptions[index].subscribe(options => {
        this.filteredItemValuesArray[index].next(options);
      });
    }
  } */


  protected filterItemValues(index: number) {
    // Obtenir les options sélectionnées jusqu'à l'index actuel
    const selectedOptions = this.getSelectedOptionsUpToIndex(index);

    // Obtenir les labels des options sélectionnées
    const selectedLabels = this.getLabelsFromSelectedOptions(selectedOptions);

    // Créer les éléments augmentés à partir des labels sélectionnés
    const augmentedItems = selectedLabels.map(label => ({ label, col: null, id: null, separator: '' }));

    console.log(augmentedItems)

    // Mettre à jour le BehaviorSubject avec les éléments augmentés
    if (!this.statementOptions[index]) {
      this.statementOptions[index] = new BehaviorSubject<any[]>([]);
    }
    this.statementOptions[index].next(augmentedItems);

    // Mettre à jour le ReplaySubject avec les éléments augmentés
    if (!this.filteredItemValuesArray[index]) {
      this.filteredItemValuesArray[index] = new ReplaySubject<any[]>(1);
    }
    this.filteredItemValuesArray[index].next(augmentedItems);

    // Réinitialiser les valeurs des statements précédents
   this.resetPreviousItemValues(index);
  }




  protected resetPreviousItemValues(currentIndex: number): void {
    for (let i = 0; i < currentIndex; i++) {
      const itemValueControl = this.statements.at(i).get('value.itemValue') as FormControl;
      if (itemValueControl && itemValueControl.value) {
        itemValueControl.setValue(itemValueControl.value, { emitEvent: false });
      }
    }
  }



  getSelectedOptionsUpToIndex(i: number): any[] {
    let selectedOptions = [];
    const lastItemTypeControl = this.statements.at(i).get('itemType') as FormControl;
    const lastItemTypeValue = lastItemTypeControl ? lastItemTypeControl.value[1] : null;

    for (let index = 0; index <= i; index++) {
      const itemTypeControl = this.statements.at(index).get('itemType') as FormControl;
      const itemValueControl = this.statements.at(index).get('value.itemValue') as FormControl;
      if (itemTypeControl && itemTypeControl.value) {
        let itemTypeValue = [...itemTypeControl.value]; // Cloner la valeur pour éviter de modifier l'original
        let label = itemTypeValue[1]; // Supposons que le label soit à l'index 1

        // Vérifier si itemValue commence par ? et se termine par un nombre
        if (itemValueControl && itemValueControl.value) {
          const itemValue = itemValueControl.value[1];
          const match = itemValue.match(/^\?(.+?)(\d+)$/);
          if (match) {
            const baseValue = match[1];
            const number = parseInt(match[2]);
            const itemTypeBase = itemTypeControl.value[1].slice(0, -1);
            if (baseValue === itemTypeBase) {
              label = baseValue + (number + 1);
            }
          }
        }

        // Modifier le label selon les règles spécifiées
        const lastChar = label.charAt(label.length - 1);
        if (/[a-zA-Z]$/.test(lastChar)) {
          label += '1';
        } else if (/[0-9]$/.test(lastChar)) {
          const number = parseInt(lastChar);
          label = label.slice(0, -1) + (number + 1);
        }
        itemTypeValue[1] = label; // Mettre à jour le label dans la valeur itemType clonée

        // Ne pas ajouter au tableau si le label mis à jour est égal à la valeur du contrôle itemType du dernier statement
        if (index < i && label === lastItemTypeValue) {
          continue;
        }

        // Ajouter la valeur du contrôle du statement i en remplaçant le dernier caractère par ce nombre incrémenté de 1
        if (index < i && itemValueControl && itemValueControl.value) {
          const itemValue = itemValueControl.value[1];
          const match = itemValue.match(/^\?(.+?)(\d+)$/);
          if (match) {
            const baseValue = match[1];
            const number = parseInt(match[2]);
            const newLabel = baseValue + (number + 1);
            if (!selectedOptions.some(option => option[1] === newLabel)) {
              selectedOptions.push([itemTypeControl.value[0], newLabel]);
            }
          }
        }

        selectedOptions.push(itemTypeValue);
      }
    }
    return selectedOptions;
  }

  getLabelsFromSelectedOptions(options: any[]): string[] {
    return options.map(option => option[1]); // Supposons que le label soit à l'index 1
  }


  itemValuesList1(label) { 
    return  this.data.mutator$.pipe(map(re => re[0]))
      }


  itemValuesList2(label, lang, number) {
   let entityValues:any[] = [];
    return  this.request.searchItem(label, lang).pipe(
      map(res => this.createList(res)),
      switchMap(url => this.request.getItem(url)),
      filter(res => res !== undefined && res !== null),
      filter(res => res.entities !== undefined && res.entities !== null),
      map(res => Object.values(res.entities)),
      map(res => this.setLanguage.item(res, this.lang.selectedLang))
    )
} 


  protected filterLiteralVariables() {
    if (this.literalVariables === undefined) {
      return;
    }
    // get the search keyword
    let search = this.literalFilterCtrl.value;
    if (!search) {
      this.filteredLiteralVariables.next(this.literalVariables.slice());
      return;
    } else {
      search = search.toLowerCase();
    }
    this.filteredLiteralVariables.next(
      this.literalVariables.filter(variable => variable.label.toLowerCase().indexOf(search) > -1)
    );
  }

  protected filterQualifierProperties() {

    if (!this.qualifierPropertiesToSelect) {
      return;
    }
    let search = this.qualifierPropertyFilterCtrl.value;
    if (!search) {
      this.filteredQualifierProperties.next(this.qualifierPropertiesToSelect.slice());
      return;
    } else {
      search = search.toLowerCase();
    }
    // filter the 
    this.filteredQualifierProperties.next(
      this.qualifierPropertiesToSelect.filter(entity => entity.itemLabel.label.toLowerCase().indexOf(search) > -1)
    );
  }

  protected filterQualifierValues() {
    let search = this.qualifierValueFilterCtrl.value;
    let firstCharacter = search.charAt(0);
    if (!search) {
      this.filteredQualifierValues.next(this.entityValues.slice());
      return;
    } else {
      if (firstCharacter !== "?") {
        search = search.toLowerCase();
        this.qualifierValueFilterCtrl.valueChanges //search engine
          .pipe(
            debounceTime(400),
            switchMap(label => this.request.searchItem(label, this.lang.selectedLang)),
            map(res => this.createList(res)),
            debounceTime(400),
            switchMap(url => this.request.getItem(url)),
            filter(res => res !== undefined && res !== null),
            filter(res => res.entities !== undefined && res.entities !== null),
            map(res => Object.values(res.entities))
          ).subscribe(re => {
            this.entityValues = this.setLanguage.item(re, this.lang.selectedLang);
            this.setSeparator(this.entityValues);
            this.filteredQualifierValues.next(this.entityValues.filter(value => value.label.toLowerCase().indexOf(search) > -1));
          }
          );
      }
      else {
        this.data.mutator$.subscribe(re => {
          this.entityValues = re[0];
          let qualifierEntityValues = [];
      //    let qualifierTypes: number[] = [1, 5, 6, 8, 10, 13, 16, 17, 19, 20, 21, 23];
          qualifierEntityValues = this.entityValues.filter(entityValue => QUALIFIERTYPES.includes(entityValue.col))  // filter the options for the qualifier values
          if (search === '?*') {
            this.filteredQualifierValues.next(qualifierEntityValues);
          } else {
            search = search.slice(1);
            this.filteredQualifierValues.next(qualifierEntityValues.filter(value => value.label.toLowerCase().indexOf(search) > -1));
          }
        }
        );
      }
    }
  }

  protected filterQualifierLiteralVariables() {
    console.log(this.qualifierLiteralVariables);
    if (this.qualifierLiteralVariables === undefined) {
      return;
    }
    // get the search keyword
    let search = this.qualifierLiteralFilterCtrl.value;
    console.log(search);
    if (!search) {
      console.log(this.qualifierLiteralVariables);
      this.filteredQualifierLiteralVariables.next(this.qualifierLiteralVariables.slice());
      return;
    } else {
      search = search.toLowerCase();
    }
    this.filteredQualifierLiteralVariables.next(
      this.qualifierLiteralVariables.filter(variable => variable.label.toLowerCase().indexOf(search) > -1)
    );
  }



  setSeparator(entityValues: any[]) {
    for (let i = 0; i < entityValues.length; i++) {
      if (entityValues[i].description) { entityValues[i].separator = ", "; };
    };
  }

  selectedProperties(property) {
    this.selectedPropertiesList = property.value;
  }



  datatypeValidator(control: AbstractControl): { [key: string]: boolean; } | null {
    if (control.value && control.value.length > 1) {
      const firstType = control.value[0][3]; // Supposons que le type soit à l'index 3
      const allSameType = control.value.every((val: any) => val[3] === firstType);
      if (!allSameType) {
        return { 'differentDatatype': true };
      }
    }
    return null;
  }



  notFound(res) {
    res == "https://database.factgrid.de//w/api.php?action=wbgetentities&ids=&format=json&origin=*" ?
      res = "https://database.factgrid.de//w/api.php?action=wbgetentities&ids=Q220375&format=json&origin=*" : res;
    return res;
  }

  createList(re) {
    let baseGetURL = 'https://database.factgrid.de//w/api.php?action=wbgetentities&ids=';
    let getUrlSuffix = '&format=json&origin=*';
    let list: string = "";
    let url: string = "";
    let arr = re.search;
    if (arr === undefined) { arr = []; }
    else { arr = arr; };
    for (let i = 0; i < arr.length; i++) {
      list = list + "|" + arr[i].id;
    };
    list = list.slice(1);
    url = baseGetURL + list + getUrlSuffix;
    return url;
  }

 


  ngOnDestroy(): void {
    this._onDestroy.next(),
      this._onDestroy.complete();
  }

}



import { Injectable, inject } from '@angular/core';
import { RequestService } from './request.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class ItemTalkService {
  private request = inject(RequestService);
  private sanitizer = inject(DomSanitizer);

  getItemTalkContent(itemId: string): Observable<any[] | null> {
    return this.request.getItemTalkPageHtml(itemId).pipe(
      map((talk: any) => {
        const pages = talk?.query?.pages;
        if (!pages) return null;
        const firstPage = Object.values(pages)[0] as { revisions?: any[] };
        return firstPage?.revisions ?? null;
      }),
      catchError(() => of(null))
    );
  }

  wikiToHtml(wikiText: string): SafeHtml {
    if (!wikiText) return '';

    // Début du bloc avec marges latérales augmentées
    let html = `<div style="margin-left:2em; margin-right:2em;">`;

    // Titre général ajouté au début
    html += `<div style="font-weight:bold; font-size:1.1em; margin-bottom:0.5em;">
    Notice de la base de données Harmonia Universalis (en français)
  </div>`;

    // Supprimer les deux-points en début de ligne
    let content = wikiText.replace(/^:\s*/gm, '');

    // Liens internes [[Item:Qxxxx|label]] (insensible à la casse)
    content = content.replace(
      /\[\[Item:([^\|\]]+)\|([^\]]+)\]\]/gi,
      (match, qid, label) =>
        `<a href="https://belhoste.github.io/Paris_19/item/${qid}" target="_blank" rel="noopener" style="text-decoration:underline; color:#1976d2;">${label}</a>`
      //       `<a href="${environment.baseItemUrl}${qid}" target="_blank" rel="noopener" style="text-decoration:underline; color:#1976d2;">${label}</a>`

    );

    // Titres niveau 2 : == Titre == (marge réduite)
    content = content.replace(
      /^==\s*(.*?)\s*==$/gm,
      '<div style="font-weight:bold; margin:0.2em 0;">$1</div>'
    );
    // Titres niveau 3 : === Titre === (marge réduite et indentation)
    content = content.replace(
      /^===\s*(.*?)\s*===$/gm,
      '<div style="font-weight:bold; margin:0.2em 0 0.2em 1em;">$1</div>'
    );
    // Titres niveau 4 : ==== Titre ==== (marge réduite, texte courant, italique)
    content = content.replace(
      /^====\s*(.*?)\s*====$/gm,
      '<div style="font-style:italic; margin:0.2em 0 0.2em 2em;">$1</div>'
    );

    // Gras : '''texte'''
    content = content.replace(/'''(.*?)'''/g, '<b>$1</b>');
    // Italique : ''texte''
    content = content.replace(/''(.*?)''/g, '<i>$1</i>');

    // Sauts de ligne
    content = content.replace(/\n/g, '<br>');

    // Supprimer tous les <br> juste après un </div> (titre)
    content = content.replace(/<\/div>(<br>)+/g, '</div>');
    // Supprimer tous les <br> juste avant un <div> (titre)
    content = content.replace(/(<br>)+<div/g, '<div');

    // Fin du bloc avec marges latérales
    html += content + '</div>';

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }







}



export interface SparqlBinding { [key: string]: { type: string; value: string } }

export function bindingsToMarkers(bindings: SparqlBinding[], latKey='lat', lngKey='lng', labelKey='itemLabel'){
  return (bindings||[])
    .map(b=>{
      const lat = parseFloat(b[latKey]?.value||'');
      const lng = parseFloat(b[lngKey]?.value||'');
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const label = b[labelKey]?.value;
      return { lat, lng, label };
    })
    .filter(Boolean) as { lat:number; lng:number; label?:string }[];
}

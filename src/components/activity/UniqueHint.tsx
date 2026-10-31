// UniqueHint — ispod polja s pravilom `unique` (S190, katalog vježbi): je li vrijednost već
// zauzeta i koji POSTOJEĆI zapisi sliče onome što se upisuje. Svrha je da čovjek vidi da
// vježba već postoji prije nego nastane druga pod drugim imenom.
//
// Ovo je SAMO pomoć pri unosu. Brana je `findUniqueConflicts` pri spremanju (upit u bazu tog
// trena) — popis ovdje je snimka s otvaranja forme.
import { useEffect, useMemo, useState } from 'react';
import type { AttributeDefinition } from '@/types';
import { loadUniqueRecords } from '@/lib/uniqueCheck';
import { similarRecords, uniqueKey, type UniqueRecord } from '@/lib/uniqueValue';

interface Props {
  definition: AttributeDefinition;
  /** Tekstualni atributi iste kategorije (ime, skupina…) — za sličnost i prikaz. */
  textDefs: AttributeDefinition[];
  valueOf: (definitionId: string) => unknown;
  ownEventId: string | null;
}

export function UniqueHint({ definition, textDefs, valueOf, ownEventId }: Props) {
  const [records, setRecords] = useState<UniqueRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const textKey = textDefs.map(d => d.id).join(',');

  useEffect(() => {
    let alive = true;
    loadUniqueRecords(definition, textDefs)
      .then(r => { if (alive) { setRecords(r); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [definition.id, textKey]); // eslint-disable-line react-hooks/exhaustive-deps -- textDefs: nov niz na svakom renderu, ključ je `textKey`

  const typedKey = String(valueOf(definition.id) ?? '');
  const typed = [typedKey, ...textDefs.map(d => String(valueOf(d.id) ?? ''))].filter(Boolean);
  const typedSig = typed.join('\u0001');

  const { taken, similar } = useMemo(() => {
    if (!records) return { taken: null, similar: [] as UniqueRecord[] };
    const k = uniqueKey(typedKey);
    return {
      taken: k ? records.find(r => r.eventId !== ownEventId && uniqueKey(r.key) === k) ?? null : null,
      similar: similarRecords(typed, typedKey, records, ownEventId),
    };
  }, [records, typedSig, ownEventId]); // eslint-disable-line react-hooks/exhaustive-deps -- `typed`/`typedKey` su sažeti u `typedSig`

  if (failed) {
    return <p className="text-xs text-amber-600">Popis postojećih zapisa nije učitan — provjera duplikata ide pri spremanju.</p>;
  }
  if (!taken && similar.length === 0) return null;
  return (
    <div className="text-xs space-y-0.5" aria-live="polite">
      {taken && (
        <p className="text-red-600 font-semibold">
          „{typedKey.trim()}" već postoji{taken.texts.length ? `: ${taken.texts.join(' · ')}` : ''}. Izaberi drugu vrijednost.
        </p>
      )}
      {similar.length > 0 && (
        <>
          <p className="text-gray-500">Slično u kategoriji:</p>
          <ul className="space-y-0.5">
            {similar.map(r => (
              <li key={r.eventId} className="text-gray-600">
                <span className="font-mono">{r.key}</span>
                {r.texts.length > 0 && <span className="text-gray-500"> · {r.texts.join(' · ')}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

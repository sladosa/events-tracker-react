import { useRef } from 'react';

/**
 * Zatvaranje modala klikom na pozadinu — bez da selekcija teksta zatvori panel.
 *
 * ⚠ ZAŠTO POSTOJI (S134, Sašin nalaz pod Kokinim računom)
 *   Svi modali su radili ovako:
 *
 *       onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
 *
 *   Izgleda točno — `currentTarget` je pozadina, pa se čini da uvjet znači
 *   „kliknuto je na pozadinu". Ne znači. **`click` se okida na najbližem
 *   ZAJEDNIČKOM PRETKU elemenata na kojima su se dogodili `mousedown` i
 *   `mouseup`.** Povučeš li selekciju teksta iz polja unutar panela i otpustiš
 *   miš izvan njega, taj zajednički predak je upravo pozadina — dakle uvjet je
 *   istinit, i panel se zatvara.
 *
 *   Prijavljeno kao: *„kad u Edit prozoru nešto brzo selektiram, izleti mi iz
 *   Edit ekrana bez izmjena; moram brisati karakter po karakter."* To nije
 *   nespretnost nego **gubitak rada**, i to tih — panel se zatvori kao da je
 *   korisnik tako htio.
 *
 * ⚠ Lijek nije `stopPropagation` na sadržaju panela (to lomi klikove koji
 *   legitimno moraju doći do pozadine) nego pamćenje GDJE JE PRITISAK POČEO:
 *   zatvara se samo ako su i `mousedown` i `click` bili na samoj pozadini.
 *
 * ⚠ Živi na JEDNOM mjestu namjerno. Isti obrazac je bio prepisan u 14 modala;
 *   popravljen u jednom, ostalih trinaest bi ga zadržalo, a petnaesti bi ga
 *   ponovio. Svaka kopija uvjeta je prilika da se raziđe (isto pravilo kao
 *   `canUpdateExisting()` u S125).
 *
 * @param onClose  što pozvati kad je pozadina doista kliknuta
 * @param enabled  smije li se uopće zatvoriti (npr. `!saving` dok upis traje)
 */
export function useBackdropClose(onClose: () => void, enabled = true) {
  const startedOnBackdrop = useRef(false);
  const endedOnBackdrop = useRef(false);

  return {
    onMouseDown: (e: React.MouseEvent) => {
      startedOnBackdrop.current = e.target === e.currentTarget;
    },
    // ⚠ `mouseup` se prati zasebno, iako se čini suvišnim uz `click`.
    //   `click.target` je ZAJEDNIČKI PREDAK, pa je za svaki potez koji je počeo
    //   i završio na različitim elementima to opet pozadina — dakle iz njega se
    //   ne vidi je li miš otpušten na pozadini ili unutar panela. Bez ovoga
    //   pritisak na pozadini s otpuštanjem u panelu i dalje zatvara modal
    //   (uhvaćeno testom, ne razmišljanjem).
    onMouseUp: (e: React.MouseEvent) => {
      endedOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick: () => {
      const bothOnBackdrop = startedOnBackdrop.current && endedOnBackdrop.current;
      // Uvijek razoružaj — inače bi sljedeći klik naslijedio staro stanje.
      startedOnBackdrop.current = false;
      endedOnBackdrop.current = false;
      if (bothOnBackdrop && enabled) onClose();
    },
  };
}

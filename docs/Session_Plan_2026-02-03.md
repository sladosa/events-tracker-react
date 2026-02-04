# Session Plan - 2026-02-03

**Focus:** Add Activity UI Reorganization  
**Branch:** test-branch  
**Status:** ✅ Faza 1 COMPLETED

---

## 🎯 Današnji Cilj (Faza 1) - COMPLETED

### 1.1 Debug Cleanup ✅
- [x] Maknuti inline debug info (categoryId, chainLoading, attrsLoading, chainLength, attrsCategories)
- [x] Debug panel: hide by default, show samo s `?debug=true` URL param

### 1.2 Button Layout ✅
- [x] Svi gumbi u sticky header (jedna linija)
- [x] Mobile-friendly: `[✕] [💾] [✓]` icons on mobile, text on desktop
- [x] Timer ostaje u headeru

### 1.3 Category Reorder ✅
- [x] Redoslijed: **Leaf FIRST (expanded)** → Parents (collapsed) → Photo → Comments
- [x] Primjer: Strength (leaf) → Gym → Activity → Photo → Comment
- [x] NOTE: Chain already comes as [leaf, parent1, parent2, root] so no reorder needed

### 1.4 Sticky Leaf Dropdowns ✅
- [x] Leaf sekcija header = sticky (top: 56px)
- [x] Dropdown atributi u leaf = sticky (separate sticky container)
- [x] Text inputi (sets_reps, weight_info) scrollaju normalno

### 1.5 Compact Attribute Inputs ✅
- [x] Hint tekst prebaciti u liniju s labelom (manji font, siva boja)
- [x] Dependency info minimiziran (samo pokazuje selected value)

### 1.6 Comment Structure ✅
- [x] Session Comment = shared across session (svi eventi)
- [x] Event Note = per-event (optional, resetira se nakon Save)

---

## 📅 Sljedeće Sesije (NE danas)

### Faza 2: Shortcuts + Duration
- [ ] ShortcutsBar komponenta (dropdown)
- [ ] Save/Delete shortcut funkcionalnost
- [ ] Duration auto-fill iz lap timer-a
- [ ] UnifiedFilter komponenta (reusable za Home + Add + Edit)

### Faza 3: Edit Mode
- [ ] Edit Activity page
- [ ] Prepopulate iz postojećih eventa
- [ ] UPDATE logika (vs INSERT)

### Faza 4: Home Page Mobile
- [ ] Shortcuts na vrhu Home page-a
- [ ] Quick Add flow bez full session mode-a

---

## 📝 Odluke (za dokumentaciju)

| Pitanje | Odluka |
|---------|--------|
| Shortcuts UI | Dropdown (ne horizontalni gumbi) |
| Duration auto-fill | Automatski iz lap timer-a |
| Timer visibility | Uvijek vidljiv (za sad) |
| Comment scope | ~~Activity=shared~~, Leaf=per-event (Event Note) |
| Session Comment | **MAKNUTO** - koristi Activity atribute umjesto toga |
| Category order | **Parents first** (collapsed), Leaf last (expanded) |
| Dropdown reset | **Zadržati** dropdown vrijednosti nakon Save+ |
| Debug mode | Hidden by default, `?debug=true` to show |

---

## 🔧 Fajlovi za izmjenu (Faza 1)

| Fajl | Izmjena |
|------|---------|
| `src/pages/AddActivityPage.tsx` | Debug cleanup, button layout, comment structure |
| `src/components/activity/AttributeChainForm.tsx` | Reorder (leaf first), sticky dropdowns |
| `src/components/activity/AttributeInput.tsx` | Compact layout (hint inline) |
| `src/components/activity/SessionHeader.tsx` | Dodati action buttons |

---

## 🔧 Fix 1 (nakon testiranja)

### Fix 1.1: Zadržavanje dropdown vrijednosti nakon Save+ ✅
- [x] Dropdown vrijednosti (Strength_type, exercise_name) se zadržavaju
- [x] Samo text inputi (sets_reps, weight_info) se resetiraju
- [x] Omogućuje brzo unošenje iste vježbe s drugačijim setovima/težinom

### Fix 1.2: Maknuti Session Comment ✅
- [x] Uklonjeno Session Comment polje
- [x] Session info ide u Activity kategoriju (parent) kao atribut
- [x] Zadržan Event Note za per-event bilješke

### Fix 1.3: Ispravljen redoslijed kategorija ✅
- [x] Activity (root) - NA VRHU, collapsed
- [x] Gym (parent) - collapsed  
- [x] Strength (leaf) - NA DNU, expanded
- [x] Photo i Event Note ispod svega

---

*Kreirano: 2026-02-03*

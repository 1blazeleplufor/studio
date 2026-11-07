# Studio — Passation technique (v3.0)

> Document de reprise pour continuer à développer **Studio** (DAW dans le navigateur, interface inspirée de Logic Pro)
> et préparer le mode **multijoueur / édition collaborative en direct**.
> Rédigé le 7 novembre 2026, à la fin de la session de développement v1 → v2.4.

---

## 1. Le produit en bref

| | |
|---|---|
| **Appli en ligne** | https://1blazeleplufor.github.io/studio/ |
| **Dépôt** | `github.com/1blazeleplufor/studio` (public, GitHub Pages sur `main`, dossier racine) |
| **Version** | 3.0 (`APP_VERSION` dans `src/ui6.js`) |
| **Utilisateur** | Francophone, débutant en MAO mais à l’aise avec les logiciels, fait du rap/trap (références : Timar, Leto, Djadja & Dinaz, Bouss). Travaille surtout sur **Mac**, veut aussi téléphone/tablette/Windows/Android. |
| **Langue de l’UI** | Français partout. |
| **Stack** | HTML/CSS/JS **vanilla** (aucun framework, aucune dépendance npm), Web Audio API + AudioWorklet, PWA (manifest + service worker), IndexedDB. |

**Fonctionnalités actuelles :** pistes illimitées (voix 🎤, instru 🎵, instrument 🎹, batterie 🥁), enregistrement micro avec décompte/métronome et compensation de latence, 17 effets maison, 20 préréglages voix, réglages rapides (écho, réverb, autotune…), atelier instru (détection BPM/tonalité, time-stretch, transposition, karaoké, fondus), piano roll, step sequencer 808, mixeur avec 2 bus (réverb, délai), export WAV/stems, sauvegarde auto, projets `.studio`, plugins externes `.js`, MIDI + MIDI Learn, raccourcis façon Logic, zoom HD jusqu’à l’échantillon, couleurs de pistes, appli installable hors ligne.

---

## 2. Organisation du dépôt

```
/                       ← servi tel quel par GitHub Pages (NE PAS éditer à la main : généré)
  index.html            appli complète (CSS + JS inlinés)
  worklets.js           processeurs AudioWorklet (aussi inlinés dans index.html en secours)
  sw.js                 service worker (réseau d’abord, cache si hors ligne)
  manifest.webmanifest, icon-*.png, apple-touch-icon.png
  Studio-fichier-unique.html   même appli en 1 fichier, utilisable en local (file://), sans PWA
  README.md             historique des versions (côté utilisateur)
  LISEZ-MOI.txt         guide de mise en ligne GitHub Pages (pour l’utilisateur)
  PASSATION.md          ce document
/src                    ← CODE SOURCE (c’est ici qu’on modifie)
  template.html         squelette HTML (barre du haut, zones, inputs cachés) avec marqueurs /*CSS*/ /*WORKLET*/ /*JS*/ <!--PWA-->
  style.css             tout le style (thème sombre façon Logic, responsive, tactile)
  worklets.js           AudioWorkletProcessors
  dsp.js                plugins d’effets + instruments (synthé, batterie)
  engine.js             moteur audio (graphe, lecture, enregistrement, rendu offline, WAV)
  ui1.js … ui6.js       interface (voir §5)
  collab.js             v3.0 : session à plusieurs (pont P ↔ Yjs, cadenas, présence, transport)
  vendor/yjs.min.js     Yjs 13.6.33 + lib0 0.2.119 (MIT), bundle IIFE → global `Y` (esbuild, ~95 Ko)
  build.py              concatène tout → fichiers à la racine
/tests                  scripts Playwright de non-régression (voir §9)
```

### Build & déploiement
```bash
python3 src/build.py          # génère index.html, sw.js, worklets.js, icônes… à la racine
git add -A && git commit -m "Studio vX.Y : …" && git push origin main
```
GitHub Pages republie en 1–2 min. Le JS est concaténé dans cet ordre : `vendor/yjs.min.js, dsp.js, engine.js, ui1.js … ui6.js, collab.js` (portée globale partagée, pas de modules ES). Le build nécessite Python 3 + Pillow (icônes).

### Procédure de nouvelle version (à respecter)
1. Incrémenter `APP_VERSION` dans `src/ui6.js`.
2. Ajouter un bloc `<h4>vX.Y</h4><ul>…</ul>` en tête de la fenêtre « Nouveautés » (`showChangelog` dans `ui6.js`).
3. Incrémenter `VER='studio-vX.Y'` dans `src/build.py` (nom du cache du service worker).
4. Ajouter une ligne dans `README.md` (section Versions).
5. Build, tests, push. L’utilisateur n’a qu’à **actualiser** (le SW est « réseau d’abord » et recharge la page au changement de contrôleur).

---

## 3. Modèle de données (objet global `P`)

Tout le projet est **un objet JSON sérialisable** (sauf l’audio, stocké à part par identifiant). C’est le point central pour le multijoueur.

```js
P = {
  id, name, bpm, sig /*3|4|6*/, key /*0-11*/, scaleIdx /*index dans SCALES*/,
  tracks: [Track], auxes: [Aux /*aux1 = Bus Réverb, aux2 = Bus Délai*/],
  master: { id:'master', name, vol, pan, plugins:[Plugin] /*limiteur par défaut*/ },
  cycle: { on, start, end },                       // en temps (beats)
  settings: { snap, latencyMs, countIn, metro, metroPlay, inputDev, azerty },
  midiMap: { 'cc:<canal>:<num>': '<clé cible>' },  // MIDI Learn (clés : voir targetSet() ui1.js)
  ext: { 'ext:<id>': '<source JS du plugin externe>' }
}
Track = { id, type:'audio'|'synth'|'drums', role?:'voice'|'instru', name, color,
  vol /*dB*/, pan /*-1..1*/, mute, solo, arm, mon,
  plugins:[Plugin], sends:[dB par aux], regions:[Region],
  instr /*synth : params SYNTH_PARAMS ; drums : kit DRUM_KITS*/, preset?, kit? }
Plugin = { type /*clé de PLUGINS*/, params:{…}, byp:boolean }
Region audio = { id, start /*beats*/, offset /*s*/, dur /*s*/, buf /*id dans BUFS*/, name,
  gain? /*dB*/, fi?, fo? /*fondus en s*/, mute?, bpm?, key?, scale? }
Region synth = { id, start, len /*beats*/, notes:[{p /*MIDI*/, s /*beats rel.*/, l, v}], name, mute? }
Region drums = { id, start, len, pat:{ steps, rows:{ kick:[0|{v,r /*roulement 1-4*/}], '808':…, snare, clap, hat, ohat, perc, rim } }, phase?, name, mute? }
```
- Positions en **beats** (noires) ; durées audio en **secondes** (`rLen()` convertit).
- `isInstru(t)` : piste audio avec `role==='instru'` (ou ancien nom commençant par 🎵). Pas d’armement d’enregistrement sur ces pistes.
- **Audio** : `BUFS[id] = AudioBuffer` (engine.js), **immuable** : tout traitement (reverse, tempo, karaoké…) crée un **nouvel id**. `PEAKS[id]` = cache min/max par blocs de 256 échantillons.

### Persistance
- **IndexedDB** `studio` v1 : store `projects` `{id,name,updated,bpm,tracks,json}` ; store `buffers` clé = id → `{sr,ch,len,data:[Float32Array]}`. Sauvegarde auto toutes les 8 s si le JSON a changé, + à la mise en arrière-plan (`saveLocal`, ui5.js). Les buffers ne sont écrits qu’une fois (`SAVED_BUFS`).
- **Fichier `.studio`** (échange entre appareils) : `uint32 0x53545544`, `uint32 longueurJSON`, JSON `{v:1, project, buffers:[{id,sr,ch,len}]}`, padding à 4 octets, puis les Float32 de chaque canal à la suite (`saveProject`/`openProject`, ui3.js).
- **localStorage** : `studio_last` (dernier projet), `studio_seen`, `studio_ver`, `studio_fold` (sections repliées), `studio_lat` (mode audio).

### Undo/redo
`snapshot()` (ui1.js) pousse `JSON.stringify(P)` dans `UNDO` **avant** chaque mutation ; `undo()`/`redo()` remplacent `P` puis `afterLoad()` (reconstruit le moteur + l’UI). Simple mais global : **à remplacer pour le multijoueur** (voir §8).

---

## 4. Moteur audio (`src/engine.js`, `src/dsp.js`, `src/worklets.js`)

- **`Engine(ctx, live)`** : une instance live (`E`, AudioContext) + une instance jetable par export (OfflineAudioContext, `renderMix`).
- **Graphe par piste/aux** (`makeStrip`) : `playIn → input → [plugins…] → fader → pan(StereoPanner) → mute → analyser → master.input` ; envois post-fader vers les aux. `updateStrip(obj)` applique les paramètres ; la chaîne n’est reconstruite que si la **signature** (types + bypass) change.
- **Lecture** : ordonnanceur « lookahead » (`tick` toutes les 20 ms, 160 ms d’avance) → `scheduleWindow(a,b,t0,fresh,stopCtx,metro)` programme audio, notes et pas de batterie ; gestion du cycle par segments (`segs`) ; `pos()` donne la position affichée. `stop()` coupe via un `playIn` neuf par lecture.
- **Enregistrement** : `rec-proc` (worklet) envoie les blocs d’entrée horodatés ; `stopRec()` aligne la prise avec `outputLatency + baseLatency + latence d’entrée + réglage utilisateur`. `carve()` (ui2.js) remplace la zone ré-enregistrée.
- **Worklets** : `rec-proc`, `pitch-proc` (autotune : détection YIN décimée + lecture à vitesse variable avec sauts d’une période et fondu ; gamme/tonalité passées par `processorOptions` **obligatoirement** pour l’export offline), `gate-proc`, `crush-proc`, `limit-proc` (limiteur à anticipation 4 ms, plafond garanti).
- **Plugins** (`PLUGINS` dans dsp.js) : `{name, cat, params:[{id,n,min,max,def,u,log,step,opts}], create(ctx,P,env) → {input, output, set(p), dispose?, comp?, filters?}}`. Plugins externes : fichier `.js` qui appelle `registerPlugin({...})` (même interface, id préfixé `ext:`), source stockée dans `P.ext`.
- **Instruments** : `synthVoice()` (2 osc + sub + filtre + ADSR + glide mono pour la 808) et `drumHit()` (8 sons synthétisés). Presets : `SYNTH_PRESETS`, `DRUM_KITS`.
- **Analyse / traitements** (ui6.js) : `detectBPM` (flux d’attaques + autocorrélation), `detectKey` (chroma FFT + profils Krumhansl), `wsola` (time-stretch), `resample`, `karaoke` (side + mid < 180 Hz).

---

## 5. Interface (`src/ui1.js` … `ui6.js`)

| Fichier | Contenu |
|---|---|
| **ui1.js** | État global (`ctx, E, P, PH, SEL, SELR, PPB, TH, UNDO, REDO, TAB, TYPING, REC, MIDI…`), utilitaires (`h()` créateur DOM, `menu`, `modal`, `toast`, `download`/partage mobile), création de projet/pistes, `VOCAL_PRESETS`, composant **knob**, MIDI + MIDI Learn (`targetSet`). |
| **ui2.js** | Rendu : en-têtes de pistes, **arrangement** (régions, glisser/rogner/copier, sélection rectangle, double-clic/double-tap), **rendu HD par tuiles** (`paintRegions`/`drawTile`, devicePixelRatio, échantillon par échantillon au zoom max), règle, inspecteur (sections repliables `isec`), tranches de console (`buildStrip`), menus de plugins, palette de couleurs, mixeur. |
| **ui3.js** | Fenêtres de plugins/instruments, panneau du bas (mixeur, **piano roll**, **step sequencer**), transport, enregistrement, import audio, `.studio`, export WAV/stems, modèle de plugin externe. |
| **ui4.js** | `bindUI`, menu Fichier, **raccourcis clavier**, clavier musical, règle (cycle + scrub), boucle d’affichage (`loop` : tête de lecture, vumètres, LCD), réglages, aide, `main()`. |
| **ui5.js** | IndexedDB, sauvegarde auto, « Mes projets », installation PWA, appui long tactile, enregistrement du service worker. |
| **ui6.js** | Version + nouveautés, réglages rapides (`QUICK`), atelier instru, analyses, navigation Logic (copier/coller, zoom, fit, nudge, mute région), modale des raccourcis. |

Principe de rendu : **pas de virtual DOM**. Les fonctions `renderAll / renderHeads / renderLanes / renderInspector / renderBottom` reconstruisent leur zone ; les interactions continues (glisser, knobs) modifient directement le style puis re-rendent au relâchement.

---

## 6. Contraintes & pièges connus (déjà résolus — ne pas les réintroduire)

1. **Worklets en `file://`** : `blob:` refusé par Chrome → ordre de chargement `worklets.js` (si http) → `data:` URL → `blob:` (`Engine.init`).
2. **Messages `port.postMessage` arrivent trop tard en rendu offline** → toute config nécessaire au 1er bloc passe par `processorOptions`.
3. **`DynamicsCompressorNode` ajoute un gain de compensation automatique** → l’ancien limiteur saturait les instrus (grésillement). Remplacé par `limit-proc`.
4. **Service worker** : stratégie *réseau d’abord* avec `fetch(..., {cache:'no-cache'})` + délai de 5 s puis cache ; rechargement auto sur `controllerchange`. GitHub Pages met jusqu’à ~10 min de cache HTTP.
5. **iOS/iPadOS** : pas de Web MIDI ; `navigator.audioSession.type='playback'` ; téléchargements via `navigator.share` (fichiers) ; pas de `dblclick` tactile → double-tap maison ; appui long → `contextmenu` synthétique.
6. **Instru importée** : toujours une **nouvelle piste `role:'instru'`** (jamais sur une piste voix) ; enregistrement interdit dessus.
7. **Pas d’effets imposés** : nouvelles pistes et projet démo sans plugins ni envois. Seul le limiteur du master est présent par défaut (anti-saturation).
8. **Canvas** : toujours multiplier par `devicePixelRatio` (écrans Retina), sinon flou.
9. YouTube : **ne pas** implémenter de téléchargement/capture YouTube (CGU + bloqué techniquement). L’import passe par un fichier.

---

## 7. Préférences de l’utilisateur (à garder en tête)

- Interface **comme Logic Pro** : mêmes réflexes de navigation (raccourcis, zoom, mixeur visible), barre du haut **compacte** (Fichier à gauche ; mixeur/piano/batterie à droite).
- **Simple** pour un débutant : préréglages en 1 clic + curseurs rapides, explications courtes en français.
- Ne rien imposer (effets ajoutés à la demande).
- Livraison par **versions** (v2.0, v2.1…) publiées directement sur GitHub, mise à jour par simple actualisation.
- Rendu visuel **net**, précis.

---

## 8. Chantier suivant : multijoueur (édition collaborative en direct)

### Objectif
Plusieurs personnes ouvrent le même projet via un lien et voient en direct les modifications des autres (pistes, régions, notes, effets, volumes…), comme Google Docs / Word en ligne. Chacun **écoute en local** sur sa machine ; on synchronise **les données du projet**, pas le flux audio.

### Recommandation d’architecture
- **CRDT Yjs** pour le document (`Y.Doc`) : fusion automatique des modifications simultanées, hors ligne puis resynchronisation, undo par utilisateur (`Y.UndoManager`), présence (`awareness`).
  - Mapping proposé : `doc.getMap('project')` → `bpm`, `sig`, `key`, `cycle`… ; `tracks` = `Y.Array<Y.Map>` ; `regions` = `Y.Array<Y.Map>` par piste ; `notes` = `Y.Array` ; `plugins` = `Y.Array<Y.Map>` ; `pat.rows` = `Y.Map<Y.Array>`.
- **Transport temps réel** (GitHub Pages est statique, il faut un service) — options :
  - **PartyKit / Cloudflare Durable Objects** + `y-partykit` : simple, gratuit pour démarrer.
  - **y-websocket** sur un petit serveur (Fly.io, Render…).
  - **Liveblocks** (Yjs managé, payant au-delà du gratuit).
  - **y-webrtc** (pair-à-pair) : sans serveur de données mais nécessite un serveur de signalisation ; moins fiable.
- **Fichiers audio** (lourds, immuables) : upload dans un stockage objet (**Cloudflare R2**, Supabase Storage, Firebase Storage) sous une clé = **hash du contenu** ; le document Yjs ne contient que l’id ; chaque client télécharge à la demande et met en cache dans IndexedDB (déjà en place). Encoder en FLAC/Opus/WAV 16 bits pour réduire la taille.
- **Présence** : avatar + couleur par personne, curseur/sélection de régions, tête de lecture des autres, « X modifie l’EQ de Voix 1 ». Option « écouter ensemble » : diffuser play/stop/position via awareness.
- **Salles & accès** : URL `…/studio/#room=<id>` ; v1 = lien secret ; plus tard comptes + droits (lecture seule / édition).


### ✅ Fait en v3.0 (`src/collab.js`)
Choix de l’utilisateur pour les cadenas : **toute la piste** (volume, pan, régions, notes, effets, envois), libération **manuelle ou automatique après 2 min d’inactivité**, **personne ne peut forcer** le cadenas d’un autre. Plusieurs cadenas par personne. Cibles : chaque piste (id), chaque bus (`aux1`, `aux2`), `master`, et `proj` (nom, BPM, mesure, tonalité).

Implémentation (différente du « refactor store » prévu ci-dessous, pour ne rien casser) :
- **Pont par différence** : `P` reste le modèle local de toute l’UI. `collabFlush()` (toutes les 100 ms + à chaque `snapshot()`) compare `sharedView(P)` à la dernière base (`COLLAB.last`) et écrit le diff dans le `Y.Doc` (`yObj`/`yArr` : réconciliation par `id` pour pistes/régions, par index sinon). Les changements des autres sont appliqués **en place** dans `P` (`patchRoot`, même identité d’objets → fenêtres et boutons restent branchés), puis `E.build(P)` + `renderAll()` (la lecture ne s’arrête pas).
- Mises à jour distantes **différées** pendant un glisser, un enregistrement ou une saisie (`busy()`), pour ne jamais casser une interaction en cours.
- **Non partagé** (propre à chacun) : `settings`, `midiMap`, `ext` (plugins externes : exécution de code → à traiter avec confirmation en v3.1), `cycle`, et sur les pistes `arm`, `mon`, `solo`.
- **Cadenas** : `Y.Map('locks')` `{u, n, c, t}`. Vérifiés dans `collabFlush` (une action touchant une cible verrouillée par un autre est annulée entièrement et `P` revient à l’état partagé) + blocage préventif des clics (capture sur `[data-lk]`) + champs désactivés. Expiration : chez les autres, 2 min sans nouvelle du propriétaire (`lockSeen`, horloge locale, pas de souci de décalage d’horloge) ; chez le propriétaire, battement toutes les 20 s s’il a été actif, sinon il libère lui-même. Libérés aussi en quittant / fermant la fenêtre.
- **Undo** : en session, `snapshot/undo/redo` sont remplacés par `Y.UndoManager` (origine locale seulement). Hors session, l’ancien undo JSON est inchangé.
- **Transport v3.0** : `BroadcastChannel('studio-room-<id>')` → fonctionne entre fenêtres du même navigateur (essai). Messages : `hello`/`sync` (vecteurs d’état), `up` (updates Yjs), `pres` (présence, 4 s), `bye`, `bufq`/`buf` (sons). Le premier arrivé partage son projet (départage par id si arrivées simultanées) ; les suivants l’adoptent (leur projet perso reste dans 📂 Mes projets).
- **Sons** : un client qui voit un `buf` inconnu le cherche dans IndexedDB puis le demande aux autres (`Float32Array` envoyés tels quels).
- Tests : `tests/t13.py` (2 fenêtres : synchro, cadenas, refus, undo par personne, sons, expiration, départ) et `tests/t14.py` (3 arrivées simultanées, 250 actions aléatoires → même projet partout, rechargement).

### Prochaine étape : v3.1 (réseau)
Remplacer `send()`/`onMsg()` par un vrai transport (PartyKit / y-websocket) — le protocole de messages ci-dessus peut être gardé tel quel. À prévoir : compte chez l’hébergeur (choix de l’utilisateur), persistance du document de la salle côté serveur, envoi des sons par stockage objet (hash) plutôt qu’en direct, confirmation avant d’exécuter un plugin externe reçu.

### (Plan initial) Refactor store avant le réseau
Aujourd’hui l’UI **mute `P` directement** puis appelle `snapshot()` / `E.updateStrip()` / `renderX()`. Pour le multijoueur :
1. Créer une **couche de store** : toutes les mutations passent par des fonctions (`store.setTrackVol(id,v)`, `store.moveRegion(id,start,trackId)`…) qui écrivent dans le `Y.Doc` (dans une transaction).
2. **Observer** le `Y.Doc` (`observeDeep`) → reconstruire/mettre à jour `P` (ou lire directement le Y.Doc) → `E.updateStrip` / rendu ciblé de la zone touchée.
3. Remplacer `UNDO/REDO` JSON par `Y.UndoManager` (origine = utilisateur local).
4. Les interactions continues (glisser une région, tourner un knob) : écrire en direct (léger) ou à fréquence limitée (~20/s), et valider au relâchement.
5. Garder IndexedDB (`y-indexeddb`) pour le hors-ligne.

### Plan par versions
- **v3.0** : couche store + Yjs en local uniquement (aucune régression), undo Yjs.
- **v3.1** : provider réseau + salles par lien + présence (qui est connecté).
- **v3.2** : synchro des fichiers audio (upload/hash/téléchargement), enregistrements partagés.
- **v3.3** : curseurs/sélections des autres, verrou doux pendant un glisser, « écouter ensemble ».
- **v3.4** : comptes, droits, liste des projets partagés.

### Points d’attention
- Ajout d’un service tiers = clés/API, coût, RGPD ; conserver le fonctionnement **100 % local** si pas de connexion.
- Aucune dépendance npm aujourd’hui : soit embarquer Yjs en un fichier (bundle ESM ~70 Ko), soit passer à un petit outillage (esbuild). Garder la compatibilité PWA hors ligne (ajouter le bundle au cache du SW).
- Les ids (`uid()`) sont aléatoires : OK pour un CRDT. Les buffers étant immuables, pas de conflit sur l’audio.

---

## 9. Tests

Scripts Playwright dans `/tests` (Chrome headless, micro simulé via `--use-fake-device-for-media-stream`). Ils supposent l’appli servie en local :
```bash
python3 -m http.server 8765        # depuis la racine du dépôt
python3 tests/t6.py                # PWA : service worker, hors ligne, sauvegarde, tactile
python3 tests/t7.py                # instru : BPM/tonalité, time-stretch, transposition, karaoké, préréglages, réglages rapides
python3 tests/t9.py                # raccourcis : piste dupliquer/supprimer/annuler, zoom, sélection rectangle, couper/copier/coller
python3 tests/t10.py               # barre du haut sans débordement, piste instru dédiée, zoom HD
python3 tests/t12.py               # déplacement de la tête de lecture pendant la lecture
python3 tests/t13.py               # v3.0 : session à 2 fenêtres, cadenas, undo par personne, sons
python3 tests/t14.py               # v3.0 : arrivées simultanées, actions aléatoires, rechargement
```
(Les chemins `/home/claude/...` et le chemin de Chrome dans les scripts sont à adapter à la machine.)

Mesures de référence : autotune → note juste à ±0,5 Hz ; limiteur → distorsion ≈ −69 dB, crête ≤ plafond ; BPM 142 et Fa# mineur détectés sur un beat de test.

---

## 10. Autres idées en attente (proposées à l’utilisateur)
Automation (volume/effets dans le temps), prises multiples (comping), mastering en 1 clic, sampler/pads, banque de sons plus riche, enregistrement MIDI, accordeur.

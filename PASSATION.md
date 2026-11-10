# Studio — Passation technique (v3.7)

> Document de reprise pour continuer à développer **Studio** (DAW dans le navigateur, interface inspirée de Logic Pro)
> et préparer le mode **multijoueur / édition collaborative en direct**.
> Rédigé le 7 novembre 2026, à la fin de la session de développement v1 → v2.4.

---

## 1. Le produit en bref

| | |
|---|---|
| **Appli en ligne** | https://1blazeleplufor.github.io/studio/ |
| **Dépôt** | `github.com/1blazeleplufor/studio` (public, GitHub Pages sur `main`, dossier racine) |
| **Version** | 3.7.7 (`APP_VERSION` dans `src/ui6.js`) |
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
  ui1.js … ui7.js       interface (voir §5)
  collab.js             session à plusieurs : pont P ↔ Yjs, cadenas, présence, transport Supabase, sons, écoute seule
  collab2.js            v3.3 : écouter ensemble, chat, commentaires timeline, versions, bounce MP3
  ui10.js               v3.6 : défilement auto, suivi en lecture, roue de couleurs + pipette, préréglages ZZ, marqueurs dans la règle, fenêtres détachables
  ui11.js               v3.7 : panneaux fluides (grille de #main calculée), paroles, prompteur, focus, dispositions, raccourcis, menu ⋯, notes dans la règle, prises multiples
  flac.js               v3.3 : encodeur FLAC 16 bits (sans perte) pour l’envoi des sons
  ecoute.html           page publique d’écoute d’un bounce MP3 (copiée à la racine)
  vendor/lame.min.js    lamejs (LGPL-3.0), encodeur MP3, copié à la racine et chargé à la demande
  vendor/yjs.min.js     Yjs 13.6.33 + lib0 0.2.119 (MIT), bundle IIFE → global `Y` (esbuild, ~95 Ko)
  build.py              concatène tout → fichiers à la racine
/tests                  scripts Playwright de non-régression (voir §9)
/bridge                 Studio Bridge (Python + pedalboard) : scan AU/VST3, fenêtres natives (fil principal), traitement du son via WebSocket local, sert aussi l’appli sur http://localhost:47123 ; lanceurs Mac (.command) / Windows (.bat) qui créent un venv ; guide LISEZ-MOI.md
```

### Build & déploiement
```bash
python3 src/build.py          # génère index.html, sw.js, worklets.js, icônes… à la racine
git add -A && git commit -m "Studio vX.Y : …" && git push origin main
```
GitHub Pages republie en 1–2 min. Le JS est concaténé dans cet ordre : `vendor/yjs.min.js, dsp.js, engine.js, ui1.js … ui7.js, collab.js` (portée globale partagée, pas de modules ES). Le build nécessite Python 3 + Pillow (icônes).

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
- **Plugins pro (v2.5)** : `verbpro` → `verb-proc` (FDN 8 lignes modulées, diffusion early/late, decay à 3 bandes, 14 modes `VMODES`, couleurs 70s/80s/moderne, gate pour le mode non-linéaire) ; `tunepro` → `tunepro-proc` (YIN + TD-PSOLA à 50 ms de latence, formants/gorge, humanize, flex-tune, vibrato, notes 0=corrigée/1=ignorée/2=retirée). **Compensation de latence** : un plugin peut déclarer `latency(sr)` (secondes) ; `rebuildChain` calcule `strip.latency` et `scheduleWindow` avance tous les évènements de la piste d’autant.
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
| **ui9.js** | v3.5 — Bibliothèque de plugins (`toggleLibrary`, touche Y, `#library`) + client **Studio Bridge** (`BRIDGE`, WebSocket `ws://127.0.0.1:47123/ws`). Plugin type `bridge` (params `pid,name,fmt,vendor,state` ; `state` = `raw_state` du plugin en base64) → worklet `bridge-proc` : blocs de 512 éch. envoyés en binaire (`<IIIII` magic 0x31414253 « SBA1 », num, start, frames, ch + float32 planaire), retour placé dans un anneau, sortie à latence fixe `BRIDGE.lat` (2048/4096/8192, compensée via `latency()`), son direct si non connecté. Export : `renderMix` est enveloppé → **bounce temps réel** (`realtimeBounce`, worklet `cap-proc` sur `master.an`) si un plugin `bridge` est actif. Instruments de l'ordinateur : non pris en charge (listés grisés). |
| **ui8.js** | v3.4 — Import Logic Pro & co : parcours des dossiers glissés (`dropEntries`/`walkEntries`, un `.logicx` est un dossier), lecture de `Alternatives/000/MetaData.plist` (plist XML ou binaire : BeatsPerMinute, SongKey, SongGenderKey, SongSignatureNumerator, AudioFiles), décodeurs de secours AIFF/AIFC/CAF/WAV, horodatage BWF (`bext` TimeReference, départ Logic à 01:00:00:00) pour replacer les prises, regroupement des prises `Nom#NN` (seule la dernière active), import MIDI SMF (pistes synth + batterie canal 10 → patterns). Le format interne `ProjectData` de Logic est fermé : arrangement/plugins/automation non récupérables. |
| **ui7.js** | Fenêtres dédiées des plugins pro : `openVerbPro` (Réverb « Ères ») et `openTunePro` (Pitch Pro, graphique de hauteur en direct alimenté par `inst.graph`). |
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
- **Non partagé** (propre à chacun) : `settings`, `midiMap`, `ext` (plugins externes : exécution de code → à traiter avec confirmation en v3.2), `cycle`, et sur les pistes `arm`, `mon`, `solo`.
- **Cadenas** : `Y.Map('locks')` `{u, n, c, t}`. Vérifiés dans `collabFlush` (une action touchant une cible verrouillée par un autre est annulée entièrement et `P` revient à l’état partagé) + blocage préventif des clics (capture sur `[data-lk]`) + champs désactivés. Expiration : chez les autres, 2 min sans nouvelle du propriétaire (`lockSeen`, horloge locale, pas de souci de décalage d’horloge) ; chez le propriétaire, battement toutes les 20 s s’il a été actif, sinon il libère lui-même. Libérés aussi en quittant / fermant la fenêtre.
- **Undo** : en session, `snapshot/undo/redo` sont remplacés par `Y.UndoManager` (origine locale seulement). Hors session, l’ancien undo JSON est inchangé.
- **Transport v3.0** : `BroadcastChannel('studio-room-<id>')` → fonctionne entre fenêtres du même navigateur (essai). Messages : `hello`/`sync` (vecteurs d’état), `up` (updates Yjs), `pres` (présence, 4 s), `bye`, `bufq`/`buf` (sons). Le premier arrivé partage son projet (départage par id si arrivées simultanées) ; les suivants l’adoptent (leur projet perso reste dans 📂 Mes projets).
- **Sons** : un client qui voit un `buf` inconnu le cherche dans IndexedDB puis le demande aux autres (`Float32Array` envoyés tels quels).
- Tests : `tests/t13.py` (2 fenêtres : synchro, cadenas, refus, undo par personne, sons, expiration, départ) et `tests/t14.py` (3 arrivées simultanées, 250 actions aléatoires → même projet partout, rechargement).

### ✅ Fait en v3.2 : réseau via Supabase (projet `btkrbzdgtjvjfzpamkjj`, région UE, formule gratuite)
- Constantes `SUPA` en tête de la partie transport de `collab.js` (URL + clé **publishable**, publique par nature). Test : `localStorage.studio_supa={"url":"http://localhost:8790","key":"test"}` pour viser le faux serveur ; `url:""` = BroadcastChannel seul.
- **Realtime broadcast** en WebSocket brut (protocole Phoenix `vsn=1.0.0`, sans supabase-js) : canal `realtime:studio-<salle>`, événement `m`. Les mises à jour Yjs sont regroupées (`Y.mergeUpdates`, ~90 ms) ; binaire en base64 ; messages > 120 Ko découpés en `part` de 100 Ko (limite Supabase 256 Ko). Reconnexion automatique (délai exponentiel ≤ 15 s) et `hello`/`sync` à chaque reconnexion → les modifications faites hors ligne sont fusionnées. BroadcastChannel reste actif en plus (doublons sans effet : Yjs est idempotent).
- **Cadenas** dans un 2ᵉ `Y.Doc` (`COLLAB.ldoc`) **jamais sauvegardé** → pas de cadenas fantôme quand tout le monde est parti.
- **Table `salles`** `{id, doc (base64 de encodeStateAsUpdate), maj}` : lue à l’arrivée (`dbLoad`), écrite toutes les 8 s par **une seule personne** (plus petit id connecté) + à la création + au départ (`keepalive`, si < 60 Ko). Un arrivant ne « crée » la salle avec son projet que si la base répond « vide » et que personne n’a répondu ; si le serveur est injoignable il attend (aucun écrasement).
- **Stockage `sons`** (public en lecture) : chaque `BUFS[id]` utilisé est envoyé en WAV 16 bits sous `sons/<id>.wav` (ids immuables ; « Duplicate » = déjà envoyé ; liste mémorisée dans `localStorage.studio_up`). Les autres le téléchargent (`decodeAudioData`) s’il n’est pas dans IndexedDB. Limite 50 Mo/fichier (≈ 5 min stéréo).
- Salles : id aléatoire de 12 caractères (`crypto.getRandomValues`). Sécurité = lien secret ; les règles RLS laissent la table ouverte au rôle `anon` (quiconque a la clé peut lister les salles) → à durcir avec des comptes (v3.4).
- Tests : `tests/mock_supabase.js` (faux Realtime/REST/Storage, `/__drop` coupe le réseau) + `tests/t16.py` (2 « appareils » sans canal commun, cadenas, son via stockage, 6000 notes, message 300 Ko, coupure/reprise, retour plus tard depuis la base). t13/t14 visent aussi le faux serveur.
- SQL appliqué côté Supabase : bucket `sons` public + policies `anon` select/insert ; table `salles` + RLS + policy `anon` all.


### ✅ Fait en v3.3
**Bug corrigé** : une prod de ~6 min faisait 69 Mo en WAV 16 bits → refusée par Supabase (limite 50 Mo/fichier, réponse HTTP 400 avec `statusCode:"413"`), l’appli réessayait en silence. Désormais :
- `flac.js` : encodeur FLAC maison (prédicteurs fixes 0–4, Rice partitionné, stéréo gauche/côté/milieu), vérifié bit à bit avec ffmpeg ; ~1,5 s pour 20 s stéréo. Morceaux de 40 Mo (`sons/<id>.flac` ou `<id>.<i>.flac`), carte Yjs `media` (`{f,n,size,dur}`) dans le document → les autres savent quoi télécharger. Anciens WAV de la v3.2 encore lus (`studio_up`).
- Envoi par `XMLHttpRequest` (progression), réception en flux (progression), un seul téléchargement à la fois par son, panneau `#xfers`, messages d’erreur clairs.

**Sécurité Supabase** (migration `studio_v33_fonctions` + verrouillage) : plus d’accès direct à la table `salles` ni de listage du stockage. Fonctions `SECURITY DEFINER` : `salle_get(id)`, `salle_put(id,doc)` (id ≥ 12 caractères), `version_add/list/get/del(salle,…)` sur la table `versions`. Il faut connaître l’identifiant exact.

**Lien écoute seule** : jeton `meta.listen` (carte Yjs `meta`), lien `#ecoute=<jeton>`. Les éditeurs rejoignent aussi le canal `realtime:studio-v-<jeton>` ; le **relais** (plus petit id d’éditeur) répond aux `hello` des auditeurs et retransmet les mises à jour ; copie en base sous `L-<jeton>`. L’auditeur ne reçoit jamais l’id de la salle (testé). Chez lui, `lockOf()` renvoie un cadenas « écoute seule » partout et `collabFlush` annule toute modification. Chat/commentaires de l’auditeur : message `vmsg`, ajoutés par le relais.

**Écouter ensemble** (`collab2.js`) : messages `tp` {play|stop|seek, beat, at, cyc}. Horloges recalées par `ping`/`pong` (décalage = t1 − (t0 + rtt/2), garde la mesure au plus faible rtt). Écart mesuré entre 2 navigateurs : ~10 ms. `C2.follow` (bouton 🎧, `localStorage.studio_follow`).

**Chat** `doc.getArray('chat')` (300 derniers), **commentaires** `doc.getArray('cmts')` de `Y.Map` {id,beat,u,n,c,t,x,done,rep:Y.Array}, épingles `.cpin` dans `#lanes`, clic droit dans la règle. **Versions** : JSON `{v:1,p:sharedView(P)}` ; restaurer = sauvegarde auto « Avant le retour… », puis `patchRoot` + `collabFlush` (annulable par Ctrl+Z ; refusé si une piste concernée est verrouillée). **Mes sessions** : `localStorage.studio_rooms`. **Bounce** : `renderMix` → lamejs → `sons/bounces/<12 car.>.mp3` → `ecoute.html#f=…&t=…`, posté dans le chat si en session.

Tests : `tests/t17.py` (avec `LIMIT=400000 node tests/mock_supabase.js 8790`, morceaux de 300 Ko via `localStorage.studio_part`).


### ✅ Fait en v3.6 (`ui10.js` + `collab2.js`)
- **Défilement automatique** : écouteurs en phase de capture sur `#lanesWrap`, `#ruler`, `#prScroll` ; près d’un bord (40 px) une boucle `requestAnimationFrame` fait défiler puis renvoie un `pointermove` synthétique à la cible, pour que les gestionnaires de glisser existants recalculent. `lanesPointer` (ui2) calcule maintenant le déplacement en coordonnées du contenu (`clientX + scrollLeft`).
- **Suivi en lecture** : `followPlayhead()` (appelé par `loop` d’ui4) garde la tête vers 45 % de la largeur ; molette horizontale ou barre de défilement pendant la lecture → `FOL.user` (plus de suivi jusqu’au prochain `Engine.play`).
- **Couleurs** : `colorPicker` remplacé (roue 36 teintes × 7 anneaux HSL sur canvas, gris, couleurs du projet, récentes `localStorage.studio_colors`, `EyeDropper` si dispo). `t._set(c)` permet de l’utiliser pour autre chose qu’une piste (marqueurs).
- **Style ZZ** (catégorie de `VOCAL_PRESETS`) : faits d’après la description de l’utilisateur (« une voix mélodie et une voix plus drill trap ») et les chaînes vocales courantes du rap FR actuel, pas d’après une analyse de ses morceaux. Pitch Pro « voix grave », retune 10 ms / 35 ms, EQ, comp, etc.
- **Notes** : déplacées du document de session vers le projet `P.cmts` (migration automatique de l’ancien `Y.Array('cmts')`) → marchent seul, sont annulables, sauvegardées, exportées. **Marqueurs** `P.marks=[{id,beat,name,color}]` dessinés dans la règle (`drawMarks`, zones `MHITS`) : clic = aller, glisser = déplacer, clic droit = menu.
- **Messages vocaux** : `MediaRecorder` (webm/opus ou mp4 selon navigateur), 2 min max, `sons/vocaux/<12 car.>.<ext>`, entrée de chat `{voc:{f,ext,type,dur}}`. « ➕ Au projet » ou glisser-déposer (`text/studio-voc`) → `vocToTrack` (décodage, nouveau buffer, partagé ensuite en FLAC comme les autres sons).
- **Panneau** : largeur/côté dans `localStorage.studio_cpanel`. Si `innerWidth − largeur ≥ 1080`, l’appli se pousse à côté (`body.cp-open`, `--cpw`, barre du haut compacte), sinon le panneau passe par-dessus.
- **Fenêtres détachées** : `window.open('')` même origine ; on y copie les `<style>` et on y **déplace** l’élément (`#cpanel`, `#bottom`, `.pwin`) — les écouteurs suivent. `document.querySelector/All/getElementById` sont étendus pour chercher aussi dans ces fenêtres (le code existant continue de marcher, vumètres compris). Les `onclick="…"` du HTML sont rattachés à la fenêtre principale. Retour automatique à la fermeture (`pagehide` + vérification toutes les 1,5 s). Position/taille dans `localStorage.studio_layout` ; au démarrage, bandeau « Rouvrir vos fenêtres détachées » (un clic par fenêtre, le navigateur bloque l’ouverture automatique) + bouton « Autoriser le 2ᵉ écran » (`getScreenDetails`).
- Tests : `tests/t18.py`.


### ✅ Fait en v3.7 (publié le 07/11/2026, à la demande de l’utilisateur) — ce qui était noté :
- **Chat : le texte envoyé reste dans le champ « Écrire un message… »** (signalé le 07/11/2026). Le message part bien, mais on doit pouvoir écrire le suivant dans un champ vide.
  - Cause : dans `drawPanel()` (`src/collab2.js`), `chatSend(inp.value)` ajoute le message au `Y.Array('chat')` → `onChatChange` → `drawPanel()` redessine **immédiatement** le panneau en recopiant le brouillon (`draft = … '.cin input' … .value`), qui contient encore le texte. Le `inp.value=''` qui suit vide l’ancien champ, déjà remplacé.
  - Correction prévue : vider le champ **avant** d’envoyer, dans les deux endroits (touche Entrée et bouton ➤) : `const v=inp.value;inp.value='';chatSend(v)`. Vérifier aussi le cas « fenêtre de chat détachée » et ajouter le contrôle dans `tests/t17.py` (le champ doit être vide après l’envoi).
- **Fenêtre « Paroles »** (demandé le 07/11/2026) : des paroles pour **le projet entier** et des paroles **par piste** (ex. couplet de la Voix 1, ad-libs de la Voix 2).
  - S’ouvre avec un bouton (barre du haut ou inspecteur de la piste), se **ferme** (✕) et se **détache** dans une fenêtre comme le chat / le mixeur (⧉, système `detachOpen/detachClose` de `src/ui10.js`, position mémorisée dans `studio_layout`).
  - Onglets : « Projet » + un onglet par piste (ou liste de pistes à gauche). Texte libre, sauvegardé avec le projet (`P.lyrics` et `track.lyrics`) → partagé automatiquement en session (pont P ↔ Yjs), annulable, exporté dans le `.studio`.
  - Points à trancher avec l’utilisateur avant de coder : édition à plusieurs en même temps sur le même texte (fusion caractère par caractère avec `Y.Text` plutôt qu’un simple champ texte remplacé en bloc) ; respect des cadenas (une piste verrouillée → ses paroles en lecture seule ?) ; repères de temps dans le texte (cliquer une ligne = aller à la mesure) ; taille de police / mode « prompteur » pendant l’enregistrement.
- **Inspecteur (fenêtre de modification de la piste, colonne de gauche `#insp`) détachable et redimensionnable** (demandé le 07/11/2026) : tirer son bord pour l’élargir/rétrécir (largeur `--insp` mémorisée), le fermer, ou le détacher (⧉) dans une fenêtre comme le chat et le mixeur.
- **Bouton 📌 invisible** (signalé le 07/11/2026) : `#arrtools` (outils au-dessus des noms de pistes) a la largeur de la colonne `--hdr` avec `overflow-x:auto` et barre de défilement cachée → le 📌, ajouté en dernier, est coupé. À corriger : les outils qui ne tiennent pas passent dans un menu « ⋯ » (ou le 📌 va ailleurs, ex. dans la règle).
- **Disposition plus fluide (« que ça se smooth mieux »)** : seules **deux zones restent fixes : les pistes (timeline `#lanesWrap`) et leurs noms à gauche (`#heads`) avec ce qu’il y a déjà**. Tout le reste doit pouvoir être **ouvert / fermé, redimensionné (tirer le bord) et détaché** : inspecteur, panneau du bas (mixeur / piano roll / batterie), chat · notes · marqueurs · versions, paroles, fenêtres d’effets, bibliothèque de plugins. Prévoir « Réinitialiser la disposition » et garder tout ça dans `studio_layout`.
- **Épingles des notes toujours visibles jusqu’à leur suppression** (demandé le 07/11/2026). Aujourd’hui (`renderPins`, `src/collab2.js`) : une note « résolue » disparaît de la timeline (sauf case « afficher les résolues »), et les épingles sont posées en haut de `#lanes` → elles défilent hors de vue quand on descend dans les pistes. À faire : afficher **toutes** les notes tant que personne ne les a supprimées (une note résolue reste visible, grisée avec ✔), et dessiner les épingles **dans la règle** (toujours visible, comme les marqueurs) en plus du trait vertical dans les pistes ; clic = ouvrir la note, survol = aperçu du texte.
- **Notes : choisir la piste** (signalé le 07/11/2026) : aujourd’hui une note n’a qu’une position dans le temps (`beat`) et son épingle s’affiche en haut de la timeline, donc « sur la première piste ». Ajouter `tid` (piste) : clic droit **sur une piste** → « Ajouter une note ici » à cet endroit et sur cette piste, épingle dessinée sur la bonne piste ; dans le panneau, un menu « Piste : (tout le morceau) / Voix 1 / … » ; les notes sans `tid` restent « tout le morceau » (affichées dans la règle).
- **Notes : la position ne se met pas à jour** (signalé le 07/11/2026) : dans l’onglet 📌, « Nouvelle note mesure X (tête de lecture) » est calculé au moment où le panneau est dessiné (`at` dans `drawPanel`) → si on déplace la tête de lecture, la note est quand même posée à l’ancien endroit, il faut fermer/rouvrir le panneau. Corriger : prendre la position de la tête de lecture **au moment du clic sur « Ajouter »** et rafraîchir l’étiquette en direct quand la tête bouge (lecture, clic dans la règle, touches).
- **Idées validées par l’utilisateur pour la v3.7** :
  1. **Dispositions enregistrées** (comme les screensets de Logic) : « Écriture » (paroles + chat), « Enregistrement » (inspecteur + paroles en gros), « Mix » (mixeur en grand)… on passe de l’une à l’autre en 1 clic ou avec 1, 2, 3 ; chacun peut créer/renommer les siennes.
  2. **Mode focus** : une touche cache tout sauf les pistes et la barre de lecture ; la même touche réaffiche tout.
  3. **Panneaux qui s’accrochent aux bords** : glisser un panneau vers la gauche, la droite ou le bas ; une zone bleue montre où il va se ranger.
  4. **Un raccourci par panneau** : I inspecteur, X mixeur, L paroles, T chat… (vérifier les conflits avec les raccourcis existants façon Logic et le clavier musical ; les afficher dans l’aide).
  5. **Prompteur pendant l’enregistrement** : les paroles de la piste armée s’affichent en gros pendant la prise.
  6. **Prises multiples (comping)** : plusieurs prises sur le même passage, puis on garde les meilleurs bouts de chacune.

**Comment c’est fait (v3.7)** :
- `#main` n’a plus deux colonnes fixes : `applyLayout()` (ui11) calcule `grid-template-columns` selon les panneaux ouverts (`UI.insp`, `UI.lyr` : `{open,w,side}` dans `localStorage.studio_ui`), avec `order` pour gauche/droite et des poignées `.pgrip` superposées (redimensionnement léger via `applyLayout(true)`, sans recréer les poignées). En dessous de 900 px (`isSmall()`), l’ancien comportement mobile est gardé.
- En-tête `.phead` (titre glissable + ⇆ ⧉ ✕) ; glisser vers un bord affiche `#dockz` (zones gauche/droite, bas pour les paroles) ; relâcher hors de la fenêtre = détacher (`detachOpen`, ui10, étendu à `insp`, `lyr`, `library` qui reviennent à leur place, `DET_HOME`).
- **Paroles** : `P.lyrics` et `track.lyrics` (dans le projet → sauvegarde, export, undo, partage). En session, la clé `lyrics` est stockée en `Y.Text` (`toY(v,k)` + `yTextDiff` dans `collab.js`) → deux personnes qui écrivent en même temps fusionnent lettre par lettre ; l’affichage se met à jour sans perdre le curseur (`refreshLyrics`). Piste verrouillée → lecture seule. Mode « en bas » = onglet 📝 du panneau du bas.
- **Prompteur** `#prompter` : lignes `[n]` = mesure n ; affiché automatiquement à l’enregistrement (`UI.prompt`), fermé à l’arrêt.
- **Prises** : `region.takes=[{buf,at,name}]` (`at` = temps où l’échantillon 0 du buffer tombe), `region.take` ; `carve` est intercepté pendant `stopRecord` pour récupérer l’audio recouvert. Choisir une prise = `buf` + `offset=(start−at)×spb` (décalage négatif autorisé dans `Engine.scheduleWindow` = silence au début). `usedBufs` inclut les prises (sauvegarde IndexedDB + envoi en session).
- **Dispositions** `SCREEN_DEF` / `localStorage.studio_screens` (touches `Digit1-3`, AZERTY compris) ; **focus** = `body.focus`. Raccourcis ajoutés dans la fenêtre des raccourcis.
- Barre d’outils `#arrtools` : `fitTools()` cache ce qui dépasse dans le menu « ⋯ ».
- `Element.prototype.append/prepend` ignorent `false`/`null` (évite le texte « false » des `cond&&h(...)`).
- Tests : `tests/t19.py`.
- v3.7.5 : `ui12.js` test de latence : 4 + 10 clics à 100 BPM via `E.click`, capture par le même `rec-proc` qu’une prise (horodatage `currentFrame`), enveloppe 2 ms, attaque = premier passage du seuil (max(5×bruit, 22 % du pic)) dans [clic−60 ms, clic+550 ms], médiane → retard total ; conseil = total − (outputLatency+baseLatency+latence d’entrée). Validé en boucle simulée (150 → 150 ms, 230 → 230 ms, ±1 ms). **Le réglage reste par projet (`P.settings.latencyMs`) — l’utilisateur ne veut PAS d’un réglage global par défaut** (il a 200 ms dans « Mon morceau », trouvé à la main ; matériel : Windows, SteelSeries Sonar + Arctis Nova 5 sans fil).
- v3.7.6 : export rapide. `worklets.js` : saut du silence (après 3 blocs d’entrée et de sortie nulles) pour Pitch/Gate/Crush/Limit/Verb/TunePro. `engine.js` : en hors-ligne un plugin contourné n’est pas instancié ; `renderMix` débranche les analyseurs et coupe `fader→pan` de chaque piste hors de ses zones de régions (+ queue d’effet), via `OfflineAudioContext.suspend` aux bords de blocs de 128. Pistes avec chorus/filtre (LFO) jamais coupées → rendu identique au bit près (vérifié). Bench 3,5 min / 5 voix : 87,6 s → ~38 s. Stems : `pr.tracks` réduit à la piste visée. Export MP3 (`exportMix(mode,'mp3')` → `encodeMP3` 320k). `ui13.js` : dossier d’enregistrement (File System Access API, handle dans l’IDB `studio_fs`), prises copiées en WAV dans `Projet/Prises`, exports via `saveOut` dans `Projet/Exports` sinon téléchargement ; ligne ajoutée dans ⚙ Réglages après la latence (réglage de latence intouché).
- v3.7.7 : `ui14.js` ⭐ Mes réglages voix : localStorage `studio_mypresets` = [{name,plugins,sends,vol,withVol,at}] (global à tous les projets, pas dans P). `applyMine(pistes,r,nom)` remplace plugins+sends(+vol), l’autotune reprend la tonalité du projet, ignore les pistes verrouillées par un autre, pose `t.mine` (lien → « Mettre à jour »). Section insérée par wrap de `renderInspector` avant « Préréglages voix ». `applyVocalPreset` efface `t.mine`.
- v3.7.4 : accroche aux objets pour les régions (`edgeCands`/`magnet`/`showGuide` dans ui1, branchés dans `lanesPointer` d’ui2 pour déplacer et rogner) : tolérance 10 px, priorité sur la grille, ligne `.sguide` + losange `.sgdot` sur la piste cible ; Maj = désactivé.
- v3.7.3 : `snapB` (ui1) utilise `gridStep()` : le pas du magnétisme est divisé par 2 tant qu’il fait ≥ 24 px à l’écran (zoom extrême = libre). `snapPH(b,e)` pour la tête de lecture (règle, glisser la ligne) : aimant 8 px sur débuts/fins de régions, marqueurs, cycle, 0 ; Alt = libre.
- v3.7.2 : l’utilisateur ne comprend pas « mesure · temps » : positions en minutes/secondes (« 1m25 », `fmtMS`/`fmtBar` dans collab2.js), compteur `#lcdTime` en premier et toujours visible. La barre compacte (`body.cp-tight`) ne s’active que si l’appli devient étroite (panneau ouvert et moins de 1400 px restants) et cache alors `.cell.pos` (mesure), jamais les minutes. Repères de paroles `[1m25]` / `[1:25]` (les `[5]` = mesure 5 restent acceptés).
- v3.7.1 : paroles à droite par défaut (comme Logic) ; `studio_ui.v2` force une fois le passage à droite pour ceux qui avaient l’ancienne valeur.

### Prochaines étapes
- v3.4 : curseurs/sélections des autres, notifications, plugins externes partagés avec confirmation, appel vocal (WebRTC + TURN).
- v3.4 : comptes, droits (lecture seule / édition), liste des salles, RLS stricte.

### (Plan initial) Refactor store avant le réseau
Aujourd’hui l’UI **mute `P` directement** puis appelle `snapshot()` / `E.updateStrip()` / `renderX()`. Pour le multijoueur :
1. Créer une **couche de store** : toutes les mutations passent par des fonctions (`store.setTrackVol(id,v)`, `store.moveRegion(id,start,trackId)`…) qui écrivent dans le `Y.Doc` (dans une transaction).
2. **Observer** le `Y.Doc` (`observeDeep`) → reconstruire/mettre à jour `P` (ou lire directement le Y.Doc) → `E.updateStrip` / rendu ciblé de la zone touchée.
3. Remplacer `UNDO/REDO` JSON par `Y.UndoManager` (origine = utilisateur local).
4. Les interactions continues (glisser une région, tourner un knob) : écrire en direct (léger) ou à fréquence limitée (~20/s), et valider au relâchement.
5. Garder IndexedDB (`y-indexeddb`) pour le hors-ligne.

### Plan par versions
- **v3.0** : couche store + Yjs en local uniquement (aucune régression), undo Yjs.
- **v3.1** : *(fait, hors multijoueur)* Réverb Pro « Ères » + Pitch Pro + compensation de latence.
- **v3.2** : provider réseau + salles par lien + présence (qui est connecté).
- **v3.3** : synchro des fichiers audio (upload/hash/téléchargement), enregistrements partagés.
- **v3.4** : curseurs/sélections des autres, verrou doux pendant un glisser, « écouter ensemble ».
- **v3.5** : comptes, droits, liste des projets partagés.

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
python3 tests/t18.py               # v3.5 : pont (avec tests/bridge_mock : faux pedalboard + faux plugins) — bibliothèque, chargement, son traité, état mémorisé
python3 tests/t19.py               # v3.5 : calage de l’export temps réel avec plugin de l’ordinateur (±2 éch.)
python3 tests/t17.py               # v3.4 : import Logic (.logicx factice dans tests/fixtures_logic), plist binaire/XML, AIFF/CAF, MIDI
python3 tests/t15.py               # v3.1 : Pitch Pro (justesse, latence compensée), Réverb Pro, fenêtres
python3 tests/t13.py               # v3.0 : session à 2 fenêtres, cadenas, undo par personne, sons
python3 tests/t14.py               # v3.0 : arrivées simultanées, actions aléatoires, rechargement
node tests/mock_supabase.js 8790   # faux Supabase (module ws requis : npm i ws, ou WS_MODULE=chemin)
python3 tests/t16.py               # v3.2 : 2 appareils via le serveur, sons, coupure réseau, salle retrouvée
python3 tests/t19.py               # v3.7 : paroles, panneaux, dispositions, focus, notes par piste, prompteur, prises multiples
python3 tests/t18.py               # v3.6 : défilement auto, couleurs, ZZ, marqueurs, notes, vocaux, panneau, fenêtres détachées
python3 tests/t17.py               # v3.3 : FLAC découpé, écouter ensemble, chat, commentaires, versions, écoute seule, bounce MP3
```
(Les chemins `/home/claude/...` et le chemin de Chrome dans les scripts sont à adapter à la machine.)

Mesures de référence : autotune → note juste à ±0,5 Hz ; limiteur → distorsion ≈ −69 dB, crête ≤ plafond ; BPM 142 et Fa# mineur détectés sur un beat de test.

---

## 10. Autres idées en attente (proposées à l’utilisateur)
Automation (volume/effets dans le temps), prises multiples (comping), mastering en 1 clic, sampler/pads, banque de sons plus riche, enregistrement MIDI, accordeur.

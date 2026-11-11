# Studio — Passation complète (v3.8.2, 11 novembre 2026)

> **À qui s’adresse ce document :** à un autre Claude qui reprend le projet **Studio** (une station audio de type Logic Pro qui tourne dans le navigateur) avec le même utilisateur. Il doit pouvoir continuer **comme si c’était la même conversation**.
>
> Il contient trois parties :
> - **A. Reprendre le travail** : qui est l’utilisateur, comment lui parler, ses règles, comment travailler, publier et tester.
> - **B. Historique de la conversation** : le résumé que j’ai moi-même reçu en reprenant le projet (copié tel quel), puis tout ce qui s’est passé après, avec les messages de l’utilisateur.
> - **C. Documentation technique** : dépôt, modèle de données, moteur audio, interface, multijoueur, tests.
>
> Ce fichier est dans le dépôt : `PASSATION.md`. Lisez au moins **A** et **B.3** avant toute action.

---

# A. Reprendre le travail

## A1. Le projet en une minute

| | |
|---|---|
| **Appli en ligne** | https://1blazeleplufor.github.io/studio/ (installable en PWA ; l’utilisateur se sert de l’appli installée) |
| **Dépôt** | `github.com/1blazeleplufor/studio`, public. GitHub Pages publie la branche `main` (dossier racine). |
| **Version actuelle** | **3.8.2** (`APP_VERSION` dans `src/ui6.js`, cache `VER='studio-v3.8.2'` dans `src/build.py`) |
| **Technique** | HTML/CSS/JS **vanilla**, sans framework ni npm. Web Audio API + AudioWorklet, PWA, IndexedDB. Yjs embarqué pour le multijoueur, Supabase (Realtime, Storage, fonctions SQL) pour les sessions entre appareils. |
| **Code source** | `/src`. Les fichiers à la racine sont **générés** par `python3 src/build.py` : ne jamais les éditer à la main. |
| **Langue** | **Français partout** : interface, messages, réponses à l’utilisateur. |

## A2. L’utilisateur

- Francophone, **rappeur débutant**. Il fait du rap/trap/drill (références citées : Timar, Leto, Djadja & Dinaz, Bouss, ZZ). Débutant en production mais à l’aise avec les logiciels.
- Il écrit souvent **par dictée vocale ou vite au téléphone** : beaucoup de fautes de frappe, phrases longues. Il faut comprendre l’intention.
- **Matériel actuel** : Windows, Chrome, appli installée (PWA). Son : périphériques virtuels **SteelSeries Sonar** et casque sans fil **Arctis Nova 5**, 96 kHz, mode audio « playback ». Au début du projet il parlait surtout de Mac ; aujourd’hui c’est Windows.
- Il travaille parfois **à plusieurs** (jusqu’à 4 personnes) en session partagée, depuis des appareils différents.
- **Ses projets** : « Mon morceau » a une **compensation de latence de 200 ms**, qu’il a trouvée à la main et à laquelle il tient. Les autres projets sont à 0.

## A3. Ses règles (à respecter absolument)

1. **Ne jamais modifier ses réglages ni ses données sans son accord explicite.** Citation : « ne change rien sans etre sur que je retouve mon reglage dorigine pcq jai pris du temps trouver le reglage ». En particulier, **la latence reste réglée par projet**, jamais une valeur globale par défaut : « fais le test de latence sans mettre tout les projet a 200ms en defaut ».
2. **Les temps s’affichent en minutes et secondes, sous la forme « 1m25 »**, jamais en « mesure · temps », qu’il ne comprend pas.
3. **Le panneau des paroles est à droite**, comme dans Logic.
4. Interface **comme Logic Pro** (raccourcis, mixeur, réflexes), mais **simple** : préréglages en 1 clic, curseurs rapides, explications courtes en français.
5. **Ne rien imposer** : pas d’effets ajoutés d’office. Seul le limiteur de la sortie est présent par défaut.
6. Quand il demande des idées (« propose-moi… et moi je te dis »), **proposer une liste numérotée et attendre son choix**. Ensuite il valide souvent **tout** (« Tu vas devoir tout construire », « MAJ ») : il faut alors construire, tester et **publier**.
7. Il aime qu’on **publie directement** une nouvelle version. Il la récupère simplement en **actualisant** la page.
8. Il veut **voir ce qu’il annule** avant d’annuler (d’où l’historique v3.8.1). Il n’aime pas les actions « à l’aveugle ».
9. Ne pas implémenter de téléchargement YouTube (règles de YouTube, et bloqué techniquement).

## A4. Comment lui répondre

- En **français**, en tutoyant, ton simple et chaleureux, sans jargon. Si un terme technique est utile, l’expliquer en une phrase (par exemple : normaliser, c’est monter le volume d’une prise jusqu’au maximum sans saturer, sans changer le son).
- Dire **où cliquer** : « ⚙ Réglages → … », « ☰ Fichier → … », « inspecteur (ⓘ) → section … ».
- Annoncer la **version publiée** et rappeler d’**actualiser** l’appli.
- Être honnête sur les limites : par exemple, le navigateur ne montre que le nom d’un dossier, pas son chemin complet ; les outils automatiques ont été testés sur des voix de synthèse et pas sur ses vraies prises.
- Garder un ton bref quand il s’impatiente. Exemple : à « tu tourne en rond ? », j’ai répondu en 2 phrases où j’en étais.

## A5. Méthode de travail

1. **Récupérer le dépôt** dans la session (outil `add_repo` avec `owner=1blazeleplufor`, `repo=studio`, `access=push`), le cloner, puis `git pull` avant tout changement.
2. **Coder dans `/src`**. Le JS est concaténé dans **une seule portée globale**, sans modules ES, dans cet ordre (voir `src/build.py`) :
   `vendor/yjs.min.js, dsp.js, engine.js, ui1.js … ui9.js, flac.js, collab.js, collab2.js, ui10.js … ui16.js`.
   Les worklets sont dans `src/worklets.js`. `vendor/lame.min.js` et `ecoute.html` sont copiés à la racine.
3. **Style de code habituel** : on ajoute une fonctionnalité dans un **nouveau fichier `uiNN.js`**, qu’on ajoute à la liste de `build.py`. Il **enveloppe** les fonctions globales existantes au lieu de réécrire les anciens fichiers :
   `{const o=renderInspector;renderInspector=function(){const r=o.apply(this,arguments); … ;return r}}`.
   Les fonctions déclarées avec `function` peuvent être réassignées. Fonctions déjà enveloppées plusieurs fois : `snapshot/undo/redo`, `renderInspector`, `menu`, `settingsModal`, `stopRecord`, `toggleRecord`, `openPlugin`, `regionEl`, `drawTile`, `regionTools`, `renderMix`, `applyMaster`, `applyVocalPreset`.
4. **Avant toute modification de `P`**, appeler `snapshot()` (annulation, synchro de session, historique). Après : `E.updateStrip(obj)` pour le son, puis `renderAll()` / `renderLanes()` / `renderInspector()` pour l’affichage.
5. **Tester** avec Playwright (voir C9), puis **publier** (A6).
6. Garder ce document **à jour** : une ligne par version dans C8, plus la partie B.

## A6. Publier une nouvelle version (procédure à respecter)

1. Incrémenter `APP_VERSION` dans `src/ui6.js`.
2. Ajouter un bloc `<h4>vX.Y.Z</h4><ul>…</ul>` **en tête** de la fenêtre « Nouveautés » (`showChangelog`, ui6.js), en français simple.
3. Incrémenter `VER='studio-vX.Y.Z'` dans `src/build.py` : c’est le nom du cache du service worker. Sans ça, l’utilisateur ne reçoit pas la mise à jour.
4. Ajouter une ligne dans `README.md` (section Versions).
5. Mettre à jour `PASSATION.md` : ligne de version en C8, tableau C5 si nouveau fichier, partie B.
6. `python3 src/build.py`, lancer les tests, puis :
   `git add -A src tests index.html sw.js worklets.js Studio-fichier-unique.html README.md PASSATION.md`
   `git commit` (message « vX.Y.Z : … » suivi des lignes d’attribution demandées par l’environnement)
   `git pull --rebase` puis `git push origin main`.
7. GitHub Pages republie en 1 à 2 minutes. L’utilisateur **actualise** l’appli : le service worker est « réseau d’abord » et recharge la page quand il change.

## A7. Environnement de la session précédente (pour gagner du temps)

- Dépôt cloné dans `/home/claude/studio`. `git push` fonctionnait directement, grâce au proxy de la session et à l’accès donné par `add_repo`.
- **Pas d’accès réseau pour pip ni npm**. Il fallait faire avec ce qui était installé : Python 3 + Pillow (nécessaire au build), Playwright Python, Chrome dans `/usr/bin/google-chrome`, Node. Le module `ws` (pour le faux Supabase) est dans `/opt/npm-tools/node_modules/ws`.
- Serveurs à relancer à chaque reprise (ils s’arrêtent entre deux tours) :
  - `cd /home/claude/studio && nohup python3 -m http.server 8765 &`
  - `WS_MODULE=/opt/npm-tools/node_modules/ws nohup node tests/mock_supabase.js 8790 &`
- Captures d’écran des tests dans `/home/claude/test/` : à regarder pour vérifier l’affichage.
- **Supabase** : projet `btkrbzdgtjvjfzpamkjj` (région UE, formule gratuite), URL `https://btkrbzdgtjvjfzpamkjj.supabase.co`, clé *publishable* `sb_publishable_JAuJ-AqcF_6hFESge6X7tg_VuYdcg24`. Cette clé est publique par nature et figure déjà dans le code. Le connecteur MCP Supabase était branché et a servi aux migrations SQL.
- L’utilisateur a aussi « Claude in Chrome » comme navigateur préféré. Il n’a pas été nécessaire.

## A8. Points ouverts / à surveiller (au 11/11/2026)

- **À calibrer sur de vraies voix** : « 🧠 Analyser ma voix » et le mastering 1 clic n’ont été testés que sur des voix de synthèse. Les corrections peuvent être trop fortes ; sur le test, l’assistant allait souvent jusqu’aux limites (graves −6, présence +5, aigus +5). Si l’utilisateur trouve que « c’est trop », réduire les coefficients dans `analyzeVoice` (ui15.js) ou les cibles `AV_TARGET` / `MASTER_STYLES`.
- **Fondu entre prises** : la valeur par défaut de 30 ms s’applique aussi aux anciens projets (régions qui se touchent).
- **L’historique (🕘) repart de zéro** à chaque rechargement de page, comme Ctrl+Z avant. « Retirer le mastering » fonctionne indépendamment de l’historique.
- **Dernière demande traitée** : retirer le mastering qu’il avait fait et dont il n’était pas sûr. Je lui ai indiqué ☰ Fichier → « ❌ Retirer le mastering » ou 🕘 → bouton rouge. Il n’a pas encore dit si c’était fait.
- **Idées encore en attente** (jamais construites) : automation (volume et effets dans le temps), sampler/pads, banque de sons plus riche, enregistrement MIDI, accordeur, curseurs et sélections des autres en session, appel vocal (WebRTC), comptes et droits (lecture seule / édition), sécurité Supabase plus stricte avec comptes.

---

# B. Historique de la conversation

## B.1 Résumé reçu en reprenant le projet (copié tel quel)

> Le projet a été développé sur plusieurs longues conversations. Quand le contexte devenait trop long, un résumé était transmis à la conversation suivante. Voici **le dernier résumé que j’ai reçu**, à l’identique. Il était en anglais et je ne l’ai pas traduit, pour ne rien perdre. Il couvre tout jusqu’à la v3.7.5 et le début du travail sur la v3.7.6. Les éléments plus anciens (v1 → v3.7) sont aussi détaillés en partie C.

```text
1. Primary Request and Intent:
   - The user is a French-speaking beginner rapper. The whole UI is in French and all answers must be in French.
   - The project is "Studio", a browser DAW styled after Logic Pro. Repo `github.com/1blazeleplufor/studio`, GitHub Pages on `main`, app link https://1blazeleplufor.github.io/studio/. Source lives in `/src`, built by `python3 src/build.py` into root files.
   - Overall arc so far:
     - Multiplayer sessions for 4 people, each able to put locks (cadenas) on a whole track. Locks release manually or after 2 min of inactivity; nobody can force someone else's lock.
     - Cross-device sessions via Supabase.
     - Many features through v3.7.5, all published.
   - Latest request (2026-11-09 22:25), verbatim: « on peut pas dl le projet en mp3 ?? et pourquoi tout les exports sonnt long comme ca tu peux le resoudre ? et affiche moi le chemins denregirstrement dans les parametre pour que on puisse le changer »
     - (a) Add an MP3 download/export.
     - (b) Exports take too long; fix it. I verified the file duration is correct (the project ends at 3m31), so the problem is render speed.
     - (c) Show the recording path in settings and make it changeable. In my previous reply I proposed a "Dossier d'enregistrement" via the File System Access API, and the user effectively asked for it.
   - Earlier constraints that still apply:
     - Latency compensation stays per project. The user said: « fais le test de latence sans mettre tout les projet a 200ms en defaut » and « ne change rien sans etre sur que je retouve mon reglage dorigine pcq jai pris du temps trouver le reglage ». « Mon morceau » has latencyMs=200; the others have 0.
     - Never change the user's settings or data without explicit consent.
     - Lyrics panel goes on the right, like Logic.
     - Times are displayed as « 1m25 », never as mesure/temps.
   - The user's hardware: Windows, Chrome, SteelSeries Sonar virtual devices plus an Arctis Nova 5 wireless headset, 96 kHz, audio mode "playback". They also use the installed PWA.

2. Key Technical Concepts:
   - Vanilla JS with no npm. All files are concatenated into one global scope. Build order (src/build.py): `vendor/yjs.min.js, dsp.js, engine.js, ui1…ui9.js, flac.js, collab.js, collab2.js, ui10.js, ui11.js, ui12.js`. Worklets live in `worklets.js`. `vendor/lame.min.js` and `ecoute.html` are copied to the root. `VER='studio-vX'` in build.py is the service worker cache name.
   - Release procedure:
     - bump `APP_VERSION` in ui6.js;
     - add a `<h4>` changelog block in `showChangelog` (ui6.js);
     - bump VER in build.py;
     - add a README line;
     - update PASSATION.md;
     - build, test, commit with the attribution lines, push to main.
   - Global P model with a P ↔ Yjs bridge by diff (`collabFlush`, `yObj`/`yArr`, `patchRoot`). Lyrics use `Y.Text` (`toY(v,k)`, `yTextDiff`). Locks live in a separate `COLLAB.ldoc`. Per-user `Y.UndoManager`.
   - Supabase:
     - Realtime broadcast over a raw Phoenix WebSocket (vsn 1.0.0).
     - SECURITY DEFINER RPC functions `salle_get/salle_put/version_add/list/get/del`.
     - Bucket `sons`: anon insert-only, public read by URL, listing blocked.
     - Sounds are uploaded as FLAC split into 40 MB pieces. Voice messages go in `sons/vocaux/`, bounces in `sons/bounces/`.
   - Wrapping global functions by reassignment (e.g. `{const o=fn;fn=function(){…}}`).
   - Element.prototype.append/prepend are patched to ignore false/null.
   - Detachable windows use `window.open('')` and DOM moves. `document.querySelector/All/getElementById` are patched to also search popup documents.
   - Offline render optimisations (in progress): worklet silence skip, analyser removal, per-track span gating with `OfflineAudioContext.suspend/resume`.

3. Files and Code Sections:
   - Files created over the session:
     - `src/collab.js`: sessions, locks, transport, sounds, listen-only mode.
     - `src/collab2.js`: listen together, chat, voice messages, notes/markers, versions, MP3 bounce, panel.
     - `src/flac.js`: FLAC encoder.
     - `src/ui10.js`: autoscroll, color wheel, ZZ presets, markers in the ruler, detach system.
     - `src/ui11.js`: v3.7 layout panels, lyrics, prompter, takes, screensets, focus, shortcuts, the ⋯ toolbar menu, note pins.
     - `src/ui12.js`: latency test.
     - `src/ecoute.html`, `src/vendor/yjs.min.js`, `src/vendor/lame.min.js`.
     - `tests/mock_supabase.js` and tests t13–t19.
   - `src/collab2.js` already has the function to reuse for the MP3 export:
     `async function encodeMP3(buf,kbps,onProg)` (lazy-loads lame.min.js via `loadLame()`), plus `xhrUpload(url,body,type,onProg)` (in collab.js) and `bounceModal()`.
   - `src/ui3.js` `exportMix(mode)` (current, unmodified):
     [code de exportMix à ce moment-là — depuis remplacé, voir ui3.js]
     The stems loop renders the full project once per track; this still needs optimising.
     The menu lives in ui4.js `B('#bFile',e=>menu(e,[...]))`. Its items include `['Exporter le morceau en WAV',()=>exportMix('all')]`, cycle and stems, plus `['👥 Session à plusieurs…',collabModal]`, `['📀 Partager un lien d'écoute (MP3)…',bounceModal]` and `['🖥 Dispositions et panneaux…',()=>screensModal()]`.
   - `src/worklets.js` (MODIFIED in this turn, not yet published). Appended at the end: silence skip for PitchProc, GateProc, CrushProc, LimitProc, VerbProc, TuneProProc (rec-proc, bridge-proc and cap-proc are deliberately excluded).
   - `src/engine.js` (MODIFIED, not yet published):
     - In `rebuildChain`: `if(pl.byp&&!this.live){s.plugins.push(null);continue} // export : effet contourné = rien à calculer`
     - `renderMix` has been rewritten with RENDER_GATING / RENDER_NOAN / RENDER_SPANS (analyser removal + per-track span gating via ctx.suspend).
     - Note: `rLen` uses the global `spb()`, which comes from P.bpm. That is fine as long as the project passed in is P or a copy with the same bpm.
   - `src/ui12.js` (v3.7.5, published): `runLatencyTest`, `latencyTestModal`, and a 🎯 Tester button injected into the settingsModal row « Compensation de latence ». It applies only on click, only to the open project.
   - `src/ui4.js`:
     - `async function settingsModal()` builds `modal([...h('div',{class:'kv2'},'Compensation de latence (ms)',input)...])`. This is where to add a « Dossier d'enregistrement » row (or do it by wrapping, as ui12 does).
     - The `stopRecord` / `toggleRecord` wrappers are chained (collab.js lock guard, ui11 takes and prompter).
     - `E.stopRec()` returns the take's AudioBuffer.
   - `PASSATION.md` holds the full technical handoff, updated through v3.7.5.

4. Errors and fixes (recent and important):
   - The first gated render differed from the reference (max diff 1.28 starting at 8.03 s, the first voice entry). Isolating each change:
     - analyser removal alone gave diff 0;
     - span gating alone gave diff 1.28;
     - with chorus removed from the voices, the gated render is identical (0.0000) and faster (51.5 s → 37.9 s).
     The cause is the chorus OscillatorNode LFO not advancing while its track is disconnected, so its phase differs. Not yet decided: whether to keep gating for tracks with LFO effects (chorus/phaser/tremolo/robot) or exclude them. Excluding them guarantees an identical render.
   - Benchmarks in the sandbox (3.5 min project, 5 voice tracks with gate+tunepro+eq+comp+deess+chorus+width, plus verbpro aux):
     - 87.6 s originally;
     - 65 s with silence skip;
     - about 38–40 s with full gating.
     Per-60-s effect costs: tunepro 1.0 s, pitch 1.4 s, gate 0.6 s, verbpro 1.7 s, limiter 1.0 s; a bypassed tunepro still cost 0.67 s before the fix.
   - Earlier fixes, all done:
     - stray « false » text from `append(cond&&h())`;
     - lyrics panel resize grip being recreated mid-drag (now `applyLayout(true)`);
     - lyrics staying invisible in the bottom panel;
     - extra undo step from the [ ] Temps button (`dataset.nosnap`);
     - startup race: `renderLyrics` ran before P existed (`boot11` waits for P);
     - top bar overflow (`cp-tight` class only when narrow; minutes counter `.cell.tm` shown first and never hidden, `.cell.pos` hidden instead);
     - chat input not clearing after send;
     - inline `onclick` handlers breaking in detached windows (rebound to the main window);
     - the 69 MB WAV upload rejected by Supabase (switched to FLAC split in pieces);
     - various test artifacts.
   - User feedback incorporated:
     - lyrics on the right;
     - times in « 1m25 »;
     - the minutes counter disappeared when the markers panel was opened (fixed);
     - playhead not precise with zoom (zoom-adaptive `gridStep()`, `snapPH` magnet on region edges, Alt for free placement);
     - projection lines when dragging regions (`magnet`/`showGuide`, Shift to disable).

5. Problem Solving:
   - Export slowness, diagnosed:
     - effects processing silence for the whole song;
     - bypassed worklets still running;
     - analysers forcing every chain to be pulled;
     - stems rendering the full project N times.
   - Fixes in progress: silence skip, skipping bypassed plugins when offline, removing analysers, span gating.
   - Remaining:
     - handle the LFO phase, either by excluding LFO tracks from gating or by accepting it;
     - optimise stems (keep only the target track, its sends and the aux buses);
     - possibly speed up the master limiter.
   - Recording location: today it is Chrome IndexedDB (`C:\Users\<user>\AppData\Local\Google\Chrome\User Data\Default\IndexedDB\https_1blazeleplufor.github.io_0.indexeddb.leveldb`), not plain files. Plan:
     - File System Access API (`showDirectoryPicker`, Chrome and Edge desktop);
     - store the handle in a separate IndexedDB (e.g. a `studio_fs` DB);
     - a settings row showing the folder name. The browser only exposes the folder name, not the full path; tell the user.
     - « Choisir un dossier… » and « Ne plus utiliser » buttons;
     - save each take as WAV in a project subfolder (track – Prise n – date);
     - exports (WAV/MP3/stems) go into an `Exports` subfolder when a folder is set, otherwise they download;
     - permission re-request on a user gesture (banner or at record start);
     - optional button to copy all project takes into the folder.
   - MP3 export: File menu items « Exporter le morceau en MP3 » (and the cycle zone), using `renderMix` + `encodeMP3(buf,320 or 192)` + `download(blob,name+'.mp3')`, with progress.

6. All user messages (chronological, condensed; quotes where it matters):
   - Initial: make the app multi-user (4 people), each able to put « cadenas » on a track or a setting. Answered via question: lock the whole track; release manually + automatically after inactivity; nobody can force.
   - « oui on dois pouvoir etre sur le truc depuis 2 endrits differents, serveur obligé ? dis moi ce que je doisfaire pour t'aider »
   - The Supabase SQL error on the policy (already exists).
   - Sent Supabase key `sb_publishable_JAuJ-AqcF_6hFESge6X7tg_VuYdcg24` and URL `https://btkrbzdgtjvjfzpamkjj.supabase.co`.
   - « va pour le ecouter tous ensemble, jai mis une prod … l'autre personne voit la piste met pas me son de la prod ni son decoupage, sinon tu peux nous rajouter un chat en direcct … propose moi toute les autres idées … avant de faire les modifs ». Chose: timeline comments, Mes sessions, listen-only link, MP3 bounce, versions.
   - Auto-scroll at the edge; full color palette (attached image); 1-click preset for ZZ's voice effects (Spotify link); timeline notes; voice messages in chat; resizable chat window; detachable windows for 2 screens. Then answers: auto-scroll "Les deux"; ZZ « trouve comment elle est tu peux le faire, il a une voix melodie et une voix plus drill trap »; detach all four; all four extra ideas.
   - « note pour la v7 a ne pas sortit tout de suite, quand on ecris un message dans le tchat … le texte reste dans le cadre … ajoute le a la note de la v7 »
   - « il faut un truc paroel du projet et paole par piste aussi … ouvir et detacher … fermer aussi, ajoute a la note »
   - Inspector detach/resize, hidden pin button, « que ca se smooth mieux », only tracks and their names fixed, « dautre ameliorations en tete ? » (then interrupted the question tool). Screenshot of the cut-off 📌.
   - « on devrait pouvoir voir les epingles … jusqu'a quelle soit supprimé … dautre idée ou pas ? »
   - Validated ideas 1–6 (screensets, focus, docking, shortcuts, prompter, comping); notes can't target a track other than the first; note position doesn't update.
   - « Fenêtre « Paroles » … comme sur logic a gauche de l'ecran, construit tout et publie »
   - « Les paroles à droite comme sur logique »
   - « tu dois me donner le temps de la ou je suis dans le truc, genre a 1m25 tu marque 1m25 … » (interrupted my tool call), then « en fait tu la mis mais ill disparait quand jouvreles marqueurs » with a screenshot.
   - « je peux pas glisser le cursuer ou je veux, normamelement plus je zoom plus ca devrait etre precis, la je peux pas dermarer en etant collé a ma piste … responsive avec le zoom » (with a screenshot)
   - « et fais tes lignes deprojection pour caler une piste a la suite dune autre priste … comme sur autocad … l'accroche au objet »
   - « et pourquoi j'ai du mettre la compensation de latence a 200ms … ? ne change rien sans etre sur que je retouve mon reglage dorigine pcq jai pris du temps trouver le reglage »
   - « fais le test de latence sans mettre tout les projet a 200ms en defaut, et dis moi ou est ce que tu enregistre les fichier de son sur le pc ou ne peut modifier le chemin denregistrement nul part »
   - « Donne moi le lien de lapp »
   - LATEST: « on peut pas dl le projet en mp3 ?? et pourquoi tout les exports sonnt long comme ca tu peux le resoudre ? et affiche moi le chemins denregirstrement dans les parametre pour que on puisse le changer »

7. Pending Tasks (for v3.7.6, then publish): [tous faits depuis, voir B.2]
```

(Seuls les trois blocs de code du résumé — `exportMix`, l’ajout à `worklets.js` et `renderMix` — ont été raccourcis en une ligne ou une mention entre crochets ; le code actuel est dans le dépôt. Tout le reste est intact.)

## B.2 Suite de la conversation après ce résumé

### 9 novembre 2026 — v3.7.6 : export MP3, exports rapides, dossier d’enregistrement

- **Demande** (reprise du résumé) : « on peut pas dl le projet en mp3 ?? et pourquoi tout les exports sonnt long comme ca tu peux le resoudre ? et affiche moi le chemins denregirstrement dans les parametre pour que on puisse le changer »
- **Ce que j’ai fait** :
  - Pistes avec chorus ou filtre (effets à LFO) **jamais coupées** pendant l’export, pour un rendu identique au bit près (vérifié : écart 0).
  - Stems : on ne calcule que la piste visée.
  - Export MP3 320 kb/s dans ☰ Fichier (morceau et zone de cycle).
  - Nouveau fichier `ui13.js` : « Dossier d’enregistrement » dans ⚙ Réglages. Il affiche « Interne au navigateur (pas de fichiers) » ou 📁 le nom du dossier choisi. Les prises y sont copiées en WAV dans `Projet/Prises` et les exports vont dans `Projet/Exports`. Boutons pour changer de dossier, autoriser, copier les sons du projet, ne plus utiliser.
- **Mesure** : 87,6 s → ~38 s sur un projet de 3,5 min avec 5 voix chargées.
- **Réponse donnée** : pourquoi c’était lent (effets qui calculaient le silence, effets coupés qui tournaient, vumètres pendant l’export, stems qui recalculaient tout), le gain mesuré, où trouver le MP3 et le dossier. J’ai précisé que le navigateur n’affiche que le nom du dossier, pas son chemin complet, et que sa latence de 200 ms n’avait pas été touchée.

### 10 novembre 2026, 21h58 — v3.7.7 : ⭐ Mes réglages voix

- **Message (tel quel)** : « Tu peux me faire un truc où quand je trouve mon réglage de voix, je puisse l'enregistrer sous réglage voix 1 et que après je puisse l'appliquer à n'importe quelle piste, mais genre toutes les pistes. Et est-ce que tu peux aussi m'aider à normaliser le son, égaliser le son? En fait, c'est quoi normaliser? Parce que j'ai vu que tu avais mis une option normaliser, mais je ne comprends pas trop ce qu'elle fait. Mais est-ce que tu pourrais me faire un truc genre égaliseur de son ou je sais pas quoi? Et aussi me rajouter une option pour faire, tu vois, imagine je pose, après je repose et je veux que les deux ils se fusionnent bien parfaitement. Genre un truc fusion en mode smooth, tu vois, genre de smooth de volume ou je sais pas trop, un truc comme ça. Genre propose-moi ce que tu peux me proposer et moi je te dis. Et si tu as des idées, n'hésite pas parce que là je sens qu'il manque des choses. Pareil pour le réglage du son, j'arrive pas trop à faire un truc comme j'ai envie pour l'instant. Mais en vrai, si. Mais mets-moi un truc pour enregistrer et peut-être c'est bon. Parce que là, en fait, je me fais des modifications sur des presets que tu as fait, des presets de voix. Et mes modifications, après, elles reviennent tout le temps quand je. Bah, à chaque fois, elles reviennent. Mets-moi un truc pour enregistrer, un truc propre et tout, appliqué partout, machin. »
- **Ce que j’ai fait tout de suite** (la demande était claire) : nouveau fichier `ui14.js`, section « ⭐ Mes réglages » dans l’inspecteur d’une voix.
  - 💾 Enregistrer (nom par défaut « Réglage voix N », volume en option), clic pour appliquer à la piste, « → toutes » pour toutes les voix, menu ⋯ pour remplacer, renommer, supprimer ou appliquer aux pistes choisies.
  - 📋 Copier le réglage d’une piste sur toutes les voix.
  - Lien « Mettre à jour » quand on retouche une piste qui utilise un réglage.
  - Le réglage est gardé dans `localStorage`, pour tous les projets.
- **Explications données** :
  - Pourquoi ses modifications « revenaient » : il recliquait sur un préréglage d’usine, ce qui remet les valeurs d’origine.
  - Ce qu’est « Normaliser » : monter le volume d’une prise jusqu’à juste sous le maximum, sans changer le son.
- **Propositions numérotées** (en attente de son choix) :
  1. Fondu enchaîné automatique.
  2. Égaliser le volume des prises.
  3. Égaliser le son des prises.
  4. Égaliseur visuel.
  5. Assistant « Analyser ma voix ».
  6. Volume régulier automatique.
  7. Mastering en 1 clic.
  8. Comparer A/B.
  9. Nettoyage des respirations et du bruit.

### 10 novembre 2026, 22h03 — v3.8 : les 9 outils

- **Message (tel quel)** : « Là, je te mens pas, tu m'as vendu du rêve. Tu vas devoir tout construire. Désolé. Merci. J'attends la 3V, je sais pas combien. MAJ »
- Pendant le travail, à 22h14 : « tu tourne en rond ? » J’ai répondu en 2 phrases : les 9 outils étaient codés et testés, je relançais les anciens tests avant de publier.
- **Ce que j’ai fait** : `engine.js` (fondus enchaînés auto et son par prise) et nouveau fichier `ui15.js` (section « 🪄 Outils voix », voir C8 v3.8.0). Publié en **v3.8.0** avec le test `tests/t22.py`.
- **Résultats de test** (voix de synthèse) :
  - Volume des prises égalisé à 0,1 dB près.
  - Respirations −12 dB et bruit −20 dB sans toucher à la voix (écart 0,00 dB).
  - Égaliseur visuel déplaçable à la souris.
  - A/B fonctionnel.
  - Mastering : limiteur calé sur la cible.
- **Réponse donnée** : où trouver chaque outil. Prévenu que l’assistant et le mastering n’avaient été testés que sur des voix de synthèse, à ajuster à l’oreille.

### 10 novembre 2026, 23h46 — v3.8.1 : historique lisible, retrait du mastering

- **Message (tel quel)** : « ok le controle Z y me conviens pas, on le laisse mais tu dois rajouter un bouton pour faire retour et afficher les dernieres actions pour etre sur de ce quon supprime, par exemple la je viens de faire un masterinng et jaime pas je voudraisle retirer mais je suis pas sur de lavoir bien fais, et ai pas envie de refaire un controle Z pcq je sais pas ce que je vais enlever, tu comprends ? tu peux maider ? surtout permet moi de retirer le mastering si il y est toujours »
- **Ce que j’ai fait** (nouveau fichier `ui16.js`) :
  - Boutons ↶ ↷ 🕘 à côté de ☰ Fichier.
  - Infobulle « Annuler : … ».
  - Panneau Historique : liste en clair, la plus récente en haut, avec l’heure ; « Annuler jusqu’ici » avec confirmation qui liste exactement ce qui part ; section « ↷ Remettre ».
  - Bandeau orange « Un mastering est en place » avec bouton rouge « Retirer le mastering ». Aussi dans ☰ Fichier.
  - Le retrait n’enlève que le mastering et garde les modifications faites après.
  - Publié en **v3.8.1** avec le test `tests/t23.py`.
- **Réponse donnée** : comment retirer son mastering (☰ Fichier ou 🕘) ; l’historique repart de zéro au rechargement, donc pour le mastering d’avant la mise à jour il faut passer par le bouton.

### 11 novembre 2026, 21h48 — cette passation

- **Message (tel quel)** : « Tu me fais une passation complète de tout le projet daw ? Elle doit contenir la conversation de base ou la passation que tu as toi même reçus, pour que un autre Claude puisse tout reprendre comme si c’était toi »
- **Ce que j’ai fait** :
  - Réécrit ce document en entier (parties A, B, C).
  - Petit correctif dans `ui16.js` : les changements de marqueurs et de notes (`P.marks`, `P.cmts`) apparaissent maintenant correctement dans l’historique. Publié en **v3.8.2**.
  - Publié ce document dans le dépôt.

## B.3 Où on en est (à lire avant de répondre)

- Tout ce qui a été demandé est **construit et publié** (v3.8.2). Aucune demande de l’utilisateur n’est en cours de construction.
- Le prochain message de l’utilisateur sera probablement :
  - un retour sur les outils voix (trop fort ou pas assez, un bug sur ses vraies prises),
  - la confirmation que le mastering est retiré,
  - ou une nouvelle idée.
- Dans tous les cas : comprendre la demande malgré les fautes, proposer s’il demande des idées, sinon construire, tester, publier, puis expliquer en français simple où cliquer.

---

# C. Documentation technique

## C1. Organisation du dépôt

```
/                       ← servi tel quel par GitHub Pages (NE PAS éditer à la main : généré par src/build.py)
  index.html            appli complète (CSS + JS + worklets inlinés)
  worklets.js           processeurs AudioWorklet (aussi inlinés dans index.html en secours)
  sw.js                 service worker (réseau d’abord, cache si hors ligne) — nom de cache = VER
  manifest.webmanifest, icon-*.png, apple-touch-icon.png
  Studio-fichier-unique.html   même appli en 1 fichier, utilisable en local (file://), sans PWA
  ecoute.html, lame.min.js     page publique d’écoute d’un bounce MP3, encodeur MP3
  README.md             historique des versions (côté utilisateur)
  LISEZ-MOI.txt         guide de mise en ligne GitHub Pages (pour l’utilisateur)
  PASSATION.md          ce document
/src                    ← CODE SOURCE
  template.html         squelette HTML avec marqueurs /*CSS*/ /*WORKLET*/ /*JS*/ <!--PWA-->
  style.css             tout le style (thème sombre façon Logic, responsive, tactile)
  worklets.js           AudioWorkletProcessors (rec, pitch, gate, crush, limit, verb, tunepro, bridge, cap) + saut du silence (v3.7.6)
  dsp.js                plugins d’effets (PLUGINS) + instruments (synthé, batterie) + préréglages
  engine.js             moteur audio (graphe, lecture, enregistrement, rendu offline renderMix, WAV, fondus auto, son par prise)
  ui1.js … ui16.js      interface (voir C5)
  collab.js, collab2.js sessions à plusieurs (voir C8)
  flac.js               encodeur FLAC
  ecoute.html, vendor/lame.min.js (LGPL-3.0), vendor/yjs.min.js (Yjs 13.6.33 + lib0, MIT, global `Y`)
  build.py              concatène tout → fichiers à la racine (Python 3 + Pillow)
/tests                  scripts Playwright de non-régression (voir C9) + mock_supabase.js
/bridge                 Studio Bridge (Python + pedalboard) : plugins AU/VST3 de l’ordinateur via WebSocket local (v3.5)
```


## C2. Build

`python3 src/build.py` (Python 3 + Pillow pour les icônes) :
- remplace `/*CSS*/`, `/*WORKLET*/`, `/*JS*/` et `<!--PWA-->` dans `src/template.html` ;
- écrit `index.html`, `Studio-fichier-unique.html`, `sw.js` (cache `VER`), `worklets.js`, les icônes, et copie `lame.min.js` et `ecoute.html`.

L’ordre de concaténation du JS est donné en A5. Pour publier, suivre la procédure A6.

---

## C3. Modèle de données (objet global `P`)

Tout le projet est **un objet JSON sérialisable** (sauf l’audio, stocké à part par identifiant). C’est le point central pour le multijoueur.

```js
P = {
  id, name, bpm, sig /*3|4|6*/, key /*0-11*/, scaleIdx /*index dans SCALES*/,
  tracks: [Track], auxes: [Aux /*aux1 = Bus Réverb, aux2 = Bus Délai*/],
  master: { id:'master', name, vol, pan, plugins:[Plugin] /*limiteur par défaut*/, _pre? /*copie de la sortie avant mastering (v3.8.1)*/ },
  cycle: { on, start, end },                       // en temps (beats)
  settings: { snap, latencyMs /*PAR PROJET, ne jamais imposer de valeur globale*/, countIn, metro, metroPlay, inputDev, azerty, xfade /*ms, défaut 30 (v3.8)*/ },
  lyrics /*paroles du projet (Y.Text en session)*/, cmts:[Note], marks:[{id,beat,name,color}],
  midiMap: { 'cc:<canal>:<num>': '<clé cible>' },  // MIDI Learn (clés : voir targetSet() ui1.js)
  ext: { 'ext:<id>': '<source JS du plugin externe>' }
}
Track = { id, type:'audio'|'synth'|'drums', role?:'voice'|'instru', name, color,
  vol /*dB*/, pan /*-1..1*/, mute, solo, arm, mon,
  plugins:[Plugin], sends:[dB par aux], regions:[Region],
  instr /*synth : params SYNTH_PARAMS ; drums : kit DRUM_KITS*/, preset?, kit?,
  lyrics? /*paroles de la piste*/, mine? /*nom du réglage ⭐ utilisé (v3.7.7)*/, ab? /*{cur:'A'|'B',A,B} comparaison (v3.8)*/ }
Plugin = { type /*clé de PLUGINS*/, params:{…}, byp:boolean, _master? /*nom du style si posé par le mastering 1 clic*/ }
Region audio = { id, start /*beats*/, offset /*s*/, dur /*s*/, buf /*id dans BUFS*/, name,
  gain? /*dB*/, fi?, fo? /*fondus en s*/, mute?, bpm?, key?, scale?,
  tone? /*{low,mid,pres,air} dB, son de la prise (v3.8)*/, takes?:[{buf,at,name}], take? /*prises multiples (v3.7)*/ }
Region synth = { id, start, len /*beats*/, notes:[{p /*MIDI*/, s /*beats rel.*/, l, v}], name, mute? }
Region drums = { id, start, len, pat:{ steps, rows:{ kick:[0|{v,r /*roulement 1-4*/}], '808':…, snare, clap, hat, ohat, perc, rim } }, phase?, name, mute? }
```
- Positions en **beats** (noires) ; durées audio en **secondes** (`rLen()` convertit).
- `isInstru(t)` : piste audio avec `role==='instru'` (ou ancien nom commençant par 🎵). Pas d’armement d’enregistrement sur ces pistes.
- **Audio** : `BUFS[id] = AudioBuffer` (engine.js), **immuable** : tout traitement (reverse, tempo, karaoké…) crée un **nouvel id**. `PEAKS[id]` = cache min/max par blocs de 256 échantillons.

### Persistance
- **IndexedDB** `studio` v1 : store `projects` `{id,name,updated,bpm,tracks,json}` ; store `buffers` clé = id → `{sr,ch,len,data:[Float32Array]}`. Sauvegarde auto toutes les 8 s si le JSON a changé, + à la mise en arrière-plan (`saveLocal`, ui5.js). Les buffers ne sont écrits qu’une fois (`SAVED_BUFS`).
- **Fichier `.studio`** (échange entre appareils) : `uint32 0x53545544`, `uint32 longueurJSON`, JSON `{v:1, project, buffers:[{id,sr,ch,len}]}`, padding à 4 octets, puis les Float32 de chaque canal à la suite (`saveProject`/`openProject`, ui3.js).
- **localStorage** : `studio_last` (dernier projet), `studio_seen`, `studio_ver`, `studio_fold` (sections repliées), `studio_lat` (mode audio), `studio_supa`, `studio_user`, `studio_rooms`, `studio_up`, `studio_follow`, `studio_cpanel`, `studio_layout`, `studio_ui`, `studio_screens`, `studio_colors`, `studio_mypresets` (⭐ Mes réglages, v3.7.7).
- **IndexedDB `studio_fs`** (v3.7.6) : handle du dossier d’enregistrement choisi par l’utilisateur (File System Access API).

### Undo/redo
`snapshot()` (ui1.js) pousse `JSON.stringify(P)` dans `UNDO` **avant** chaque mutation ; `undo()`/`redo()` remplacent `P` puis `afterLoad()` (reconstruit le moteur + l’UI). En session, remplacés par `Y.UndoManager` (collab.js). Depuis v3.8.1, `ui16.js` enveloppe les trois fonctions pour l’**historique lisible** (↶ ↷ 🕘, `describeChange`). L’historique ne survit pas à un rechargement de page.

---

## C4. Moteur audio (`src/engine.js`, `src/dsp.js`, `src/worklets.js`)

- **`Engine(ctx, live)`** : une instance live (`E`, AudioContext) + une instance jetable par export (OfflineAudioContext, `renderMix`).
- **Graphe par piste/aux** (`makeStrip`) : `playIn → input → [plugins…] → fader → pan(StereoPanner) → mute → analyser → master.input` ; envois post-fader vers les aux. `updateStrip(obj)` applique les paramètres ; la chaîne n’est reconstruite que si la **signature** (types + bypass) change.
- **Lecture** : ordonnanceur « lookahead » (`tick` toutes les 20 ms, 160 ms d’avance) → `scheduleWindow(a,b,t0,fresh,stopCtx,metro)` programme audio, notes et pas de batterie ; gestion du cycle par segments (`segs`) ; `pos()` donne la position affichée. `stop()` coupe via un `playIn` neuf par lecture.
- **Enregistrement** : `rec-proc` (worklet) envoie les blocs d’entrée horodatés ; `stopRec()` aligne la prise avec `outputLatency + baseLatency + latence d’entrée + réglage utilisateur`. `carve()` (ui2.js) remplace la zone ré-enregistrée.
- **Plugins pro (v2.5)** : `verbpro` → `verb-proc` (FDN 8 lignes modulées, diffusion early/late, decay à 3 bandes, 14 modes `VMODES`, couleurs 70s/80s/moderne, gate pour le mode non-linéaire) ; `tunepro` → `tunepro-proc` (YIN + TD-PSOLA à 50 ms de latence, formants/gorge, humanize, flex-tune, vibrato, notes 0=corrigée/1=ignorée/2=retirée). **Compensation de latence** : un plugin peut déclarer `latency(sr)` (secondes) ; `rebuildChain` calcule `strip.latency` et `scheduleWindow` avance tous les évènements de la piste d’autant.
- **Worklets** : `rec-proc`, `pitch-proc` (autotune : détection YIN décimée + lecture à vitesse variable avec sauts d’une période et fondu ; gamme/tonalité passées par `processorOptions` **obligatoirement** pour l’export offline), `gate-proc`, `crush-proc`, `limit-proc` (limiteur à anticipation 4 ms, plafond garanti).
- **Rendu offline (`renderMix`, v3.7.6)** : analyseurs débranchés, chaque piste coupée hors de ses zones (+ queue d’effet) sauf si elle a un effet à LFO (chorus, filtre), plugins contournés non instanciés, worklets qui sautent le silence. **Fondus enchaînés auto (v3.8)** : `autoXfades()` ; **son par prise** : `r.tone` → filtres `TONE_BANDS` par source.
- **Plugins** (`PLUGINS` dans dsp.js) : `{name, cat, params:[{id,n,min,max,def,u,log,step,opts}], create(ctx,P,env) → {input, output, set(p), dispose?, comp?, filters?}}`. Plugins externes : fichier `.js` qui appelle `registerPlugin({...})` (même interface, id préfixé `ext:`), source stockée dans `P.ext`.
- **Instruments** : `synthVoice()` (2 osc + sub + filtre + ADSR + glide mono pour la 808) et `drumHit()` (8 sons synthétisés). Presets : `SYNTH_PRESETS`, `DRUM_KITS`.
- **Analyse / traitements** (ui6.js) : `detectBPM` (flux d’attaques + autocorrélation), `detectKey` (chroma FFT + profils Krumhansl), `wsola` (time-stretch), `resample`, `karaoke` (side + mid < 180 Hz).

---

## C5. Interface (`src/ui1.js` … `ui16.js`)

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
| **ui6.js** | Version (`APP_VERSION`) + nouveautés (`showChangelog`), réglages rapides (`QUICK`), atelier instru (`regionTools`, `processRegion`), analyses, navigation Logic (copier/coller, zoom, fit, nudge, mute région), modale des raccourcis. |
| **ui10.js** | v3.6 — défilement auto, suivi en lecture, roue de couleurs + pipette, préréglages « Style ZZ », marqueurs dans la règle, fenêtres détachables (`detachOpen/detachClose`). |
| **ui11.js** | v3.7 — panneaux fluides (`applyLayout`, `UI`), paroles, prompteur, focus, dispositions, raccourcis panneaux, menu ⋯ (`fitTools`), notes dans la règle, prises multiples ; v3.7.2–3.7.4 : temps en « 1m25 », tête de lecture précise (`gridStep`, `snapPH`), accroche aux objets (`magnet`, `showGuide`). |
| **ui12.js** | v3.7.5 — test de latence (`runLatencyTest`, `latencyTestModal`, bouton 🎯 dans ⚙ Réglages). |
| **ui13.js** | v3.7.6 — dossier d’enregistrement (`fsPick`, `fsWrite`, `saveOut`, copie WAV des prises), ligne dans ⚙ Réglages. |
| **ui14.js** | v3.7.7 — ⭐ Mes réglages voix (`myPresets`, `grabVoice`, `putVoice`, `applyMine`, `saveMineModal`, `mineSection`). |
| **ui15.js** | v3.8 — outils voix : fondus (poignées `.fh`), `matchTakes`, `eqVisual`, `analyzeVoice`, `levelBuffer`, `cleanBuffer`, `processTakes`, A/B (`abSwitch`), mastering (`masterModal`, `applyMaster`, `MASTER_STYLES`), section « 🪄 Outils voix ». |
| **ui16.js** | v3.8.1 — historique lisible (`histSteps`, `describeChange`, `histPanel`, `confirmUndo`), `removeMaster`. |
| **collab.js / collab2.js** | Sessions à plusieurs (voir C8). |
| **flac.js** | Encodeur FLAC (envoi des sons en session). |

Principe de rendu : **pas de virtual DOM**. Les fonctions `renderAll / renderHeads / renderLanes / renderInspector / renderBottom` reconstruisent leur zone ; les interactions continues (glisser, knobs) modifient directement le style puis re-rendent au relâchement.

---

## C6. Contraintes & pièges connus (déjà résolus — ne pas les réintroduire)

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

## C7. Préférences de l’utilisateur (rappel technique ; la liste complète est en A3)

- Interface **comme Logic Pro** : mêmes réflexes de navigation (raccourcis, zoom, mixeur visible), barre du haut **compacte** (Fichier à gauche ; mixeur/piano/batterie à droite).
- **Simple** pour un débutant : préréglages en 1 clic + curseurs rapides, explications courtes en français.
- Ne rien imposer (effets ajoutés à la demande).
- Livraison par **versions** (v2.0, v2.1…) publiées directement sur GitHub, mise à jour par simple actualisation.
- Rendu visuel **net**, précis.

---

## C8. Multijoueur et historique détaillé des versions v3.0 → v3.8.2

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
- v3.8.0 : `engine.js` `autoXfades(tr,spb,p)` : deux régions audio qui se touchent (±3 ms) → A prolongée de `P.settings.xfade` ms (défaut 30) si son buffer continue, fondu de sortie sur la prolongation, fondu d’entrée de B ; sinon fondus L/2 de part et d’autre. `r.tone={low,mid,pres,air}` dB → biquads par source (`TONE_BANDS`). `ui15.js` : FFT maison (`powerSpec`), `regionSpectrum`, `loudnessOf` (blocs 400 ms, portes −70/−10) ; `matchTakes` (r.gain + r.tone, modèle = moyenne ou une prise) ; poignées `.fh` (wrap `regionEl`) ; `drawTile` dessine les fondus auto ; `levelBuffer` / `cleanBuffer` → nouveau buffer (tout le son, pas seulement la région) via `processTakes` ; `analyzeVoice` (11 bandes vs `AV_TARGET`, dynamique, sifflantes, bruit → eq/comp/deess/gate) ; `eqVisual` remplace le canvas de la fenêtre EQ (points draggables, molette = Q, analyseur 8192 sur `strip.fader`) ; A/B `t.ab={cur,A,B}` (Maj+B) ; `masterModal`/`applyMaster` (plugins `_master`, 2 rendus pour caler le gain du limiteur sur la cible) ; section « 🪄 Outils voix » + entrées dans le menu clic droit région (wrap `menu`). Tests : `tests/t22.py`.
- v3.8.1 : `ui16.js` historique : wrap `snapshot/undo/redo` ; hors session, étapes = `UNDO` (JSON) + heures `UTIMES` ; en session, copies `CH`/`CR` à côté du `Y.UndoManager`. `describeChange(A,B)` décrit l’écart entre deux états en français (mastering, pistes, effets, régions, tempo…). Boutons `#bUndo #bRedo #bHist` après `#bInsp`, `confirmUndo(n)` liste ce qui sera annulé. `removeMaster()` retire les plugins `_master` et restaure `P.master._pre` (copie de la sortie avant mastering, posée par wrap d’`applyMaster`), sinon limiteur par défaut. L’historique ne survit pas au rechargement (comme avant). Tests : `tests/t23.py`.
- v3.8.2 : `describeChange` lit `P.marks` / `P.cmts` (au lieu de noms erronés) pour décrire marqueurs et notes.
- v3.7.4 : accroche aux objets pour les régions (`edgeCands`/`magnet`/`showGuide` dans ui1, branchés dans `lanesPointer` d’ui2 pour déplacer et rogner) : tolérance 10 px, priorité sur la grille, ligne `.sguide` + losange `.sgdot` sur la piste cible ; Maj = désactivé.
- v3.7.3 : `snapB` (ui1) utilise `gridStep()` : le pas du magnétisme est divisé par 2 tant qu’il fait ≥ 24 px à l’écran (zoom extrême = libre). `snapPH(b,e)` pour la tête de lecture (règle, glisser la ligne) : aimant 8 px sur débuts/fins de régions, marqueurs, cycle, 0 ; Alt = libre.
- v3.7.2 : l’utilisateur ne comprend pas « mesure · temps » : positions en minutes/secondes (« 1m25 », `fmtMS`/`fmtBar` dans collab2.js), compteur `#lcdTime` en premier et toujours visible. La barre compacte (`body.cp-tight`) ne s’active que si l’appli devient étroite (panneau ouvert et moins de 1400 px restants) et cache alors `.cell.pos` (mesure), jamais les minutes. Repères de paroles `[1m25]` / `[1:25]` (les `[5]` = mesure 5 restent acceptés).
- v3.7.1 : paroles à droite par défaut (comme Logic) ; `studio_ui.v2` force une fois le passage à droite pour ceux qui avaient l’ancienne valeur.

### Prochaines étapes possibles (multijoueur)
- Curseurs/sélections des autres, notifications, plugins externes partagés avec confirmation, appel vocal (WebRTC + TURN).
- Comptes, droits (lecture seule / édition), liste des salles, sécurité Supabase plus stricte.

### (Plan initial, non suivi) Refactor store avant le réseau — conservé pour mémoire
Aujourd’hui l’UI **mute `P` directement** puis appelle `snapshot()` / `E.updateStrip()` / `renderX()`. Pour le multijoueur :
1. Créer une **couche de store** : toutes les mutations passent par des fonctions (`store.setTrackVol(id,v)`, `store.moveRegion(id,start,trackId)`…) qui écrivent dans le `Y.Doc` (dans une transaction).
2. **Observer** le `Y.Doc` (`observeDeep`) → reconstruire/mettre à jour `P` (ou lire directement le Y.Doc) → `E.updateStrip` / rendu ciblé de la zone touchée.
3. Remplacer `UNDO/REDO` JSON par `Y.UndoManager` (origine = utilisateur local).
4. Les interactions continues (glisser une région, tourner un knob) : écrire en direct (léger) ou à fréquence limitée (~20/s), et valider au relâchement.
5. Garder IndexedDB (`y-indexeddb`) pour le hors-ligne.

### Plan par versions (historique, réalisé autrement : voir les sections ✅ ci-dessus)
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

## C9. Tests

Scripts Playwright Python dans `/tests` : Chrome headless, micro simulé via `--use-fake-device-for-media-stream`. Ils supposent l’appli servie en local (voir A7) :
```bash
python3 src/build.py
python3 -m http.server 8765                                          # depuis la racine du dépôt
WS_MODULE=/opt/npm-tools/node_modules/ws node tests/mock_supabase.js 8790   # faux Supabase (Realtime, REST, Storage)
```
| Test | Ce qu’il vérifie |
|---|---|
| `t6.py` | PWA : service worker, hors ligne, sauvegarde, tactile |
| `t7.py` | instru : BPM/tonalité, time-stretch, transposition, karaoké, préréglages, réglages rapides |
| `t9.py` | raccourcis : piste dupliquer/supprimer/annuler, zoom, sélection rectangle, couper/copier/coller |
| `t10.py` | barre du haut sans débordement, piste instru dédiée, zoom HD |
| `t12.py` | déplacement de la tête de lecture pendant la lecture |
| `t13.py` | v3.0 : session à 2 fenêtres, cadenas, undo par personne, sons (faux Supabase) |
| `t14.py` | v3.0 : arrivées simultanées, actions aléatoires, rechargement (faux Supabase) |
| `t15.py` | v3.1 : Pitch Pro (justesse, latence compensée), Réverb Pro |
| `t16.py` | v3.2 : 2 appareils via le serveur, sons, coupure réseau, salle retrouvée |
| `t17.py` | v3.3 : FLAC découpé, écouter ensemble, chat, commentaires, versions, écoute seule, bounce MP3 (`LIMIT=400000` pour le faux serveur). **Attention** : le numéro t17 a aussi servi à un ancien test d’import Logic (v3.4, `tests/fixtures_logic`). |
| `t18.py` | v3.6 : défilement auto, couleurs, ZZ, marqueurs, notes, vocaux, panneau, fenêtres détachées (l’ancien t18 du pont Bridge utilisait `tests/bridge_mock`) |
| `t19.py` | v3.7 : paroles, panneaux, dispositions, focus, notes par piste, prompteur, prises multiples |
| `t20.py` | v3.7.6 : export rapide identique au bit près (avec chorus), MP3, stems, ligne « Dossier d’enregistrement » |
| `t21.py` | v3.7.7 : ⭐ Mes réglages (enregistrer, appliquer à toutes les voix, gardé après rechargement) |
| `t22.py` | v3.8 : outils voix (fondus auto, égaliser, nettoyage, volume régulier, assistant, EQ visuel, A/B, mastering) |
| `t23.py` | v3.8.1 : historique lisible, confirmation, retrait du mastering |

Les scripts affichent des valeurs à lire. Certains « False » sont attendus : comparer à l’exécution précédente, et regarder les captures dans `/home/claude/test/`. Il n’y a pas d’assertion automatique partout. Les chemins (`/usr/bin/google-chrome`, `/home/claude/test`) sont à adapter à la machine.

Mesures de référence :
- autotune : note juste à ±0,5 Hz ;
- limiteur : distorsion ≈ −69 dB, crête ≤ plafond ;
- BPM 142 et Fa# mineur détectés sur un beat de test ;
- export 3,5 min / 5 voix : ~38 s (au lieu de 88 s) ;
- nettoyage : voix inchangée (0,00 dB), respirations −12 dB, bruit −20 dB.

---

## C10. Idées en attente (proposées à l’utilisateur, pas encore construites)

- Automation (volume et effets qui évoluent dans le temps).
- Sampler / pads, banque de sons plus riche.
- Enregistrement MIDI, accordeur.
- Session : curseurs des autres, appel vocal, comptes et droits.

Déjà construits (ne pas re-proposer) : comping (v3.7), mastering 1 clic (v3.8), égaliseur visuel, assistant voix, A/B, nettoyage, volume régulier, égaliser les prises, fondus enchaînés (v3.8), historique lisible (v3.8.1).

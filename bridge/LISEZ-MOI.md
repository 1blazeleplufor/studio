# 🔌 Studio Bridge

Petit programme qui permet à **Studio** d'utiliser les plugins **AU / VST3** installés sur votre ordinateur
(Waves, FabFilter, Antares, Valhalla, Soundtoys…) : il les trouve, ouvre **leur fenêtre d'origine**
et traite le son des pistes en temps réel. Tout reste sur votre ordinateur (rien n'est envoyé sur internet).

## Installation (une seule fois)

### Mac
1. Installez **Python 3** : https://www.python.org/downloads/ → bouton jaune « Download Python », puis ouvrez le fichier téléchargé et suivez l'installation.
2. Téléchargez Studio : https://github.com/1blazeleplufor/studio/archive/refs/heads/main.zip et décompressez-le.
3. Dans le dossier **bridge**, double-cliquez sur **`Lancer Studio Bridge.command`**.
   - Si le Mac dit qu'il ne peut pas l'ouvrir : **clic droit** sur le fichier → **Ouvrir** → **Ouvrir**.
   - Si rien ne se passe : ouvrez l'app **Terminal**, tapez `bash ` (avec un espace), glissez le fichier dans la fenêtre, puis Entrée.
4. La première fois, il installe ce qu'il faut (1 à 2 minutes, connexion internet nécessaire), puis scanne vos plugins.

### Windows
1. Installez **Python 3** depuis https://www.python.org/downloads/ en cochant **« Add python.exe to PATH »**.
2. Téléchargez et décompressez Studio (lien ci-dessus).
3. Dans le dossier **bridge**, double-cliquez sur **`Lancer Studio Bridge (Windows).bat`**.

## Utilisation
- Laissez la fenêtre noire de Studio Bridge **ouverte** pendant que vous utilisez Studio.
- Dans Studio : touche **Y** ou bouton **🔌** → **Bibliothèque** → section « Sur cet ordinateur ».
- Cliquez sur un plugin : il s'ajoute sur la piste choisie (« Insérer sur ») et sa fenêtre s'ouvre.
  La fenêtre peut apparaître **derrière le navigateur** : regardez dans le Dock / la barre des tâches.
- Réglez le plugin dans sa fenêtre : ses réglages sont **mémorisés dans le projet** quand vous la fermez
  (ou avec le bouton 💾 Mémoriser dans Studio).
- Nouveau plugin installé ? Bouton 🔄 dans la Bibliothèque pour rescanner.

## Bon à savoir
- **Chrome** peut demander l'autorisation d'accéder aux appareils du réseau local : cliquez **Autoriser**.
- **Safari** bloque parfois la connexion depuis le site : ouvrez alors Studio à l'adresse **http://localhost:47123**
  (servie par Studio Bridge). Les projets de cette adresse sont séparés de ceux du site : utilisez
  ☰ Fichier → Exporter / Importer le projet pour passer de l'un à l'autre.
- Le son passe par Studio Bridge avec un petit décalage (85 ms par défaut), **compensé automatiquement** à la lecture.
  En cas de craquements, choisissez « Sûre (8192) » en bas de la Bibliothèque.
- Une seule fenêtre de plugin peut être ouverte à la fois.
- L'export d'un projet qui utilise ces plugins se fait **en temps réel** (le morceau est joué pendant l'export).
- Les **instruments** (synthés, samplers) de l'ordinateur ne sont pas encore pris en charge : seulement les effets.
- Sur un autre appareil sans ces plugins, la piste joue simplement sans l'effet.

## Technique
- Python 3.8+, bibliothèque [pedalboard](https://github.com/spotify/pedalboard) (Spotify, GPLv3) + numpy.
- Écoute uniquement sur `127.0.0.1:47123` ; n'accepte que les pages de Studio (liste d'origines dans le script,
  ajout possible via la variable d'environnement `STUDIO_BRIDGE_ORIGINS`).
- Cache du scan : `~/.studio_bridge/plugins.json`. Dossiers supplémentaires : variable `STUDIO_BRIDGE_DIRS`.

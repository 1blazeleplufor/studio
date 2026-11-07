#!/bin/bash
# Studio Bridge — lanceur Mac (double-clic). La première fois, installe pedalboard dans un dossier .venv.
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 n'est pas installé."
  echo "Installez-le depuis https://www.python.org/downloads/ (bouton jaune « Download Python »), puis relancez ce fichier."
  read -p "Appuyez sur Entrée pour fermer…"; exit 1
fi
if [ ! -x .venv/bin/python ]; then
  echo "Première installation de Studio Bridge (1 à 2 minutes)…"
  python3 -m venv .venv && ./.venv/bin/python -m pip install --upgrade pip && ./.venv/bin/python -m pip install -r requirements.txt
  if [ $? -ne 0 ]; then echo "L'installation a échoué (connexion internet ?)."; rm -rf .venv; read -p "Entrée pour fermer…"; exit 1; fi
fi
./.venv/bin/python studio_bridge.py
read -p "Studio Bridge s'est arrêté. Entrée pour fermer…"

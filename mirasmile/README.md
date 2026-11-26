# MiraSmile

Appli Android : la caméra selfie s'affiche, l'appli te demande de sourire et prend la photo toute seule dès que tu souris.

## Installer sur le téléphone (Samsung S22)

1. Sur le téléphone, ouvre https://github.com/timoloutfi-sys/POC-RoadBook/releases/download/mirasmile-latest/MiraSmile.apk
2. Ouvre le fichier téléchargé. Android demande d'autoriser l'installation depuis le navigateur : accepte (Réglages > Autoriser cette source).
3. Lance MiraSmile et autorise l'appareil photo.

Les photos vont dans la Galerie, album **MiraSmile** (`Pictures/MiraSmile`).

## Fonctionnement

- Détection du visage et du sourire par ML Kit, modèle embarqué : marche sans réseau.
- La photo part quand le sourire tient 0,3 s. Pour en prendre une autre, reprends un air neutre puis souris à nouveau (pas de rafale).
- Jauge de sourire, éclair blanc, bruit d'obturateur et vibration au déclenchement, vignette de la dernière photo (la toucher l'ouvre dans la Galerie).
- Bouton rond en bas : photo à la main.
- Photo enregistrée en miroir, comme on se voit à l'écran.

## Développement

Kotlin, CameraX, ML Kit. Chaque push qui touche `mirasmile/` compile l'APK (`.github/workflows/mirasmile.yml`), lance les tests (`SmileTrigger`) et remplace l'APK de la release `mirasmile-latest`. La clé de signature `app/mirasmile.keystore` est fixe pour que les nouvelles versions s'installent par-dessus l'ancienne.

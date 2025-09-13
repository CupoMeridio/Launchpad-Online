const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Definisci le directory
const baseDir = __dirname;
const videosDir = path.join(baseDir, 'assets', 'videos');
const skinsDir = path.join(baseDir, 'assets', 'images', 'launchpad covers');

// Endpoint API per ottenere i video
app.get('/api/videos', (req, res) => {
    fs.readdir(videosDir, (err, files) => {
        if (err) {
            console.error("Could not list the directory.", err);
            res.status(500).send('Internal Server Error');
            return;
        }
        const videoFiles = files.filter(file => file.endsWith('.mp4'));
        res.json(videoFiles);
    });
});

// Endpoint API per ottenere le skin
app.get('/api/skins', (req, res) => {
    fs.readdir(skinsDir, (err, files) => {
        if (err) {
            console.error("Could not list the directory.", err);
            res.status(500).send('Internal Server Error');
            return;
        }
        const skinFiles = files.filter(file => file.endsWith('.png'));
        res.json(skinFiles);
    });
});

// Servi i file statici dalla directory principale
app.use(express.static(baseDir));

// Avvia il server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
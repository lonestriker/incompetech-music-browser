# Incompetech Music Browser

A web-based application for browsing, searching, and listening to Kevin MacLeod's royalty-free music collection from [Incompetech](https://incompetech.com/).

![Incompetech Music Browser Screenshot](screenshot.png)

## Features

- **Advanced Search Filters**: Find music by genre, instruments, feel, description, title, BPM range, and duration
- **Dual-Mode Operation**: Switch between local file playback and remote streaming
- **Instant Playback**: Listen to tracks directly in the browser
- **Sortable Results**: Sort results by title, genre, BPM, or track length
- **Download Support**: Direct links to download tracks
- **Responsive Design**: Works on desktop and mobile devices

## Use GitHub Pages Hosted App

Go to https://lonestriker.github.io/incompetech-music-browser

## Setup for Local Files

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/incompetech-music-browser.git
   cd incompetech-music-browser
   ```

2. The application requires a SQLite database of Incompetech songs. You can either:
   - Use an existing database file named `incompetech_songs.db` in the root directory
   - Create your own database with the schema matching what the app expects

3. For local music mode:
   - Create a `music` folder in the root directory
   - Place MP3 files in this folder (purchae the full set of MP3 files at [Incompetech](https://incompetech.com/music/royalty-free/Downloads/allthemusic.html))

4. Serve the application using any web server:
   ```
   # Using Python's built-in server
   python -m http.server
   
   # Or using npm's http-server
   npx http-server
   ```

5. Visit `http://localhost:8000` (or whatever port your server uses) in your browser

## Usage

1. **Search for Music**:
   - Select one or more genres from the dropdown
   - Choose instruments from the multi-select box
   - Enter keywords for feel, description, or title
   - Specify BPM range and/or track length if needed
   - Click "Find Songs" to search

2. **Listen to Music**:
   - Click the play button next to any track to start playback
   - Use the audio player controls at the bottom of the page to adjust volume, seek, etc.
   - Click a playing track again to pause

3. **Download Tracks**:
   - Click on a track title to download the MP3 file

4. **Random Playback**:
   - Click "Play Random" to randomly select and play a track from the current search results

## Modes

The application has two operating modes:

- **Remote Streaming Mode** (default): Streams music directly from Incompetech's servers
- **Local Files Mode**: Plays music from your local `music/` folder (useful for offline usage)

Toggle between modes using the switch in the top-right corner.

## Credits

- All music is by Kevin MacLeod ([Incompetech.com](https://incompetech.com/))
- Licensed under [Creative Commons: By Attribution 3.0](http://creativecommons.org/licenses/by/3.0/)
- This browser application is not affiliated with Incompetech or Kevin MacLeod

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

Please respect the licensing terms for Incompetech music. Per Kevin MacLeod's requirements, you must provide attribution when using his music in your projects. See the [Incompetech FAQ](https://incompetech.com/music/royalty-free/faq.html) for details.

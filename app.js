// --- Global Constants ---
const DB_FILENAME = 'incompetech_songs.db'; // Local DB file
const WASM_URL = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.wasm'; // CDN WASM file
const LOCAL_MUSIC_DIR_PATH = 'music/'; // Relative path for local mode
const REMOTE_MP3_BASE_URL = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/'; // Base URL for remote mode

// --- DOM Element Variables (declared globally, assigned in fetchAndVerifyDOMElements) ---
let loadingIndicator, errorIndicator, mainContent, searchForm, genreSelect,
    instrumentsSelect, feelInput, descriptionInput, titleInput, usuanInput,
    minBpmInput, maxBpmInput, minLengthInput, maxLengthInput, findButton,
    clearButton, randomButton, resultsBody, resultsCount, resultsTable,
    audioPlayer, nowPlayingDisplay, modeToggle, modeLabel;

// --- Global State ---
let db = null;
let currentlyPlayingButton = null;
let currentSort = { column: null, direction: 'asc' };
let lastSearchResults = [];
let currentObjectUrl = null;
let isLoadingAudio = false;
let isLocalMode = false; // <<< SET YOUR DESIRED DEFAULT HERE (e.g., false for remote)

// --- Helper Functions ---
function mmssToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
    try {
        const [minutes, seconds] = timeStr.split(':').map(Number);
        if (isNaN(minutes) || isNaN(seconds)) return null;
        return (minutes * 60) + seconds;
    } catch (e) {
        console.warn(`Time parse error: ${timeStr}`, e);
        return null;
    }
}

function formatTime(seconds) {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return 'N/A';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

function setPlayIcon(button) {
    if (button?.querySelector) {
        button.querySelector('.play-icon')?.classList.remove('hidden');
        button.querySelector('.stop-icon')?.classList.add('hidden');
    }
}

function setStopIcon(button) {
    if (button?.querySelector) {
        button.querySelector('.play-icon')?.classList.add('hidden');
        button.querySelector('.stop-icon')?.classList.remove('hidden');
    }
}

function enableForm() {
    if (searchForm) searchForm.querySelectorAll('input, select, button').forEach(el => el.disabled = false);
    else console.warn("enableForm called before searchForm was assigned.");
}

function disableForm() {
    if (searchForm) searchForm.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
    else console.warn("disableForm called before searchForm was assigned.");
}

function displayError(message) {
    console.error("Displaying Error:", message);
    if (errorIndicator) {
        errorIndicator.textContent = `Error: ${message}`;
        errorIndicator.style.display = 'block';
    }
     if (loadingIndicator) { // Hide loading indicator when showing error
        loadingIndicator.style.display = 'none';
     }
}

function updateModeLabel() {
    if (modeLabel) modeLabel.textContent = `Mode: ${isLocalMode ? 'Local Files' : 'Remote Stream'}`;
}

function stopAndClearPlayer() {
    if (currentlyPlayingButton) {
        setPlayIcon(currentlyPlayingButton);
        currentlyPlayingButton = null;
    }
    if (currentObjectUrl) { // Revoke blob URL if in local mode
        console.log("Revoking object URL:", currentObjectUrl)
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
    }
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.removeAttribute('src'); // Remove src completely
        try {
            audioPlayer.load(); // Force reload with no source
        } catch (e) {
            console.warn("Minor error during player load() after src removal:", e);
        }
    }
    if (nowPlayingDisplay) {
        nowPlayingDisplay.textContent = "No song selected";
        nowPlayingDisplay.title = "No song selected";
    }
    isLoadingAudio = false;
}

// --- Fetch DOM Elements and Verify ---
function fetchAndVerifyDOMElements() {
    console.log("Fetching DOM elements...");
    loadingIndicator = document.getElementById('loading-indicator');
    errorIndicator = document.getElementById('error-indicator');
    mainContent = document.getElementById('main-content');
    searchForm = document.getElementById('search-form');
    genreSelect = document.getElementById('genre');
    instrumentsSelect = document.getElementById('instruments');
    feelInput = document.getElementById('feel');
    descriptionInput = document.getElementById('description');
    titleInput = document.getElementById('title');
    usuanInput = document.getElementById('usuan');
    minBpmInput = document.getElementById('min_bpm');
    maxBpmInput = document.getElementById('max_bpm');
    minLengthInput = document.getElementById('min_length');
    maxLengthInput = document.getElementById('max_length');
    findButton = document.getElementById('find-button');
    clearButton = document.getElementById('clear-button');
    randomButton = document.getElementById('random-button');
    resultsBody = document.getElementById('results-body');
    resultsCount = document.getElementById('results-count');
    resultsTable = document.getElementById('results-table');
    audioPlayer = document.getElementById('audio-player');
    nowPlayingDisplay = document.getElementById('now-playing');
    modeToggle = document.getElementById('mode-toggle');
    modeLabel = document.getElementById('mode-label');

    const elements = { loadingIndicator, errorIndicator, mainContent, searchForm, genreSelect, instrumentsSelect, feelInput, descriptionInput, titleInput, usuanInput, minBpmInput, maxBpmInput, minLengthInput, maxLengthInput, findButton, clearButton, randomButton, resultsBody, resultsCount, resultsTable, audioPlayer, nowPlayingDisplay, modeToggle, modeLabel };

    for (const [name, element] of Object.entries(elements)) {
        if (!element) {
            console.error(`CRITICAL: HTML element missing (variable: '${name}')! Check ID in index.html.`);
            alert(`Critical page error: Required element '${name}' missing. Cannot initialize.`);
            return false; // Indicate failure
        }
    }
    console.log("All essential DOM elements found and assigned.");
    return true; // Indicate success
}


// --- Database Initialization ---
async function initializeDatabase() {
    // Assumes elements are assigned by fetchAndVerifyDOMElements called by startApp
    loadingIndicator.style.display = 'block';
    errorIndicator.style.display = 'none';
    disableForm(); // Disable form controls while loading

    if (typeof window.initSqlJs === 'undefined') {
        console.error("FATAL: initSqlJs function not found. Ensure sql-wasm.js loaded correctly.");
        displayError("Failed to load core database library (initSqlJs).");
        loadingIndicator.style.display = 'none';
        return;
    }

    try {
        console.log("Initializing sql.js...");
        const SQL = await initSqlJs({ locateFile: file => WASM_URL });
        console.log("sql.js initialized.");

        console.log(`Fetching database file: ${DB_FILENAME}...`);
        const response = await fetch(DB_FILENAME);
        if (!response.ok) {
            throw new Error(`HTTP error fetching database '${DB_FILENAME}': ${response.status} ${response.statusText}`);
        }
        const dbBuffer = await response.arrayBuffer();
        console.log(`Database file fetched (${(dbBuffer.byteLength / 1024 / 1024).toFixed(2)} MB).`);

        db = new SQL.Database(new Uint8Array(dbBuffer));
        console.log("Database loaded into memory.");

        // Test connection/table existence
        const testResult = db.exec("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='songs'");
         if (!testResult || testResult.length === 0 || !testResult[0].values || testResult[0].values.length === 0 || testResult[0].values[0][0] !== 1) {
             db.close(); // Close DB if table not found
             throw new Error("Table 'songs' not found in the loaded database file.");
         }
        console.log("Table 'songs' found.");

        // Set initial UI State that depends on elements existing
        audioPlayer.volume = 0.4;
        modeToggle.checked = !isLocalMode; // Set checkbox based on initial JS state
        updateModeLabel(); // Update label to match

        // Populate dropdowns now that DB is ready
        await populateDropdowns();

        // Attach all event listeners now that elements and DB are ready
        attachEventListeners();

        // Show main content and enable form
        mainContent.classList.remove('hidden');
        enableForm(); // Enable form controls

        loadingIndicator.style.display = 'none'; // Revert to this
        console.log("Loading indicator hidden via style.display='none'."); // Updated log

        console.log("Database loaded and UI enabled.");
    } catch (error) {
        console.error("Database Initialization Error:", error);
        displayError(`Failed to load database '${DB_FILENAME}'. ${error.message}. Check console/network tab.`);
        loadingIndicator.style.display = 'none';
        if (db) db.close(); // Ensure DB connection is closed on error
        // Keep form disabled
    }
}

// --- UI Population ---
async function populateDropdowns() {
    if (!db) return;
    console.log("Populating dropdowns...");
    try {
        const genreResults = db.exec("SELECT DISTINCT genre FROM songs WHERE genre IS NOT NULL AND genre != '' ORDER BY genre COLLATE NOCASE");
        genreSelect.innerHTML = ''; // Clear loading/error text
        if (genreResults.length > 0 && genreResults[0].values) { genreResults[0].values.forEach(row => { const o=document.createElement('option'); o.value=row[0]; o.textContent=row[0]; genreSelect.appendChild(o); }); console.log(`Populated ${genreResults[0].values.length} genres.`);} else { genreSelect.innerHTML = '<option value="">No genres found</option>'; console.log("No genres found."); }

        const instrumentResults = db.exec("SELECT instruments FROM songs WHERE instruments IS NOT NULL AND instruments != ''");
        const instrumentCounts = new Map();
        if (instrumentResults.length > 0 && instrumentResults[0].values) { instrumentResults[0].values.forEach(row => { const iS = row[0] || ''; iS.split(',').map(i => i.trim().toLowerCase()).filter(i => i).forEach(i => { instrumentCounts.set(i, (instrumentCounts.get(i) || 0) + 1); }); }); }
        const sortedInstruments = Array.from(instrumentCounts.keys()).sort();
        instrumentsSelect.innerHTML = ''; // Clear loading/error text
        if (sortedInstruments.length > 0) { sortedInstruments.forEach(inst => { const o=document.createElement('option'); o.value = inst; o.textContent = inst.charAt(0).toUpperCase() + inst.slice(1); instrumentsSelect.appendChild(o); }); console.log(`Populated ${sortedInstruments.length} instruments.`);} else { instrumentsSelect.innerHTML = '<option value="">No instruments found</option>'; console.log("No instruments found."); }
    } catch (error) { console.error("Err populating dropdowns:", error); displayError("Could not load filter options."); genreSelect.disabled = true; instrumentsSelect.disabled = true; }
}

// --- Search Logic ---
async function handleSearch() {
    if (!db) { displayError("Database not loaded."); return []; }
    console.log("Performing search...");
    resultsBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">Searching...</td></tr>'; resultsCount.textContent = '(...)';
    disableForm(); // Disable form during search

    const searchParams = {
        genre: Array.from(genreSelect.selectedOptions).map(o => o.value),
        instruments: Array.from(instrumentsSelect.selectedOptions).map(o => o.value),
        feel: (feelInput.value || '').trim(),
        description: (descriptionInput.value || '').trim(),
        title: (titleInput.value || '').trim(),
        usuan: (usuanInput.value || '').trim(),
        min_bpm: minBpmInput.value || '',
        max_bpm: maxBpmInput.value || '',
        min_length: minLengthInput.value || '',
        max_length: maxLengthInput.value || '',
    };
    console.log("Directly Retrieved searchParams:", JSON.stringify(searchParams, null, 2));

    let sql = ` SELECT usuan, title, instruments, feel, description, bpm, genre, length, mp3_filename FROM songs WHERE 1=1 `;
    const params = {}; let paramIndex = 1; function addParam(value) { const key = `$p${paramIndex++}`; params[key] = value; return key; }

    // Build WHERE conditions
    if (searchParams.usuan) { sql += ` AND usuan = ${addParam(searchParams.usuan)}`; }
    if (searchParams.title) { sql += ` AND lower(title) LIKE ${addParam('%' + searchParams.title.toLowerCase() + '%')}`; }
    if (searchParams.genre && searchParams.genre.length > 0) { sql += ` AND lower(genre) IN (${searchParams.genre.map(g => addParam(g.toLowerCase())).join(',')})`; }
    if (searchParams.instruments && searchParams.instruments.length > 0) { sql += ` AND (`; sql += searchParams.instruments.map(inst => `lower(instruments) LIKE ${addParam('%' + inst.toLowerCase() + '%')}`).join(' OR '); sql += `)`; }
    if (searchParams.feel) { searchParams.feel.split(/[,\s]+/).filter(k => k).forEach(keyword => { sql += ` AND lower(feel) LIKE ${addParam('%' + keyword.toLowerCase() + '%')}`; }); }
    if (searchParams.description) { searchParams.description.split(/[,\s]+/).filter(k => k).forEach(keyword => { sql += ` AND lower(description) LIKE ${addParam('%' + keyword.toLowerCase() + '%')}`; }); }
    if (searchParams.min_bpm) { const minBpm = parseInt(searchParams.min_bpm, 10); if (!isNaN(minBpm)) { sql += ` AND bpm >= ${addParam(minBpm)}`; } }
    if (searchParams.max_bpm) { const maxBpm = parseInt(searchParams.max_bpm, 10); if (!isNaN(maxBpm)) { sql += ` AND bpm <= ${addParam(maxBpm)}`; } }

    const minLenSec = mmssToSeconds(searchParams.min_length);
    const maxLenSec = mmssToSeconds(searchParams.max_length);
    sql += ` ORDER BY title COLLATE NOCASE`;

    console.log("SQL:", sql); console.log("Params:", params);

    let songs = [];
    try {
        const results = db.exec(sql, params); // sql.js exec is synchronous after DB load
        if (results && results.length > 0 && results[0].values) { const cols = results[0].columns; songs = results[0].values.map(row => { const obj = {}; cols.forEach((c, i) => { obj[c] = row[i]; }); return obj; }); }
        if (minLenSec !== null || maxLenSec !== null) { songs = songs.filter(song => { const sLen = mmssToSeconds(song.length); let inc = true; if (minLenSec !== null && (sLen === null || sLen < minLenSec)) inc = false; if (maxLenSec !== null && (sLen === null || sLen > maxLenSec)) inc = false; return inc; }); }
        lastSearchResults = songs;
        renderResults(songs); // Render results now includes download links
    } catch (error) { console.error("Search Query Error:", error); displayError("Search query failed."); resultsBody.innerHTML = '<tr><td colspan="7" class="text-center text-red-500 py-4">Search failed.</td></tr>'; resultsCount.textContent = '(Error)'; lastSearchResults = []; return []; }
    finally { enableForm(); } // Re-enable form
    return songs; // Return the found songs
}

// --- UI Rendering ---
function renderResults(songs) {
    resultsBody.innerHTML = '';
    resultsCount.textContent = `(${songs.length})`;
    if (songs.length === 0) { resultsBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No songs found matching your criteria.</td></tr>'; return; }
    const fragment = document.createDocumentFragment();
    songs.forEach(song => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-100 transition-colors duration-150";
        tr.title = song.description || 'No description available'; // Tooltip on row

        const filename = song.mp3_filename; // Filename from DB
        let downloadHref = '#'; // Default if no filename
        if (filename) {
            // Construct download link based on current mode
            downloadHref = isLocalMode
                         ? `${LOCAL_MUSIC_DIR_PATH}${filename}` // Relative local path (use raw filename)
                         : `${REMOTE_MP3_BASE_URL}${encodeURIComponent(filename)}`; // Encoded remote URL
        }

        // Construct Title Cell HTML with download link
        const titleHtml = filename
            ? `<a href="${downloadHref}" download="${filename}" class="text-blue-600 hover:text-blue-800 hover:underline" title="Download ${filename}">${song.title || 'N/A'}</a>`
            : (song.title || 'N/A'); // Just show title if no filename

        // Construct Play Button data attribute (still uses raw filename)
        const playButtonHtml = filename
            ? `<button class="play-button text-indigo-600 hover:text-indigo-900 focus:outline-none" data-filename="${filename}" data-title="${song.title || song.usuan}">
                   <svg class="play-icon h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   <svg class="stop-icon h-6 w-6 hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6" /></svg>
               </button>`
            : `<span class="text-gray-400" title="MP3 missing">-</span>`;

        tr.innerHTML = `
            <td class="px-4 py-2 text-center">${playButtonHtml}</td>
            <td class="px-4 py-2 text-sm font-medium text-gray-900 truncate" title="${song.title || ''}">${titleHtml}</td>
            <td class="px-4 py-2 text-sm text-gray-500 truncate" title="${song.genre || ''}">${song.genre || 'N/A'}</td>
            <td class="px-4 py-2 text-sm text-gray-500 truncate hidden md:table-cell" title="${song.feel || ''}">${song.feel || 'N/A'}</td>
            <td class="px-4 py-2 text-sm text-gray-500 truncate hidden lg:table-cell" title="${song.instruments || ''}">${song.instruments || 'N/A'}</td>
            <td class="px-4 py-2 text-sm text-gray-500 text-center">${song.bpm || 'N/A'}</td>
            <td class="px-4 py-2 text-sm text-gray-500 text-center">${song.length || 'N/A'}</td>
        `;
        fragment.appendChild(tr);
    });
    resultsBody.appendChild(fragment);
}


// --- Setup Event Listeners Function ---
function attachEventListeners() {
    console.log("Attaching event listeners...");
    searchForm.addEventListener('submit', (event) => { event.preventDefault(); handleSearch(); });
    clearButton.addEventListener('click', () => { stopAndClearPlayer(); searchForm.reset(); resultsBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">Search cleared.</td></tr>'; resultsCount.textContent = '(0)'; lastSearchResults = []; /* reset sort */ document.querySelectorAll('th.sortable-header .sort-icon').forEach(icon => icon.textContent = ''); document.querySelectorAll('th.sortable-header').forEach(th => th.classList.remove('sort-asc', 'sort-desc')); currentSort = { column: null, direction: 'asc' };});
    randomButton.addEventListener('click', async () => { if (!db) { displayError("Database not ready."); return; } const songs = await handleSearch(); const playableSongs = songs.filter(s => s.mp3_filename); if (playableSongs.length > 0) { const randomSong = playableSongs[Math.floor(Math.random() * playableSongs.length)]; const buttonSelector = `.play-button[data-filename="${CSS.escape(randomSong.mp3_filename)}"]`; const targetButton = resultsBody.querySelector(buttonSelector); if (targetButton) targetButton.click(); else { console.warn("Btn not found for random", randomSong.mp3_filename); alert(`Selected: ${randomSong.title}, but button not found.`); } } else { alert("No playable songs in current results."); }});

    // Mode Toggle Listener
    modeToggle.addEventListener('change', () => {
        isLocalMode = !modeToggle.checked;
        updateModeLabel();
        console.log(`Switched mode to: ${isLocalMode ? 'Local' : 'Remote'}`);
        stopAndClearPlayer();
        renderResults(lastSearchResults); // Re-render results immediately to update download links
    });

    // Play/Stop Button Logic
    resultsBody.addEventListener('click', async function(event) { const button = event.target.closest('.play-button'); if (button) { event.preventDefault(); const filename = button.dataset.filename; const title = button.dataset.title; if (!filename) { console.warn("Button lacks filename data"); return; } if (currentlyPlayingButton === button) { if (audioPlayer.paused) { if (!isLoadingAudio) audioPlayer.play().then(() => { setStopIcon(button); nowPlayingDisplay.textContent = `Now Playing: ${title}`; }).catch(e => console.error("Resume failed:", e)); else console.log("Ignoring play while loading."); } else { audioPlayer.pause(); setPlayIcon(button); nowPlayingDisplay.textContent = `Paused: ${title}`; } nowPlayingDisplay.title = nowPlayingDisplay.textContent; return; } setPlayIcon(currentlyPlayingButton); setStopIcon(button); nowPlayingDisplay.textContent = `Loading: ${title}...`; nowPlayingDisplay.title = `Loading: ${title}...`; currentlyPlayingButton = button; isLoadingAudio = true; errorIndicator.style.display = 'none'; stopAndClearPlayer(); let audioSourceUrl; try { if (isLocalMode) { const localFilePath = `${LOCAL_MUSIC_DIR_PATH}${filename}`; console.log(`Fetching local audio: ${localFilePath}`); const response = await fetch(localFilePath); if (!response.ok) throw new Error(`HTTP error ${response.status} fetching local`); const audioBuffer = await response.arrayBuffer(); console.log(`Fetched local ${(audioBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`); const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' }); currentObjectUrl = URL.createObjectURL(audioBlob); audioSourceUrl = currentObjectUrl; console.log("Using object URL:", audioSourceUrl); } else { audioSourceUrl = `${REMOTE_MP3_BASE_URL}${encodeURIComponent(filename)}`; console.log("Using remote URL:", audioSourceUrl); } audioPlayer.src = audioSourceUrl; audioPlayer.load(); await audioPlayer.play(); console.log(`Playback started (${isLocalMode ? 'Local' : 'Remote'}).`); nowPlayingDisplay.textContent = `Now Playing: ${title}`; nowPlayingDisplay.title = nowPlayingDisplay.textContent; isLoadingAudio = false; } catch (error) { console.error("Error loading/playing audio:", error); displayError(`Cannot load/play ${title}. ${error.message}`); setPlayIcon(button); nowPlayingDisplay.textContent = `Error: ${title}`; nowPlayingDisplay.title = `Error: ${title}`; if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; } audioPlayer.src = ""; currentlyPlayingButton = null; isLoadingAudio = false; } } });

    // Player Event Listeners
    audioPlayer.addEventListener('ended', () => { const finishedTitle = nowPlayingDisplay.textContent.replace(/^(Now Playing:|Paused:|Error.*?:|Finished:)\s*/, ''); nowPlayingDisplay.textContent = `Finished: ${finishedTitle}`; setPlayIcon(currentlyPlayingButton); if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; } currentlyPlayingButton = null; isLoadingAudio = false; });
    audioPlayer.addEventListener('play', () => { if (currentlyPlayingButton && !isLoadingAudio) { setStopIcon(currentlyPlayingButton); const title = currentlyPlayingButton.dataset.title; if (!nowPlayingDisplay.textContent.startsWith('Now Playing:')) nowPlayingDisplay.textContent = `Now Playing: ${title}`; } });
    audioPlayer.addEventListener('error', (e) => { if (!isLoadingAudio) { console.error('Audio Error:', audioPlayer.error); let title = nowPlayingDisplay.textContent.replace(/^(Now Playing:|Paused:|Error.*?:|Finished:|Loading:)\s*/, ''); nowPlayingDisplay.textContent = `Error: ${title}`; if (audioPlayer.currentSrc || title !== "No song selected") displayError(`Error playing ${title}. Code: ${audioPlayer.error?.code}.`); setPlayIcon(currentlyPlayingButton); if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; } currentlyPlayingButton = null; } else { console.warn("Ignoring audio error during loading."); } isLoadingAudio = false; });

    // Table Sorting Logic
    const sortableHeaders = resultsTable.querySelectorAll('th.sortable-header'); const getCellValue = (row, cellIndex) => row.cells[cellIndex]?.textContent?.trim() || ''; const lengthToSecondsSort = (timeStr) => mmssToSeconds(timeStr) ?? 0; sortableHeaders.forEach(header => { header.addEventListener('click', () => { if (lastSearchResults.length === 0) return; const columnIndex = parseInt(header.dataset.sortColumn, 10); const sortType = header.dataset.sortType; const isCurrentlySorted = header.classList.contains('sort-asc') || header.classList.contains('sort-desc'); const isAscending = header.classList.contains('sort-asc'); const newDirection = isCurrentlySorted && isAscending ? 'desc' : 'asc'; sortableHeaders.forEach(h => { if (h !== header) { h.classList.remove('sort-asc', 'sort-desc'); h.querySelector('.sort-icon').textContent = ''; } }); header.classList.remove('sort-asc', 'sort-desc'); header.classList.add(newDirection === 'asc' ? 'sort-asc' : 'sort-desc'); header.querySelector('.sort-icon').textContent = newDirection === 'asc' ? '▲' : '▼'; lastSearchResults.sort((songA, songB) => { let valA, valB; switch (columnIndex) { case 1: valA = songA.title || ''; valB = songB.title || ''; break; case 2: valA = songA.genre || ''; valB = songB.genre || ''; break; case 5: valA = songA.bpm || 0; valB = songB.bpm || 0; break; case 6: valA = songA.length || ''; valB = songB.length || ''; break; default: return 0; } if (sortType === 'number') { valA = parseFloat(valA) || 0; valB = parseFloat(valB) || 0; } else if (sortType === 'length') { valA = lengthToSecondsSort(valA); valB = lengthToSecondsSort(valB); } let comparison = 0; if (sortType === 'string') { comparison = valA.localeCompare(valB, undefined, { sensitivity: 'base', numeric: true }); } else { if (valA < valB) comparison = -1; if (valA > valB) comparison = 1; } return newDirection === 'asc' ? comparison : (comparison * -1); }); renderResults(lastSearchResults); currentSort = { column: columnIndex, direction: newDirection }; }); });

    console.log("Event listeners attached.");
} // End of attachEventListeners


// --- Main App Logic Function ---
function startApp() {
    console.log("App Started after window load.");

    // Fetch and assign DOM elements first
    if (!fetchAndVerifyDOMElements()) {
        return; // Stop if critical elements are missing
    }

    // --- Initialize Database ---
    // This will asynchronously load DB, then enable form and attach listeners on success
    initializeDatabase();

} // End of startApp


// --- Global Initializer ---
window.addEventListener('load', startApp);
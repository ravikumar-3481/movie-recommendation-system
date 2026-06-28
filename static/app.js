document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const searchInput = document.getElementById('movie-search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
    
    const movieDetailsSection = document.getElementById('movie-details-section');
    const recommendationsSection = document.getElementById('recommendations-section');
    
    // Query Showcase Elements
    const queryPosterContainer = document.getElementById('query-poster-container');
    const queryTitle = document.getElementById('query-title');
    const queryYear = document.getElementById('query-year');
    const queryRatingVal = document.getElementById('query-rating-val');
    const queryGenres = document.getElementById('query-genres');
    const queryVotes = document.getElementById('query-votes');
    const queryImdbLink = document.getElementById('query-imdb-link');
    const findSimilarTrigger = document.getElementById('find-similar-trigger');
    const calcTimeText = document.getElementById('calc-time');
    const recommendationsGrid = document.getElementById('recommendations-grid');

    let debounceTimeout = null;
    let selectedIndex = null;
    let selectedTitle = '';
    let suggestionList = [];
    let activeSuggestionIndex = -1;

    // Initialize Lucide Icons
    lucide.createIcons();

    // Event Listeners
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keydown', handleSearchKeydown);
    clearSearchBtn.addEventListener('click', clearSearch);
    findSimilarTrigger.addEventListener('click', () => {
        if (selectedIndex !== null) {
            fetchRecommendations(selectedIndex);
        }
    });

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
            closeDropdown();
        }
    });

    // Handle Input change with debounce
    function handleSearchInput() {
        const query = searchInput.value.trim();
        
        if (query.length > 0) {
            clearSearchBtn.style.display = 'flex';
        } else {
            clearSearchBtn.style.display = 'none';
            closeDropdown();
            return;
        }

        // Debounce input to prevent overwhelming the API
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            fetchAutocompleteSuggestions(query);
        }, 200);
    }

    // Fetch matching movies from the API
    async function fetchAutocompleteSuggestions(query) {
        try {
            const response = await fetch(`/api/movies?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error("Search failed");
            
            suggestionList = await response.json();
            renderDropdown(suggestionList);
        } catch (error) {
            console.error("Error in autocomplete:", error);
        }
    }

    // Render suggestions
    function renderDropdown(items) {
        if (items.length === 0) {
            autocompleteDropdown.innerHTML = `<div class="suggestion-no-results">No movies found matching "${searchInput.value}"</div>`;
            autocompleteDropdown.style.display = 'block';
            activeSuggestionIndex = -1;
            return;
        }

        let html = '';
        items.forEach((item, index) => {
            const ratingHtml = item.rating 
                ? `<span class="suggestion-rating"><i data-lucide="star"></i> ${item.rating.toFixed(1)}</span>` 
                : '';
                
            const yearText = item.year ? `(${item.year})` : '';
            const genresText = item.genres.slice(0, 2).join(', ');

            html += `
                <div class="suggestion-item" data-index="${index}" data-movie-index="${item.index}">
                    <div class="suggestion-info">
                        <span class="suggestion-title">${item.title} <span style="font-weight: 400; font-size: 13px; color: var(--text-muted);">${yearText}</span></span>
                        <span class="suggestion-meta">
                            <span class="suggestion-genres">${genresText}</span>
                        </span>
                    </div>
                    ${ratingHtml}
                </div>
            `;
        });

        autocompleteDropdown.innerHTML = html;
        autocompleteDropdown.style.display = 'block';
        activeSuggestionIndex = -1;
        
        // Re-initialize stars in the dropdown
        lucide.createIcons();

        // Add click events to suggestion items
        const suggestionNodes = autocompleteDropdown.querySelectorAll('.suggestion-item');
        suggestionNodes.forEach(node => {
            node.addEventListener('click', () => {
                const index = parseInt(node.getAttribute('data-index'));
                selectMovie(suggestionList[index]);
            });
        });
    }

    // Keyboard navigation inside dropdown
    function handleSearchKeydown(e) {
        const items = autocompleteDropdown.querySelectorAll('.suggestion-item');
        if (autocompleteDropdown.style.display === 'none' || items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
            highlightSuggestion(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
            highlightSuggestion(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeSuggestionIndex >= 0 && activeSuggestionIndex < items.length) {
                selectMovie(suggestionList[activeSuggestionIndex]);
            } else if (items.length > 0) {
                selectMovie(suggestionList[0]);
            }
        } else if (e.key === 'Escape') {
            closeDropdown();
        }
    }

    // Highlight selected item in list
    function highlightSuggestion(items) {
        items.forEach((item, idx) => {
            if (idx === activeSuggestionIndex) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    }

    function closeDropdown() {
        autocompleteDropdown.style.display = 'none';
        activeSuggestionIndex = -1;
    }

    function clearSearch() {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        closeDropdown();
        searchInput.focus();
    }

    // Select a movie and populate info
    function selectMovie(movie) {
        selectedIndex = movie.index;
        selectedTitle = movie.title;
        searchInput.value = movie.title;
        closeDropdown();
        
        // Populate Showcase Details
        queryTitle.textContent = movie.title;
        queryYear.textContent = movie.year || 'N/A';
        queryRatingVal.textContent = movie.rating ? movie.rating.toFixed(1) : 'N/A';
        queryVotes.textContent = movie.votes ? movie.votes.toLocaleString() : '0';
        
        // Format IMDb Link
        if (movie.imdb_id) {
            const paddedId = movie.imdb_id.padStart(7, '0');
            queryImdbLink.href = `https://www.imdb.com/title/tt${paddedId}/`;
            queryImdbLink.style.display = 'inline-flex';
        } else {
            queryImdbLink.style.display = 'none';
        }

        // Render genre pills
        queryGenres.innerHTML = movie.genres.map(g => `<span class="genre-pill">${g}</span>`).join('');
        
        // Render Poster Placeholder (Skeleton)
        queryPosterContainer.innerHTML = `
            <div class="skeleton" style="width: 100%; height: 100%; min-height: 300px;"></div>
        `;
        
        // Fetch and show actual poster
        loadPosterForMovie(movie.imdb_id, queryPosterContainer, movie.title);

        // Show details section with dynamic slide/fade animation
        movieDetailsSection.style.display = 'block';
        movieDetailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Auto trigger recommendation (provides fluid experience)
        fetchRecommendations(movie.index);
    }

    // Asynchronously fetch and render a poster image
    async function loadPosterForMovie(imdbId, container, title) {
        if (!imdbId) {
            renderFallbackPoster(container, title);
            return;
        }

        try {
            const response = await fetch(`/api/poster/${imdbId}`);
            if (!response.ok) throw new Error();
            const data = await response.json();
            
            if (data.poster_url) {
                container.innerHTML = `<img src="${data.poster_url}" alt="${title} Poster" class="poster-image" onerror="this.onerror=null; this.src=''; this.parentNode.innerHTML='<div class=\\'fallback-poster\\'><i data-lucide=\\'film\\' class=\\'fallback-poster-icon\\'></i><span class=\\'fallback-poster-title\\'>${title}</span></div>'; lucide.createIcons();">`;
            } else {
                renderFallbackPoster(container, title);
            }
        } catch {
            renderFallbackPoster(container, title);
        }
    }

    function renderFallbackPoster(container, title) {
        container.innerHTML = `
            <div class="fallback-poster">
                <i data-lucide="film" class="fallback-poster-icon"></i>
                <span class="fallback-poster-title">${title}</span>
            </div>
        `;
        // Create icons inside fallback
        lucide.createIcons();
    }

    // Fetch similar movies
    async function fetchRecommendations(index) {
        // Show Loading skeletons in grid
        recommendationsSection.style.display = 'block';
        recommendationsGrid.innerHTML = Array(6).fill().map(() => `
            <div class="skeleton-card">
                <div class="skeleton skeleton-poster"></div>
                <div class="skeleton-content">
                    <div class="skeleton skeleton-text" style="width: 40%"></div>
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text" style="width: 60%; margin-top: auto;"></div>
                </div>
            </div>
        `).join('');

        recommendationsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        const startTime = performance.now();
        try {
            const response = await fetch('/api/recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index: index })
            });

            if (!response.ok) throw new Error("Recommendations failed");
            const data = await response.json();
            
            const endTime = performance.now();
            const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
            calcTimeText.textContent = `${timeTaken}s`;

            renderRecommendations(data.recommendations);
        } catch (error) {
            console.error(error);
            recommendationsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Failed to load recommendations. Please try again.</div>`;
        }
    }

    // Render recommendation cards
    function renderRecommendations(movies) {
        if (movies.length === 0) {
            recommendationsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No recommendations found for this movie.</div>`;
            return;
        }

        recommendationsGrid.innerHTML = '';

        movies.forEach((movie) => {
            // Calculate a matching percentage
            // Since similarity score ranges from 0 to 1, we can format it nicely
            const matchPercent = Math.round(movie.similarity * 100);
            
            const movieCard = document.createElement('div');
            movieCard.className = 'movie-card';
            movieCard.setAttribute('data-movie-index', movie.index);
            
            const genresHtml = movie.genres.slice(0, 3).map(g => `<span>${g}</span>`).join('');
            
            const ratingText = movie.rating ? movie.rating.toFixed(1) : 'N/A';
            const yearText = movie.year || 'N/A';

            movieCard.innerHTML = `
                <div class="movie-card-poster" id="card-poster-${movie.index}">
                    <div class="skeleton" style="width: 100%; height: 100%;"></div>
                    <div class="match-percentage-badge">
                        <i data-lucide="zap"></i> ${matchPercent}% Match
                    </div>
                </div>
                <div class="movie-card-content">
                    <div class="movie-card-meta">
                        <span>${yearText}</span>
                        <span style="display: flex; align-items: center; gap: 2px; color: var(--star); font-weight: 700;">
                            <i data-lucide="star" style="width: 12px; height: 12px; fill: var(--star);"></i> ${ratingText}
                        </span>
                    </div>
                    <h4 class="movie-card-title">${movie.title}</h4>
                    <div class="movie-card-genres">
                        ${genresHtml}
                    </div>
                </div>
            `;
            
            recommendationsGrid.appendChild(movieCard);

            // Fetch poster asynchronously for this card
            const posterContainer = movieCard.querySelector(`#card-poster-${movie.index}`);
            loadPosterForMovie(movie.imdb_id, posterContainer, movie.title);

            // Setup click event for the infinite discovery loop
            movieCard.addEventListener('click', () => {
                selectMovie(movie);
            });
        });

        // Re-initialize Lucide Icons for cards
        lucide.createIcons();
    }
});

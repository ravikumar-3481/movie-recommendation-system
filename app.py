import os
import pandas as pd
import numpy as np
import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity as cs

app = FastAPI(
    title="Movie Recommendation API",
    description="Content-based movie recommender using CountVectorizer and Cosine Similarity.",
    version="1.0.0"
)

# Enable CORS for local testing if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for caching loaded data and model vector representations
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
df = None
df2 = None
cv = None
vector_sparse = None
poster_cache = {}

@app.on_event("startup")
def startup_event():
    global df, df2, cv, vector_sparse
    print("Loading datasets...")
    df_path = os.path.join(DATA_DIR, "preproccess_data.csv")
    df2_path = os.path.join(DATA_DIR, "cleaned-movie-data.csv")
    
    if not os.path.exists(df_path) or not os.path.exists(df2_path):
        raise RuntimeError(f"Required CSV files not found in {DATA_DIR}")
        
    df = pd.read_csv(df_path)
    df2 = pd.read_csv(df2_path)
    
    print("Data loaded successfully.")
    
    # Clean data
    df['tags'] = df['tags'].fillna('')
    
    print("Fitting CountVectorizer and creating sparse representation...")
    cv = CountVectorizer(max_features=5000, stop_words='english')
    # Keep as a sparse CSR matrix for optimal performance and memory
    vector_sparse = cv.fit_transform(df['tags'])
    print("Startup vectorization complete!")

class RecommendRequest(BaseModel):
    index: int = None
    title: str = None

@app.get("/api/movies")
def search_movies(q: str = Query(..., description="Query string to search movie titles")):
    """
    Search endpoint for autocomplete. Filters 16,252 movies efficiently
    and sorts the matches by popularity (number of votes) so that popular
    movies appear first in autocomplete suggestions.
    """
    query_clean = q.lower().strip()
    if not query_clean:
        return []
        
    # Search in df2 properly formatted titles
    # Using a fast case-insensitive substring search
    mask = df2['title'].str.lower().str.contains(query_clean, na=False)
    matched_df = df2[mask]
    
    # Sort matching movies by number of votes descending (highest popularity first)
    matched_df = matched_df.sort_values(by='num_votes', ascending=False)
    
    matches = []
    for idx, row in matched_df.head(10).iterrows():
        # Capitalize list of genres
        genres_raw = str(row["genres"]) if not pd.isna(row["genres"]) else ""
        genres_list = [g.strip().capitalize() for g in genres_raw.split(",") if g.strip()]
        
        matches.append({
            "index": int(idx),
            "title": str(row["title"]).title(),
            "imdb_id": str(row["imdb_id"]),
            "year": int(row["year"]) if not pd.isna(row["year"]) else None,
            "genres": genres_list,
            "rating": float(row["average_rating"]) if not pd.isna(row["average_rating"]) else None,
            "votes": int(row["num_votes"]) if not pd.isna(row["num_votes"]) else 0
        })
    return matches

@app.post("/api/recommend")
def get_recommendations(request: RecommendRequest):
    """
    Calculates recommendation scores on the fly using sparse cosine similarity.
    Retrieves the top 6 most similar movies for the selected index.
    """
    idx = request.index
    
    # Fallback to title lookup if index not provided
    if idx is None and request.title:
        norm_title = request.title.lower().replace(" ", "")
        matches = df[df['title'] == norm_title]
        if matches.empty:
            raise HTTPException(status_code=404, detail=f"Movie '{request.title}' not found")
        idx = int(matches.index[0])
        
    if idx is None or idx < 0 or idx >= len(df):
        raise HTTPException(status_code=400, detail="Invalid movie index requested")
        
    # Compute similarity on-the-fly for this index
    query_vector = vector_sparse[idx : idx + 1]
    # Cosine similarity returns shape (1, 16252)
    distances = cs(query_vector, vector_sparse)[0]
    
    # Pair indices with their similarity distance scores and sort descending
    movies_list = sorted(list(enumerate(distances)), reverse=True, key=lambda x: x[1])
    
    recommendations = []
    for item in movies_list:
        rec_idx = item[0]
        similarity_score = float(item[1])
        
        # Exclude the query movie itself
        if rec_idx == idx:
            continue
            
        row = df2.iloc[rec_idx]
        genres_raw = str(row["genres"]) if not pd.isna(row["genres"]) else ""
        genres_list = [g.strip().capitalize() for g in genres_raw.split(",") if g.strip()]
        
        recommendations.append({
            "index": int(rec_idx),
            "title": str(row["title"]).title(),
            "imdb_id": str(row["imdb_id"]),
            "year": int(row["year"]) if not pd.isna(row["year"]) else None,
            "genres": genres_list,
            "rating": float(row["average_rating"]) if not pd.isna(row["average_rating"]) else None,
            "votes": int(row["num_votes"]) if not pd.isna(row["num_votes"]) else 0,
            "similarity": similarity_score
        })
        
        # Return exactly top 6 recommendations
        if len(recommendations) >= 6:
            break
            
    # Gather details for the query movie
    query_row = df2.iloc[idx]
    genres_raw_q = str(query_row["genres"]) if not pd.isna(query_row["genres"]) else ""
    genres_list_q = [g.strip().capitalize() for g in genres_raw_q.split(",") if g.strip()]
    
    query_movie_details = {
        "index": idx,
        "title": str(query_row["title"]).title(),
        "imdb_id": str(query_row["imdb_id"]),
        "year": int(query_row["year"]) if not pd.isna(query_row["year"]) else None,
        "genres": genres_list_q,
        "rating": float(query_row["average_rating"]) if not pd.isna(query_row["average_rating"]) else None,
        "votes": int(query_row["num_votes"]) if not pd.isna(query_row["num_votes"]) else 0
    }
    
    return {
        "query_movie": query_movie_details,
        "recommendations": recommendations
    }

@app.get("/api/poster/{imdb_id}")
async def get_poster(imdb_id: str):
    """
    Fetches the movie poster from the Free Movie Database (FM-DB) API.
    Caches the results locally to avoid redundant network calls.
    """
    clean_id = imdb_id.lower().strip()
    if clean_id.startswith("tt"):
        digits = clean_id[2:]
    else:
        digits = clean_id
        
    formatted_id = f"tt{digits.zfill(7)}"
    
    if formatted_id in poster_cache:
        return {"poster_url": poster_cache[formatted_id]}
        
    url = f"https://imdb.iamidiotareyoutoo.com/search?q={formatted_id}"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=4.0)
            if response.status_code == 200:
                data = response.json()
                if data.get("ok") and data.get("description"):
                    description = data["description"]
                    for item in description:
                        if item.get("#IMDB_ID") == formatted_id:
                            poster_url = item.get("#IMG_POSTER")
                            if poster_url:
                                poster_cache[formatted_id] = poster_url
                                return {"poster_url": poster_url}
    except Exception as e:
        print(f"Error fetching poster for {formatted_id}: {e}")
        
    # Return None if not found or on error, frontend will render fallback card
    return {"poster_url": None}

# Mount static folder
static_dir = os.path.join(BASE_DIR, "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_root():
    return FileResponse(os.path.join(static_dir, "index.html"))

@app.get("/favicon.ico")
@app.get("/favicon.svg")
def get_favicon():
    return FileResponse(os.path.join(static_dir, "favicon.svg"), media_type="image/svg+xml")

@app.get("/styles.css")
def get_styles():
    return FileResponse(os.path.join(static_dir, "styles.css"))

@app.get("/app.js")
def get_js():
    return FileResponse(os.path.join(static_dir, "app.js"))

if __name__ == "__main__":
    import uvicorn
    # Start on port 8000
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)

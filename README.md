# Movie Recommendation System

A content-based movie recommendation web application built with FastAPI, Pandas, NumPy, and scikit-learn. The app recommends movies based on text similarity using a CountVectorizer and cosine similarity over movie metadata and tags.

## Features

- Search movies by title with autocomplete-style results
- Recommend similar movies based on a selected movie
- Display movie metadata such as year, genres, rating, and votes
- Serve a simple frontend from the static folder
- Fetch poster URLs through an API endpoint

## Project Structure

```text
.
├── app.py                  # FastAPI backend application
├── requirements.txt       # Python dependencies
├── data/                  # CSV datasets used by the app
│   ├── cleaned-movie-data.csv
│   ├── preproccess_data.csv
│   └── imdb_top_movies_1980_2026.csv
├── notebooks/            # Jupyter notebooks for analysis and modeling
├── static/               # Frontend assets (HTML, CSS, JS)
└── README.md             # Project documentation
```

## Technologies Used

- Python 3
- FastAPI
- Uvicorn
- Pandas
- NumPy
- scikit-learn
- HTTPX
- Pydantic

## Installation

1. Clone the repository.
2. Create and activate a virtual environment:

```bash
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

## Running the Application

Start the server with:

```bash
python app.py
```

The app will run locally at:

```text
http://127.0.0.1:8000
```

## API Endpoints

- GET /api/movies?q=search_term
  - Searches movies by title
- POST /api/recommend
  - Returns recommendations for a selected movie
- GET /api/poster/{imdb_id}
  - Returns a poster URL for the given IMDb ID
- GET /
  - Serves the home page

## Dataset

The application uses CSV files stored in the data folder:

- cleaned-movie-data.csv
- preproccess_data.csv
- imdb_top_movies_1980_2026.csv

These files contain movie metadata and processed text features used for recommendation generation.

## Notes

- The recommendation engine uses a content-based approach based on movie tags and metadata.
- The app is designed for local development and testing.
- The frontend assets are served from the static directory.

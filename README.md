# Manga API

A TypeScript-based manga scraping API that supports various manga sources.

## Currently Supported Sources

- AsuraScans (https://asuracomic.net)

## Installation

```bash
npm install
```

## Usage

### As a Library

```typescript
import { AsuraScans } from './src/parsers';

// Create a new instance of the parser
const asura = new AsuraScans();

// Search for manga
const searchResults = await asura.search('solo leveling');

// Get latest manga updates
const latestManga = await asura.getLatestUpdates(1); // page number is optional

// Get manga info
const mangaInfo = await asura.fetchMangaInfo('manga-id');

// Get chapter pages
const chapterPages = await asura.fetchChapterPages('chapter-id');
```

### As an API Server

The project includes a REST API server that exposes the manga scraping functionality through HTTP endpoints.

To start the server:

```bash
# Development mode with hot reloading
npm run dev

# Production mode
npm run build
npm start
```

## API Reference

### Library Methods

```typescript
search(query: string, page?: number): Promise<ISearch<IMangaResult>>
getLatestUpdates(page?: number): Promise<ISearch<IMangaResult>>
fetchMangaInfo(mangaId: string): Promise<IMangaInfo>
fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]>
```

### REST API Endpoints

#### Search Manga
```http
GET /api/search?query=<search_term>&page=<page_number>
```

#### Get Latest Manga Updates
```http
GET /api/latest?page=<page_number>
```

#### Get Manga Info
```http
GET /api/manga/:id
```

#### Get Chapter Pages
```http
GET /api/chapter/:id
```

#### Health Check
```http
GET /health
```

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Build for production: `npm run build`
5. Start production server: `npm start`

## License

MIT 
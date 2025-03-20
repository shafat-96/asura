import express from 'express';
import cors from 'cors';
import { AsuraScans } from '../parsers';

const app = express();

// Initialize manga parser
const asura = new AsuraScans();

// Middleware
app.use(cors());
app.use(express.json());

// Add request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  console.log(`[${new Date().toISOString()}] ${method} ${url} - ${ip} - ${userAgent}`);
  
  // Add response listener to log the response time
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${method} ${url} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Add error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errorDetails = {
    message: err.message,
    path: req.path,
    method: req.method,
    status: err.status || 500,
    code: err.code,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  };
  
  console.error(`[ERROR] ${JSON.stringify(errorDetails)}`);
  res.status(errorDetails.status).json({ 
    error: errorDetails.message, 
    code: errorDetails.code,
    path: errorDetails.path
  });
});

// Routes
app.get('/api/search', async (req, res) => {
  try {
    const { query, page } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    const results = await asura.search(query as string, page ? parseInt(page as string) : 1);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    
    // Check if it's a 403 error even after all retries
    if ((error as Error).message.includes('403')) {
      return res.status(503).json({ 
        error: 'The manga site is currently blocking our requests. We are working on a solution.',
        retry: true
      });
    }
    
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/latest', async (req, res) => {
  try {
    const { page } = req.query;
    const pageNum = page ? parseInt(page as string) : 1;
    
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ error: 'Invalid page number' });
    }

    const results = await asura.getLatestUpdates(pageNum);
    
    if (results.results.length === 0) {
      return res.status(404).json({ error: 'No manga found' });
    }

    res.json(results);
  } catch (error) {
    console.error('Latest error:', error);
    
    // Check if it's a 403 error even after all retries
    if ((error as Error).message.includes('403')) {
      return res.status(503).json({ 
        error: 'The manga site is currently blocking our requests. We are working on a solution.',
        retry: true
      });
    }
    
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/popular', async (req, res) => {
  try {
    const results = await asura.getPopularToday();
    
    if (results.results.length === 0) {
      return res.status(404).json({ error: 'No manga found' });
    }

    res.json(results);
  } catch (error) {
    console.error('Popular error:', error);
    
    // Check if it's a 403 error even after all retries
    if ((error as Error).message.includes('403')) {
      return res.status(503).json({ 
        error: 'The manga site is currently blocking our requests. We are working on a solution.',
        retry: true
      });
    }
    
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/manga/:id(*)', async (req, res) => {
  try {
    const { id } = req.params;
    const manga = await asura.fetchMangaInfo(id);
    res.json(manga);
  } catch (error) {
    console.error('Manga info error:', error);
    
    // Check if it's a 403 error even after all retries
    if ((error as Error).message.includes('403')) {
      return res.status(503).json({ 
        error: 'The manga site is currently blocking our requests. We are working on a solution.',
        retry: true
      });
    }
    
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/chapter/:id(*)', async (req, res) => {
  try {
    const { id } = req.params;
    const pages = await asura.fetchChapterPages(id);
    res.json(pages);
  } catch (error) {
    console.error('Chapter pages error:', error);
    
    // Check if it's a 403 error even after all retries
    if ((error as Error).message.includes('403')) {
      return res.status(503).json({ 
        error: 'The manga site is currently blocking our requests. We are working on a solution.',
        retry: true
      });
    }
    
    res.status(500).json({ error: (error as Error).message });
  }
});

// Add new series endpoint
app.get('/api/series', async (req, res) => {
  try {
    const { page } = req.query;
    const pageNum = page ? parseInt(page as string) : 1;
    
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ error: 'Invalid page number' });
    }

    const results = await asura.getSeries(pageNum);
    
    if (results.results.length === 0) {
      return res.status(404).json({ error: 'No manga found' });
    }

    res.json(results);
  } catch (error) {
    console.error('Series error:', error);
    
    // Check if it's a 403 error even after all retries
    if ((error as Error).message.includes('403')) {
      return res.status(503).json({ 
        error: 'The manga site is currently blocking our requests. We are working on a solution.',
        retry: true
      });
    }
    
    res.status(500).json({ error: (error as Error).message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Export the Express app
export default app;
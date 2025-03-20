import app from './server';

// Export for Vercel serverless function
export default async function handler(req: any, res: any) {
  // Forward the request to the Express app
  return app(req, res);
} 
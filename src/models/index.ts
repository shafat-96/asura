import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export enum MediaStatus {
  ONGOING = 'Ongoing',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
  UNKNOWN = 'Unknown'
}

export interface IMangaResult {
  id: string;
  title: string;
  image?: string;
  status?: MediaStatus;
  latestChapter?: string;
  rating?: string;
}

export interface IMangaChapter {
  id: string;
  title: string;
  releaseDate?: string;
}

export interface IMangaChapterPage {
  page: number;
  img: string;
}

export interface IMangaInfo {
  id: string;
  title: string;
  image?: string;
  status?: MediaStatus;
  rating?: string;
  description?: string;
  authors?: string[];
  artist?: string;
  genres?: string[];
  updatedOn?: string;
  chapters?: IMangaChapter[];
  recommendations?: IMangaResult[];
}

export interface ISearch<T> {
  currentPage: number;
  hasNextPage: boolean;
  results: T[];
}

export abstract class MangaParser {
  protected abstract readonly baseUrl: string;
  protected abstract readonly logo: string;
  protected abstract readonly classPath: string;
  abstract readonly name: string;

  protected client: AxiosInstance = axios.create();

  /**
   * Makes a request with automatic retries for transient errors
   * @param url The URL to request
   * @param config Optional axios config
   * @param maxRetries Maximum number of retries (default: 3)
   * @param retryDelay Delay between retries in ms (default: 1000)
   */
  protected async request<T = any>(
    url: string, 
    config?: AxiosRequestConfig,
    maxRetries = 3,
    retryDelay = 1000
  ): Promise<T> {
    let retries = 0;
    
    while (true) {
      try {
        const response = await this.client.request<T>({
          url,
          ...config
        });
        return response.data;
      } catch (error: any) {
        if (
          retries < maxRetries && 
          (
            error.code === 'ECONNRESET' || 
            error.code === 'ETIMEDOUT' || 
            error.code === 'ERR_NETWORK' ||
            (error.response && (error.response.status === 429 || error.response.status >= 500))
          )
        ) {
          retries++;
          console.log(`Request failed, retrying (${retries}/${maxRetries}): ${url}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * retries));
          continue;
        }
        throw error;
      }
    }
  }

  abstract search(query: string, page?: number): Promise<ISearch<IMangaResult>>;
  abstract fetchMangaInfo(mangaId: string): Promise<IMangaInfo>;
  abstract fetchChapterPages(chapterId: string): Promise<IMangaChapterPage[]>;
} 
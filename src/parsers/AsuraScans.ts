import { load } from 'cheerio';
import {
  MangaParser,
  ISearch,
  IMangaInfo,
  IMangaResult,
  MediaStatus,
  IMangaChapterPage,
  IMangaChapter,
} from '../models';
import { AxiosResponse } from 'axios';

class AsuraScans extends MangaParser {
  override readonly name = 'AsuraScans';
  protected override baseUrl = 'https://asuracomic.net';
  private readonly fallbackProxies = [
    'https://goodproxy.goodproxy.workers.dev/fetch?url='
  ];
  private currentProxyIndex = -1; // Start with direct access (no proxy)
  protected override logo = 'https://asuracomic.net/images/logo.png';
  protected override classPath = 'MANGA.AsuraScans';

  constructor() {
    super();
    // Add default headers to make requests appear more like a browser
    this.client.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    this.client.defaults.headers.common['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
    this.client.defaults.headers.common['Accept-Language'] = 'en-US,en;q=0.9';
    this.client.defaults.headers.common['Referer'] = 'https://asuracomic.net/';
  }

  /**
   * Gets the current URL to use (with or without proxy)
   */
  private getProxiedUrl(path: string): string {
    if (this.currentProxyIndex < 0) {
      return `${this.baseUrl}/${path}`;
    }
    
    const proxy = this.fallbackProxies[this.currentProxyIndex % this.fallbackProxies.length];
    return `${proxy}${encodeURIComponent(`${this.baseUrl}/${path}`)}`;
  }

  /**
   * Request with proxy fallback
   */
  protected async requestWithFallback<T = any>(path: string): Promise<T> {
    // First try direct access
    try {
      this.currentProxyIndex = -1; // Direct access
        return await this.request<T>(this.getProxiedUrl(path));
      } catch (error: any) {
      console.log(`Direct access failed, trying with goodproxy: ${error.message}`);
        
      // If direct access fails with 403 or network error, try with proxy
        if (
          !error.response || 
          error.response.status === 403 || 
          error.response.status === 429 ||
          error.code === 'ECONNRESET' || 
          error.code === 'ETIMEDOUT' || 
          error.code === 'ERR_NETWORK'
        ) {
        try {
          this.currentProxyIndex = 0; // Use the goodproxy
          return await this.request<T>(this.getProxiedUrl(path));
        } catch (proxyError: any) {
          console.log(`Proxy access failed: ${proxyError.message}`);
          throw proxyError;
        }
        } else {
          throw error; // Re-throw non-network errors
        }
      }
  }

  private formatId(id: string): string {
    return id.startsWith('series/') ? id : `series/${id}`;
  }

  async getLatestUpdates(page: number = 1): Promise<ISearch<IMangaResult>> {
    try {
      const data = await this.requestWithFallback<string>(`page/${page}`);
      const $ = load(data);

      // Find the Latest Updates section
      const latestSection = $('.text-white.mb-1.md\\:mb-5.mt-5');
      
      const results = latestSection
        .find('.w-full.p-1.pt-1.pb-3')
        .map((_: number, ele: any): IMangaResult & { chapters?: IMangaChapter[] } => {
          const container = $(ele);
          
          // Get manga info
          const titleLink = container.find('.text-\\[15px\\].font-medium a');
          const href = titleLink.attr('href') || '';
          const mangaId = href.split('/series/')[1];
          const title = titleLink.text().trim();
          const image = container.find('img.rounded-md').attr('src');
          
          // Get all latest chapters with their upload times
          const chapters: IMangaChapter[] = [];
          container.find('.flex.flex-col.gap-y-1\\.5.list-disc .flex-1').each((_, chapterEle) => {
            const chapterContainer = $(chapterEle);
            const chapterLink = chapterContainer.find('a').first();
            const chapterHref = chapterLink.attr('href');
            
            if (chapterHref?.includes('/chapter/')) {
              // Try both mobile and desktop versions of the chapter text
              const chapterText = chapterContainer.find('.hidden.sm\\:flex p').text().trim() || 
                                chapterContainer.find('p.w-\\[80px\\]').text().trim();
              const timeAgo = chapterContainer.find('.text-\\[12px\\].text-\\[\\#555555\\]').text().trim();
              
              if (chapterText) {
                const chapterNum = chapterText.replace('Chapter ', '').split(' - ')[0];
                const chapterTitle = chapterText.includes(' - ') ? 
                  chapterText : 
                  `Chapter ${chapterNum}`;
                
                chapters.push({
                  id: chapterNum,
                  title: chapterTitle,
                  releaseDate: timeAgo
                });
              }
            }
          });

          // Get the latest chapter number and its upload time
          const latestChapter = chapters.length > 0 ? 
            `${chapters[0].id} (${chapters[0].releaseDate})` : 
            undefined;

          return {
            id: mangaId,
            title,
            image,
            status: MediaStatus.UNKNOWN,
            latestChapter,
            chapters,
            rating: '' // Keep rating empty since we're using chapters array
          };
        })
        .get();

      // Check for pagination - look for the "next" link in pagination
      const hasNextPage = $('.pagination .next').length > 0;

      return {
        currentPage: page,
        hasNextPage,
        results,
      };
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  async getPopularToday(): Promise<ISearch<IMangaResult>> {
    try {
      const data = await this.requestWithFallback<string>(``);
      const $ = load(data);

      const results: IMangaResult[] = [];

      // Find the Popular section
      const popularSection = $('.bg-\\[\\#222\\].rounded-\\[3px\\].mb-\\[18px\\]');

      // Get manga entries from the weekly tab content
      popularSection.find('[data-state="active"][role="tabpanel"] .flex.px-\\[15px\\].py-3').each((_, ele) => {
        const container = $(ele);
        
        // Get the rank number
        const rank = container.find('.text-\\[14px\\].text-\\[\\#888\\]').text().trim();
        
        // Get manga info
        const titleLink = container.find('a').first();
        const href = titleLink.attr('href') || '';
        const mangaId = href.replace('/series/', '');
        const title = container.find('.text-\\[13px\\].font-\\[500\\].text-\\[\\#fff\\]').text().trim();
        const image = container.find('img').attr('src');
        const rating = container.find('.text-\\[12px\\].leading-normal.italic.text-\\[\\#999\\]').text().trim();

        if (mangaId && title && !results.some(r => r.id === mangaId)) {
          results.push({
            id: mangaId,
            title,
            image,
            status: MediaStatus.UNKNOWN,
            rating
          });
        }
      });

      return {
        currentPage: 1,
        hasNextPage: false,
        results,
      };
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  override fetchMangaInfo = async (mangaId: string): Promise<IMangaInfo> => {
    try {
      const formattedId = this.formatId(mangaId);
      const data = await this.requestWithFallback<string>(formattedId);
      const $ = load(data);

      const dom = $('html');
      const topInfoWrapper = dom.find('.relative.col-span-12.space-y-3.px-6');

      const info: IMangaInfo = {
        id: mangaId,
        title: dom.find('.text-xl.font-bold:nth-child(1)').text().trim(),
        image: $(topInfoWrapper).find('img').attr('src'),
        rating: $(topInfoWrapper).find('div > div.px-2.py-1 > p').text().trim(),
        status: this.determineMediaState(
          $(topInfoWrapper).find('div > div.flex.flex-row > div:nth-child(1) > h3:nth-child(2)').text().trim()
        ),
        description: dom.find('span.font-medium.text-sm').text().trim(),
        authors: dom
          .find('.grid.grid-cols-1.gap-5.mt-8 > div:nth-child(2) > h3:nth-child(2)')
          .text()
          .trim()
          .split('/')
          .map((ele: string) => ele.trim()),
        artist: dom.find('.grid.grid-cols-1.gap-5.mt-8 > div:nth-child(3) > h3:nth-child(2)').text().trim(),
        updatedOn: dom
          .find('.grid.grid-cols-1.gap-5.mt-8 > div:nth-child(5) > h3:nth-child(2)')
          .text()
          .trim(),
        genres: dom
          .find('.space-y-1.pt-4 > div > button')
          .map((_: number, ele: any) => $(ele).text().trim())
          .get(),
        recommendations: dom
          .find('.grid.grid-cols-2.gap-3.p-4 > a')
          .map((_: number, ele: any): IMangaResult => {
            const href = $(ele).attr('href') as string;
            return {
              id: href.replace('series/', ''),
              title: $(ele).find('div > h2.font-bold').text().trim(),
              image: $(ele).find('div > div > img').attr('src'),
              latestChapter: $(ele).find('div > h2:nth-child(3)').text().trim(),
              status: this.determineMediaState($(ele).find('div > div:nth-child(1) > span').text().trim()),
              rating: $(ele).find('div > div.block > span > label').text().trim(),
            };
          })
          .get(),
      };

      const chapMatch = data
        .replace(/\n/g, '')
        .replace(/\\/g, '')
        .match(/"chapters".*:(\[\{.*?\}\]),/);
      if (chapMatch) {
        const chap: { name: string; title: string; id: string; published_at: string }[] = JSON.parse(
          chapMatch[1]
        );
        info.chapters = chap.map((ele): IMangaChapter => {
          return {
            id: ele.name,
            title: ele.title != '' ? ele.title : `Chapter ${ele.name}`,
            releaseDate: ele.published_at,
          };
        });
      }
      return info;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  override fetchChapterPages = async (chapterId: string): Promise<IMangaChapterPage[]> => {
    try {
      const formattedId = this.formatId(chapterId);
      const data = await this.requestWithFallback<string>(formattedId);
      const chapMatch = data.replace(/\\/g, '').match(/pages.*:(\[{['"]order["'].*?}\])/);
      if (!chapMatch) throw new Error('Parsing error');
      const chap: { order: string; url: string }[] = JSON.parse(chapMatch[1]);
      return chap.map(
        (page, index): IMangaChapterPage => ({
          page: index + 1,
          img: page.url,
        })
      );
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  async getSeries(page: number = 1): Promise<ISearch<IMangaResult>> {
    try {
      const data = await this.requestWithFallback<string>(`series?page=${page}`);
      const $ = load(data);

      const results = $('.grid.grid-cols-2.gap-3.p-4 > a')
        .map((_: number, ele: any): IMangaResult => {
          const container = $(ele);
          const href = container.attr('href') || '';
          const mangaId = href.replace('/series/', '');
          
          return {
            id: mangaId,
            title: container.find('div > div > div:nth-child(2) > span:nth-child(1)').text().trim(),
            image: container.find('div > div > div:nth-child(1) > img').attr('src'),
            status: this.determineMediaState(
              container.find('div > div > div:nth-child(1) > span').text().trim()
            ),
            latestChapter: container.find('div > div > div:nth-child(2) > span:nth-child(2)').text().trim(),
            rating: container.find('div > div > div:nth-child(2) > span:nth-child(3) > label').text().trim()
          };
        })
        .get();

      const hasNextPage = $('.flex.items-center.justify-center > a')
        .toArray()
        .some(ele => {
          const style = $(ele).attr('style') || '';
          return style.includes('pointer-events:auto');
        });

      return {
        currentPage: page,
        hasNextPage,
        results
      };
    } catch (err) {
      throw new Error((err as Error).message);
    }
  }

  override search = async (query: string, page: number = 1): Promise<ISearch<IMangaResult>> => {
    try {
      const formattedQuery = encodeURI(query.toLowerCase());
      const data = await this.requestWithFallback<string>(
        `series?page=${page}&name=${formattedQuery}`
      );

      const $ = load(data);
      const dom = $('html');

      const results = dom
        .find('.grid.grid-cols-2.gap-3.p-4 > a')
        .map((_: number, ele: any): IMangaResult => {
          const href = $(ele).attr('href') as string;
          return {
            id: href.replace('series/', ''),
            title: $(ele).find('div > div > div:nth-child(2) > span:nth-child(1)').text().trim() as string,
            image: $(ele).find('div > div > div:nth-child(1) > img').attr('src') as string,
            status: this.determineMediaState(
              $(ele).find('div > div > div:nth-child(1) > span').text().trim()
            ),
            latestChapter: $(ele).find('div > div > div:nth-child(2) > span:nth-child(2)').text().trim(),
            rating: $(ele).find('div > div > div:nth-child(2) > span:nth-child(3) > label').text().trim(),
          };
        })
        .get();

      const searchResults: ISearch<IMangaResult> = {
        currentPage: page,
        hasNextPage:
          (dom.find('.flex.items-center.justify-center > a').attr('style') as string)
            .split('pointer-events:')[1]
            .slice(1, -1) === 'auto'
            ? true
            : false,
        results: results,
      };

      return searchResults;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  private determineMediaState(state: string): MediaStatus {
    switch (state.toLowerCase().trim()) {
      case 'completed':
        return MediaStatus.COMPLETED;
      case 'ongoing':
        return MediaStatus.ONGOING;
      case 'dropped':
        return MediaStatus.CANCELLED;
      default:
        return MediaStatus.UNKNOWN;
    }
  }
}

export default AsuraScans; 

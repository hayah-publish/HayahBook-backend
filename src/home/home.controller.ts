import { Controller, Get, Query } from '@nestjs/common';
import { PostsService } from '../posts/posts.service';
import { PostsQueryDto } from '../posts/dto/posts-query.dto';

@Controller(['home', 'feed'])
export class HomeController {
  constructor(private readonly postsService: PostsService) {}

  /**
   * GET /v1/home
   * GET /v1/feed
   * Unified Home Feed combining posts, articles, visuals, and snippets
   * Optional query param: ?type=all | posts | articles | visuals | snippets
   */
  @Get()
  async getHomeFeed(@Query() query: PostsQueryDto) {
    return this.postsService.getHomeFeed(query);
  }

  /**
   * GET /v1/home/feed
   */
  @Get('feed')
  async getFeed(@Query() query: PostsQueryDto) {
    return this.postsService.getHomeFeed(query);
  }

  /**
   * GET /v1/home/counts
   * GET /v1/feed/counts
   * Item counts for all 5 feed tabs (all, posts, articles, visuals, snippets)
   */
  @Get('counts')
  async getFeedCounts() {
    return this.postsService.getFeedCounts();
  }
}

import { Module } from '@nestjs/common';
import { CategoriesController } from '@modules/categories/categories.controller';
import { CategoriesService } from '@modules/categories/categories.service';
import { CategoriesRepository } from '@modules/categories/categories.repository';
import { SubscriptionsModule } from '@modules/subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository],
  exports: [CategoriesService],
})
export class CategoriesModule {}

import { Model } from "../mod.ts";
import { UserModel } from "./user_model.ts";

export interface ArticleEntity {
  id: number;
  user_id: number;
  title: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}
export class ArticleModel extends Model implements ArticleEntity {
  protected tablename = "articles";
  id = 0;
  title = "";
  tags = [];
  user_id = 0;
  created_at = "";
  updated_at = "";
  customer_prop = "test";

  protected async factoryDefaults(
    data: Partial<ArticleEntity>,
  ): Promise<Partial<ArticleEntity>> {
    const userId = data.user_id ?? (await UserModel.factory()).id;
    return {
      title: data.title ?? "Drashland article",
      tags: [],
      user_id: userId,
    };
  }

  public async user(): Promise<UserModel | null> {
    return await UserModel.where("id", this.user_id).first();
  }

  // public async toEntity(): Promise<ArticleEntity> {
  //     return await super.toEntity<ArticleEntity>({
  //         user: await this.user()
  //     })
  // }
}

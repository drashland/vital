import { Model } from "../mod.ts";
import { ArticleModel } from "./article_model.ts";

interface EntityWithRelations extends UserEntity {
  articles: ArticleModel[];
}
export interface UserEntity {
  id: number;
  username: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}
export class UserModel extends Model {
  protected tablename = "users";
  id = 0;
  is_admin = false;
  username = "";
  created_at = "";
  updated_at = "";

  protected factoryDefaults(data: Partial<UserEntity>): Partial<UserEntity> {
    return {
      username: data.username ?? "Drashland",
      is_admin: data.is_admin ?? true,
    };
  }

  public async articles() {
    return await ArticleModel.where("user_id", this.id).all();
  }
}
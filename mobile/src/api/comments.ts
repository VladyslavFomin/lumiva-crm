export interface EntityComment {
  id: string;
  author: string;
  createdAt: string;
  text: string;
  mentions?: string[];
  parentId?: string | null;
  likedBy?: string[];
}

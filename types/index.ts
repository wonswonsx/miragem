export type GenerationStatus = 'idle' | 'uploading' | 'pending' | 'processing' | 'completed' | 'failed';

export type GenerationType = 'padrao' | 'estendido';

export interface Generation {
  id: string;
  user_id: string;
  image_url: string | null;
  video_url: string | null;
  type: GenerationType;
  diamond_cost: number;
  status: GenerationStatus;
  created_at: string;
  updated_at: string;
}

export interface GenerationInsert {
  user_id: string;
  image_url: string;
  type: GenerationType;
  diamond_cost: number;
  status: 'processing';
}

export interface TransactionInsert {
  user_id: string;
  amount: number;
  type: string;
  description: string;
}

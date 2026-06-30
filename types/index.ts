export type GenerationStatus = 'idle' | 'uploading' | 'pending' | 'processing' | 'completed' | 'failed';

export type GenerationType = 'padrao' | 'estendido';

export interface Generation {
  id: string;
  user_id: string;
  image_url: string | null;
  video_url: string | null;
  type: GenerationType;
  mode?: GenerationType | null;
  audio_enabled?: boolean;
  diamond_cost: number;
  status: GenerationStatus;
  created_at: string;
  updated_at: string;
}

export interface GenerationInsert {
  user_id: string;
  image_url: string | null;
  type: GenerationType;
  mode?: GenerationType;
  audio_enabled?: boolean;
  diamond_cost: number;
  status: 'processing' | 'pendente' | 'pending';
}

export interface TransactionInsert {
  user_id: string;
  amount: number;
  type: string;
  description: string;
}

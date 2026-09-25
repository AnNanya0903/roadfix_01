import { MODE } from '../mode';
import { demoAuth } from './demoAuth';
import { demoService } from './demoService';
import type { AuthAPI, DataService } from './service';
import { supabaseAuth } from './supabaseAuth';
import { supabaseService } from './supabaseService';

export const service: DataService = MODE === 'live' ? supabaseService : demoService;
export const auth: AuthAPI = MODE === 'live' ? supabaseAuth : demoAuth;
export * from './service';

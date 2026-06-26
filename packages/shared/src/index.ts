// Tipos compartilhados entre apps/api e apps/web
// Implementar conforme os módulos forem sendo desenvolvidos

export type UserRole = 'admin' | 'player_free' | 'player_pro' | 'player_premium' | 'support';
export type UserStatus = 'active' | 'inactive' | 'blocked';
export type MatchStatus = 'pending' | 'processing' | 'analyzed' | 'failed';
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * A conta demo é fixa e única: existe pra qualquer visitante entrar sem
 * login, pelo link `/demo`. `username` é o que identifica ela no app (a
 * migração `05_demo_scoped_reads.sql` usa esse mesmo nome pra restringir o
 * que ela enxerga de outros usuários).
 */
export const DEMO_USERNAME = "demo-vitrine"
export const DEMO_EMAIL = "demo-vitrine@vitrine.local"
export const DEMO_DISPLAY_NAME = "Visitante"
